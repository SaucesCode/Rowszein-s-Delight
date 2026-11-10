"""Authorized atomic sale/stock commands preserving retained ledger history."""
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, localcontext
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, ValidationError

from ingredients.models import Ingredient
from products.models import Product
from recipes.models import Recipe
from sales.financial_math import posting_amount
from sales.inventory_math import Basis, MAX_ACTIVE_UNITS, UNITS, allocate, apply_deltas, intent_fingerprint, money_text, signed_money_text, quantity_quanta, quantity_text
from sales.models import ConsumptionBasis, InventoryOperation, Sale, SaleConsumption, SaleFinancialEntry, SaleItem, StockMovement
from sales.storage_precision import validate_quantity_storage
from accounts.permissions import authorize_command
from zoneinfo import ZoneInfo


class Conflict(APIException):
    status_code = 409
    default_detail = 'The operation conflicts with current recorded state.'


@dataclass(frozen=True)
class CommandResult:
    body: dict
    status: int
    replayed: bool = False


def request_identity(raw_key, raw_revision=None, require_revision=False):
    try:
        key = UUID(str(raw_key))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({'Idempotency-Key': 'A stable UUID is required.'})
    revision = None
    if require_revision:
        text = str(raw_revision or '').strip('"')
        if not text.isascii() or not text.isdecimal() or int(text) > MAX_ACTIVE_UNITS:
            raise ValidationError({'If-Match': 'A nonnegative numeric revision is required.'})
        revision = int(text)
    return key, revision


def _replay(actor, key, fingerprint):
    op = InventoryOperation.objects.filter(actor=actor, client_key=key).first()
    if op is None:
        return None
    role = authorize_command(actor, op.action)
    if role == 'staff' and not Sale.objects.filter(pk=op.sale_id, inventory_tracking='tracked', financial_tracking='ledger',
            operations__action='sale_create', operations__actor_id=actor.pk).exists():
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied()
    if op.request_fingerprint != fingerprint:
        raise Conflict('This request identity was already used for a different payload or target.')
    return CommandResult(op.response_body, op.response_status, True)


def _run(actor, key, fingerprint, callback, action):
    try:
        with transaction.atomic():
            authorize_command(actor, action, lock=True)
            from accounts.device_sessions import require_session
            require_session(actor)
            replay = _replay(actor, key, fingerprint)
            if replay:
                return replay
            return callback()
    except IntegrityError as error:
        # Catch OUTSIDE the entire transaction, never retain losing stock writes.
        name = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', None)
        sqlite_identity = 'sales_inventoryoperation.actor_id, sales_inventoryoperation.client_key' in str(error)
        if name == 'invop_actor_key_unique' or sqlite_identity:
            with transaction.atomic():
                authorize_command(actor, action, lock=True)
                from accounts.device_sessions import require_session
                require_session(actor)
                replay = _replay(actor, key, fingerprint)
                if replay:
                    return replay
        if name in {'invop_sale_cancel_once', 'finance_cancel_once'}:
            raise Conflict('This sale already has a cancellation.') from error
        raise


def current_items(sale):
    if sale.current_items is not None:
        return sale.current_items
    return [{'id': item.pk, 'product': item.product_id, 'product_name': item.product.name,
             'quantity': item.quantity, 'unit_price': signed_money_text(item.unit_price),
             'subtotal': signed_money_text(item.subtotal), 'subtotal_amount': signed_money_text(item.subtotal)}
            for item in sale.sale_items.select_related('product').all()]


def item_total(items):
    with localcontext() as context:
        context.prec = 50
        value = sum((Decimal(item['unit_price']) * item['quantity'] for item in items), Decimal('0.00'))
        money_text(value)
        return value


def sale_data(sale):
    items = current_items(sale)
    return {'id': sale.pk, 'date': sale.date.isoformat(), 'notes': sale.notes, 'sale_items': items,
            'total_amount': signed_money_text(sale.total_amount if sale.current_items is None else item_total(items)), 'original_total_amount': signed_money_text(sale.total_amount),
            'status': sale.status, 'revision': str(sale.revision), 'inventory_tracking': sale.inventory_tracking,
            'financial_tracking': sale.financial_tracking, 'created_at': sale.created_at.isoformat(),
            'updated_at': sale.updated_at.isoformat()}


def _items(data, products, originals):
    result = []
    for item in data:
        product = products[item['product'].pk]
        qty, price = item['quantity'], item['unit_price']
        if type(qty) is not int or not 1 <= qty <= 2147483647 or price <= 0:
            raise ValidationError('Sale quantities/prices must be positive and within range.')
        with localcontext() as context:
            context.prec = 50
            subtotal = money_text(price * qty)
        result.append({'id': originals.get(product.pk), 'product': product.pk, 'product_name': product.name,
                       'quantity': qty, 'unit_price': money_text(price), 'subtotal': subtotal, 'subtotal_amount': subtotal})
    if not result or len({item['product'] for item in result}) != len(result):
        raise ValidationError('A sale requires unique product lines.')
    item_total(result)
    return sorted(result, key=lambda item: item['product'])


def _intent(action, target, revision, data, reason):
    payload = {'action': action, 'target': target, 'expected_revision': revision, 'reason': reason, 'schema_version': 1}
    if 'date' in data:
        payload['date'] = data['date'].isoformat()
    if 'notes' in data:
        payload['notes'] = data['notes']
    if 'sale_items' in data:
        payload['sale_items'] = sorted([{'product': item['product'].pk, 'quantity': item['quantity'], 'unit_price': money_text(item['unit_price'])} for item in data['sale_items']], key=lambda item: item['product'])
    return intent_fingerprint(payload)


def _basis_key(product, ingredient, unit, batch, batch_yield):
    return product, ingredient, unit, batch, batch_yield


def execute_sale(*, action, actor, key, data=None, sale_id=None, expected_revision=None, reason=''):
    authorize_command(actor, action)
    data, reason = dict(data or {}), reason.strip()
    if action not in {'sale_create', 'sale_update', 'sale_cancel'}:
        raise ValidationError('Unsupported sale action.')
    if action == 'sale_cancel' and not reason:
        raise ValidationError({'reason': 'Cancellation requires a reason.'})
    fingerprint = _intent(action, sale_id, expected_revision, data, reason)

    def command():
        sale, old_items, old_allocations, before = None, [], [], {}
        if action != 'sale_create':
            try:
                sale = Sale.objects.select_for_update().get(pk=sale_id)
            except Sale.DoesNotExist:
                raise NotFound('Sale not found.')
            replay = _replay(actor, key, fingerprint)
            if replay:
                return replay
            if sale.revision != expected_revision:
                raise Conflict('Sale revision is stale; reload before editing.')
            if sale.status != 'recorded':
                raise Conflict('This sale has already been cancelled.')
            if sale.revision >= MAX_ACTIVE_UNITS:
                raise ValidationError('Sale revision range exhausted.')
            old_items, before = current_items(sale), {'sale': sale_data(sale)}
            if 'date' in data and data['date'] != sale.date:
                raise Conflict('Posted/legacy dates require a separately approved financial correction.')
            if sale.inventory_tracking != 'tracked' or sale.financial_tracking != 'ledger':
                if action == 'sale_cancel' or 'sale_items' in data:
                    raise Conflict('Legacy consumption is unverified; explicit reconciliation is required.')
                sale.notes = data.get('notes', sale.notes)
                sale.revision += 1
                sale.save(update_fields=['notes', 'revision', 'updated_at'])
                body = {'success': True, 'data': sale_data(sale), 'message': 'Sale notes updated.'}
                InventoryOperation.objects.create(actor=actor, client_key=key, action=action, sale=sale,
                    request_fingerprint=fingerprint, reason=reason, before_snapshot=before, response_status=200, response_body=body)
                return CommandResult(body, 200)

        input_items = data.get('sale_items')
        product_ids = {item['product'] for item in old_items}
        if input_items is not None:
            product_ids.update(item['product'].pk for item in input_items)
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=product_ids).order_by('pk')}
        if set(products) != product_ids:
            raise ValidationError('A referenced product no longer exists.')
        # Replay precedes current policy checks: never reprice posted history.
        if authorize_command(actor, action) == 'staff':
            if data.get('date') != timezone.localdate(timezone=ZoneInfo('Asia/Manila')):
                raise ValidationError({'date': 'Staff must use the current Asia/Manila business date.'})
            if any(item['unit_price'] != products[item['product'].pk].price for item in input_items or []):
                raise ValidationError({'sale_items': 'Staff must use current catalog prices.'})
        originals = {} if sale is None else dict(sale.sale_items.values_list('product_id', 'pk'))
        new_items = old_items if input_items is None else _items(input_items, products, originals)
        if action == 'sale_create' and not new_items:
            raise ValidationError('Sale items are required.')
        old_quantities = {item['product']: item['quantity'] for item in old_items}
        new_quantities = {} if action == 'sale_cancel' else {item['product']: item['quantity'] for item in new_items}
        changed = {pk for pk in product_ids if old_quantities.get(pk) != new_quantities.get(pk)}
        if sale:
            old_allocations = list(SaleConsumption.objects.filter(sale=sale, reversed_by__isnull=True, basis__product_id__in=changed).select_related('basis').order_by('pk'))
            if (set(old_quantities) & changed) != {row.basis.product_id for row in old_allocations}:
                raise Conflict('Active snapshots do not cover the previous sale items.')
        recipes = {r.product_id: r for r in Recipe.objects.filter(product_id__in=changed & set(new_quantities)).prefetch_related('recipe_ingredients').order_by('pk')}
        ingredient_ids = {row.basis.ingredient_id for row in old_allocations}
        recipe_lines = []
        for product_id in sorted(changed & set(new_quantities)):
            if not products[product_id].is_available or product_id not in recipes:
                raise ValidationError('New consumption requires an available product and a recipe.')
            recipe = recipes[product_id]
            lines = list(recipe.recipe_ingredients.all())
            if not lines:
                raise ValidationError('Recipes must contain ingredients.')
            for line in lines:
                ingredient_ids.add(line.ingredient_id)
                recipe_lines.append((product_id, line.ingredient_id, line.quantity, recipe.yield_quantity))
        ingredients = {i.pk: i for i in Ingredient.objects.select_for_update().filter(pk__in=ingredient_ids).order_by('pk')}
        if set(ingredients) != ingredient_ids:
            raise Conflict('A historical ingredient is missing.')
        bases = list(ConsumptionBasis.objects.select_for_update().filter(ingredient_id__in=ingredient_ids).order_by('pk'))
        by_id = {basis.pk: basis for basis in bases}
        by_key = {_basis_key(b.product_id, b.ingredient_id, b.unit, b.batch_quantity, b.yield_quantity): b for b in bases}
        replay = _replay(actor, key, fingerprint)
        if replay:
            return replay
        deltas, touched_bases = defaultdict(list), {}
        for row in old_allocations:
            basis = by_id[row.basis_id]
            if basis.unit != ingredients[basis.ingredient_id].unit or basis.active_units < row.units:
                raise Conflict('Historical units/counters disagree; reconcile explicitly.')
            quantity_quanta(row.applied_quantity)
            basis.active_units -= row.units
            touched_bases[id(basis)] = basis
            deltas[basis.ingredient_id].append(row.applied_quantity)
        additions = []
        for product_id, ingredient_id, batch, batch_yield in recipe_lines:
            unit = ingredients[ingredient_id].unit
            basis_key = _basis_key(product_id, ingredient_id, unit, batch, batch_yield)
            basis = by_key.get(basis_key)
            if basis is None:
                basis = ConsumptionBasis(product_id=product_id, ingredient_id=ingredient_id, unit=unit, batch_quantity=batch, yield_quantity=batch_yield)
                by_key[basis_key] = basis
            allocation = allocate(Basis(batch, batch_yield, unit), basis.allocated_units, new_quantities[product_id])
            basis.allocated_units = allocation.end
            basis.active_units += new_quantities[product_id]
            touched_bases[id(basis)] = basis
            deltas[ingredient_id].append(allocation.applied_quantity.copy_negate())
            additions.append((basis, allocation, new_quantities[product_id]))
        projected = {pk: apply_deltas(ingredients[pk].quantity, deltas[pk]) for pk in ingredient_ids}
        # Validate every Decimal that will be stored, before ANY business write.
        with localcontext() as context:
            context.prec = 50
            for pk in ingredient_ids:
                for value in [ingredients[pk].quantity, projected[pk], projected[pk] - ingredients[pk].quantity]:
                    validate_quantity_storage(value)
        for _, allocation, _ in additions:
            validate_quantity_storage(allocation.applied_quantity)
        old_amount = item_total(old_items) if old_items else Decimal('0.00')
        new_amount = Decimal('0.00') if action == 'sale_cancel' else item_total(new_items)
        if sale:
            book = SaleFinancialEntry.objects.filter(sale=sale).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if book != old_amount:
                raise Conflict('Financial postings disagree with the current sale; reconcile first.')
        posting_kind = 'gross_sale' if action == 'sale_create' else ('cancellation' if action == 'sale_cancel' else 'sale_adjustment')
        with localcontext() as context:
            context.prec = 50
            amount = new_amount - old_amount
        if amount:
            posting_amount(posting_kind, amount)
        before['consumptions'] = [{'id': row.pk, 'basis': row.basis_id, 'units': row.units, 'applied_quantity': quantity_text(row.applied_quantity)} for row in old_allocations]
        before['stock'] = {str(pk): {'quantity': quantity_text(row.quantity), 'unit': row.unit, 'revision': row.stock_revision} for pk, row in ingredients.items()}
        for pk, row in ingredients.items():
            if projected[pk] != row.quantity and row.stock_revision >= MAX_ACTIVE_UNITS:
                raise ValidationError('Stock revision range exhausted.')
        # Business writes begin only after ALL projected balances are valid.
        if sale is None:
            sale = Sale.objects.create(date=data['date'], notes=data.get('notes', ''), total_amount=new_amount,
                inventory_tracking='tracked', financial_tracking='ledger', revision=1, current_items=new_items)
            original_rows = SaleItem.objects.bulk_create([SaleItem(sale=sale, product_id=item['product'], quantity=item['quantity'], unit_price=Decimal(item['unit_price']), subtotal_amount=Decimal(item['subtotal'])) for item in new_items])
            original_ids = {item.product_id: item.pk for item in original_rows}
            new_items = [dict(item, id=original_ids[item['product']]) for item in new_items]
            sale.current_items = new_items
            sale.save(update_fields=['current_items', 'updated_at'])
        else:
            sale.notes = data.get('notes', sale.notes)
            sale.revision += 1
            if action != 'sale_cancel':
                sale.current_items = new_items
                sale.save(update_fields=['notes', 'revision', 'current_items', 'updated_at'])
        body_data = sale_data(sale)
        if action == 'sale_cancel':
            body_data['status'] = 'cancelled'
        body = {'success': True, 'data': body_data, 'message': 'Sale cancelled.' if action == 'sale_cancel' else 'Sale recorded.' if action == 'sale_create' else 'Sale updated.'}
        status = 201 if action == 'sale_create' else 200
        op = InventoryOperation.objects.create(actor=actor, client_key=key, action=action, sale=sale, request_fingerprint=fingerprint,
            reason=reason, before_snapshot=before, response_status=status, response_body=body)
        if action == 'sale_cancel':
            sale.status, sale.cancellation_operation = 'cancelled', op
            sale.save(update_fields=['notes', 'revision', 'status', 'cancellation_operation', 'updated_at'])
            body['data']['updated_at'] = sale.updated_at.isoformat()
            # Construction-only finalization, still inside this transaction.
            InventoryOperation.objects.filter(pk=op.pk).update(response_body=body)
        for basis in sorted(touched_bases.values(), key=lambda b: (b.pk is None, b.pk or 0)):
            if basis.pk:
                basis.save(update_fields=['allocated_units', 'active_units'])
            else:
                basis.save()
        for row in old_allocations:
            row.reversed_by = op
            row.save(update_fields=['reversed_by'])
        for basis, allocation, units in additions:
            SaleConsumption.objects.create(sale=sale, sale_revision=sale.revision, basis=basis, operation=op,
                allocation_start=allocation.start, units=units, applied_quantity=allocation.applied_quantity)
        for pk, row in ingredients.items():
            previous = row.quantity
            if row.ledger_started_at is None:
                row.ledger_started_at, row.ledger_opening_quantity = timezone.now(), previous
            row.quantity = projected[pk]
            if row.quantity != previous:
                row.stock_revision += 1
            row.save(update_fields=['quantity', 'stock_revision', 'ledger_opening_quantity', 'ledger_started_at', 'updated_at'])
            if row.quantity != previous:
                with localcontext() as context:
                    context.prec = 50
                    signed_delta = row.quantity - previous
                StockMovement.objects.create(operation=op, ingredient=row, stock_revision=row.stock_revision,
                    unit=row.unit, quantity_delta=signed_delta, balance_after=row.quantity)
        if amount:
            SaleFinancialEntry.objects.create(sale=sale, operation=op, sale_revision=sale.revision, kind=posting_kind,
                effective_date=sale.date if action == 'sale_create' else timezone.localdate(op.created_at), amount=amount)
        return CommandResult(body, status)

    try:
        return _run(actor, key, fingerprint, command, action)
    except ValueError as error:
        raise ValidationError({'inventory': str(error)}) from error


def adjust_stock(*, actor, key, ingredient_id, expected_revision, delta, reason):
    authorize_command(actor, 'stock_adjust')
    reason = reason.strip()
    if not reason or not delta:
        raise ValidationError('A nonzero delta and reason are required.')
    quantity_quanta(delta.copy_abs())
    fingerprint = intent_fingerprint({'action': 'stock_adjust', 'target': ingredient_id, 'expected_revision': expected_revision,
        'delta': format(delta, '.9f'), 'reason': reason, 'schema_version': 1})

    def command():
        try:
            row = Ingredient.objects.select_for_update().get(pk=ingredient_id)
        except Ingredient.DoesNotExist:
            raise NotFound('Ingredient not found.')
        replay = _replay(actor, key, fingerprint)
        if replay:
            return replay
        if row.stock_revision != expected_revision:
            raise Conflict('Stock revision is stale; reload before adjusting.')
        if row.stock_revision >= MAX_ACTIVE_UNITS:
            raise ValidationError('Stock revision range exhausted.')
        if row.unit not in UNITS:
            raise Conflict('Inventory unit is invalid; explicit reconciliation is required.')
        result = apply_deltas(row.quantity, [delta])
        for value in [row.quantity, delta, result]:
            validate_quantity_storage(value)
        before = {'quantity': quantity_text(row.quantity), 'unit': row.unit, 'stock_revision': row.stock_revision}
        body = {'success': True, 'data': {'id': row.pk, 'quantity': quantity_text(result), 'unit': row.unit, 'stock_revision': str(row.stock_revision + 1)}, 'message': 'Stock adjusted.'}
        op = InventoryOperation.objects.create(actor=actor, client_key=key, action='stock_adjust', ingredient=row,
            request_fingerprint=fingerprint, reason=reason, before_snapshot=before, response_status=200, response_body=body)
        if row.ledger_started_at is None:
            row.ledger_opening_quantity, row.ledger_started_at = row.quantity, timezone.now()
        row.quantity, row.stock_revision = result, row.stock_revision + 1
        row.save(update_fields=['quantity', 'stock_revision', 'ledger_opening_quantity', 'ledger_started_at', 'updated_at'])
        StockMovement.objects.create(operation=op, ingredient=row, stock_revision=row.stock_revision, unit=row.unit, quantity_delta=delta, balance_after=result)
        return CommandResult(body, 200)

    try:
        return _run(actor, key, fingerprint, command, 'stock_adjust')
    except ValueError as error:
        raise ValidationError({'inventory': str(error)}) from error
