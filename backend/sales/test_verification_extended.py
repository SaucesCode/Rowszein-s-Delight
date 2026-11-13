"""Additional real-DB constraints, reconciliation and competing workflows."""
from datetime import date
from decimal import Decimal, localcontext
from random import Random
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import time
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import connection, connections, IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from accounts.session_fixtures import SessionClient
from accounts.models import User

from ingredients.models import Ingredient
from products.models import Product
from recipes.models import Recipe, RecipeIngredient
from sales import tests as base
from sales.models import Sale, SaleItem, ConsumptionBasis, SaleConsumption, StockMovement, InventoryOperation, SaleFinancialEntry
from sales.reporting import financial_summary
from sales.services import current_items, item_total


def assert_reconciled(test):
    """Read exact snapshots/movements, never reconstruct with current recipes."""
    with localcontext() as context:
        context.prec = 50
        for ingredient in Ingredient.objects.filter(ledger_started_at__isnull=False):
            balance, revision = ingredient.ledger_opening_quantity, 0
            for movement in ingredient.movements.order_by('stock_revision'):
                revision += 1
                test.assertEqual(movement.stock_revision, revision)
                test.assertEqual(movement.unit, ingredient.unit)
                test.assertIsNotNone(movement.operation.client_key)
                balance += movement.quantity_delta
                test.assertGreaterEqual(balance, 0)
                test.assertEqual(movement.balance_after, balance)
            test.assertEqual((balance, revision), (ingredient.quantity, ingredient.stock_revision))
        for basis in ConsumptionBasis.objects.all():
            cursor, active = 0, 0
            for snapshot in basis.consumptions.order_by('allocation_start'):
                test.assertEqual(snapshot.allocation_start, cursor)
                cursor += snapshot.units
                if snapshot.reversed_by_id is None:
                    active += snapshot.units
            test.assertEqual((cursor, active), (basis.allocated_units, basis.active_units))
        for operation in InventoryOperation.objects.exclude(action='stock_adjust'):
            expected = {}
            for row in operation.reversed_consumptions.select_related('basis'):
                key = row.basis.ingredient_id
                expected[key] = expected.get(key, Decimal(0)) + row.applied_quantity
            for row in operation.consumptions.select_related('basis'):
                key = row.basis.ingredient_id
                expected[key] = expected.get(key, Decimal(0)) - row.applied_quantity
            expected = {key: value for key, value in expected.items() if value}
            actual = dict(operation.movements.values_list('ingredient_id', 'quantity_delta'))
            test.assertEqual(actual, expected)
        for sale in Sale.objects.filter(financial_tracking='ledger'):
            postings = list(sale.financial_entries.all())
            test.assertEqual(sum(p.kind == 'gross_sale' for p in postings), 1)
            total = sum((p.amount for p in postings), Decimal(0))
            test.assertEqual(total, item_total(current_items(sale)) if sale.status == 'recorded' else Decimal(0))
            cancellations = [p for p in postings if p.kind == 'cancellation']
            test.assertEqual(len(cancellations), int(sale.status == 'cancelled'))
            if cancellations:
                test.assertEqual(cancellations[0].operation_id, sale.cancellation_operation_id)
                test.assertFalse(sale.consumptions.filter(reversed_by__isnull=True).exists())


class ExtendedIntegrityTests(base.SalesFixture, TestCase):
    def test_initial_quantity_is_exact_or_rejected_before_storage(self):
        response = self.client.post('/api/ingredients/', {'name': 'Storage precision fixture', 'quantity': '1000000.000000001', 'unit': 'g', 'cost_per_unit': '1.00'}, format='json')
        if connection.vendor == 'sqlite':
            self.assertEqual(response.status_code, 400)
            self.assertFalse(Ingredient.objects.filter(name='Storage precision fixture').exists())
        else:
            self.assertEqual(response.status_code, 201)
            self.assertEqual(Ingredient.objects.get(name='Storage precision fixture').quantity, Decimal('1000000.000000001'))

    def test_adjustment_result_is_exact_or_rejected_before_storage(self):
        self.flour.quantity = Decimal('1000000')
        self.flour.save()
        before = self.state()
        response = self.client.post(f'/api/ingredients/{self.flour.pk}/adjustments/', {'delta': '0.000000001', 'reason': 'One quantum at large balance'}, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"0"')
        if connection.vendor == 'sqlite':
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.state(), before)
        else:
            self.assertEqual(response.status_code, 200)
            self.assertEqual(Ingredient.objects.get(pk=self.flour.pk).quantity, Decimal('1000000.000000001'))

    def assert_db_rejects(self, callback):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                callback()
                connection.check_constraints()

    def test_actual_checks_unique_keys_and_foreign_keys(self):
        args = dict(actor=self.user, client_key=uuid4(), action='stock_adjust', ingredient=self.flour,
                    reason='Constraint fixture', request_fingerprint='a' * 64, response_status=200, response_body={})
        operation = InventoryOperation.objects.create(**args)
        self.assert_db_rejects(lambda: InventoryOperation.objects.create(**args))
        for changes in [{'action': 'invented'}, {'reason': ''}, {'request_fingerprint': 'not-a-hash'},
                        {'response_status': 201}, {'ingredient': None}, {'schema_version': 2}]:
            with self.subTest(changes=changes):
                self.assert_db_rejects(lambda: InventoryOperation.objects.create(**dict(args, client_key=uuid4(), **changes)))
        self.assert_db_rejects(lambda: InventoryOperation.objects.create(actor=self.user, client_key=uuid4(), action='sale_update', sale_id=999999999, request_fingerprint='a' * 64, response_status=200, response_body={}))
        self.assert_db_rejects(lambda: Ingredient.objects.filter(pk=self.flour.pk).update(quantity=Decimal('-1')))
        self.assert_db_rejects(lambda: Ingredient.objects.filter(pk=self.flour.pk).update(stock_revision=1))
        self.assert_db_rejects(lambda: ConsumptionBasis.objects.create(product=self.product, ingredient=self.flour, unit='kg', batch_quantity=Decimal('.01'), yield_quantity=2147483647))
        self.assert_db_rejects(lambda: ConsumptionBasis.objects.create(product=self.product, ingredient=self.flour, unit='kg', batch_quantity=Decimal('.01'), yield_quantity=3, allocated_units=1, active_units=2))
        self.assert_db_rejects(lambda: StockMovement.objects.create(operation=operation, ingredient=self.flour, stock_revision=1, unit='kg', quantity_delta=0, balance_after=20))

        pk = self.existing()
        self.assertEqual(self.cancel(pk).status_code, 200)

        def duplicate_financial_cancellation():
            op = InventoryOperation.objects.create(actor=self.user, client_key=uuid4(), action='sale_update', sale_id=pk, request_fingerprint='b' * 64, response_status=200, response_body={})
            SaleFinancialEntry.objects.create(sale_id=pk, operation=op, sale_revision=3, kind='cancellation', effective_date=date(2026, 11, 10), amount=Decimal('-50'))

        self.assert_db_rejects(duplicate_financial_cancellation)

    def test_protected_history_and_immutable_quantities(self):
        pk = self.existing()
        snapshot = SaleConsumption.objects.filter(sale_id=pk).first()
        before = snapshot.applied_quantity
        snapshot.applied_quantity += Decimal('.000000001')
        with self.assertRaises(ValidationError):
            snapshot.save()
        snapshot.refresh_from_db()
        self.assertEqual(snapshot.applied_quantity, before)
        with self.assertRaises(ProtectedError):
            self.product.delete()
        before = self.state()
        self.assertEqual(self.client.delete(f'/api/products/{self.product.pk}/').status_code, 409)
        self.assertEqual(self.state(), before)
        with self.assertRaises(ProtectedError):
            self.flour.delete()
        with self.assertRaises(ProtectedError):
            self.user.delete()
        self.assertEqual(self.client.delete(f'/api/ingredients/{self.flour.pk}/').status_code, 409)
        self.assertEqual(self.cancel(pk).status_code, 200)
        assert_reconciled(self)
        unused = Product.objects.create(name='Unused deletion fixture', price=Decimal('1'), category=self.product.category)
        self.assertEqual(self.client.delete(f'/api/products/{unused.pk}/').status_code, 200)
        self.assertFalse(Product.objects.filter(pk=unused.pk).exists())

    def test_gross_adjustment_cancellation_dates_and_no_refund(self):
        pk = self.existing()
        with patch('sales.services.timezone.localdate', return_value=date(2026, 11, 10)):
            self.assertEqual(self.edit(pk, self.payload(3, '60.00')).status_code, 200)
        with patch('sales.services.timezone.localdate', return_value=date(2026, 11, 11)):
            self.assertEqual(self.cancel(pk).status_code, 200)
        expected = [('2026-11-09', '50.00'), ('2026-11-10', '130.00'), ('2026-11-11', '-180.00')]
        for day, net in expected:
            parsed = date.fromisoformat(day)
            self.assertEqual(financial_summary(parsed, parsed)['totals']['net_sales'], net)
        totals = financial_summary(date(2026, 11, 9), date(2026, 11, 11))['totals']
        self.assertEqual((totals['gross_sales'], totals['sales_adjustments'], totals['signed_cancellations'], totals['cancellation_amount'], totals['net_sales']), ('50.00', '130.00', '-180.00', '180.00', '0.00'))
        self.assertEqual(financial_summary(date(2026, 11, 9), date(2026, 11, 11))['refund_status'], 'not_tracked')
        assert_reconciled(self)

    def test_deterministic_lifecycle_reconciles_after_every_operation(self):
        self.recipe.yield_quantity = 3
        self.recipe.save()
        self.flour_line.quantity = Decimal('.01')
        self.flour_line.save()
        RecipeIngredient.objects.filter(recipe=self.recipe, ingredient=self.milk).update(quantity=Decimal('.01'))
        rng, active, old_quantities = Random(20261109), [], {}
        for _ in range(60):
            action = rng.randrange(3)
            if active and action == 0:
                pk = active.pop(rng.randrange(len(active)))
                self.assertEqual(self.cancel(pk).status_code, 200)
            elif active and action == 1:
                pk = rng.choice(active)
                self.assertEqual(self.edit(pk, self.payload(rng.randint(1, 3), '45.25')).status_code, 200)
            else:
                response = self.create(quantity=rng.randint(1, 3))
                self.assertEqual(response.status_code, 201)
                active.append(response.data['data']['id'])
            for row in SaleConsumption.objects.all():
                if row.pk in old_quantities:
                    self.assertEqual(row.applied_quantity, old_quantities[row.pk])
                old_quantities[row.pk] = row.applied_quantity
            assert_reconciled(self)
        for pk in active:
            self.assertEqual(self.cancel(pk).status_code, 200)
        assert_reconciled(self)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('20'), self.milk.pk: Decimal('10')})

    def test_frontend_compatibility_read_endpoints_and_validation(self):
        pk = self.existing()
        for path in ['/api/sales/', f'/api/sales/{pk}/', '/api/dashboard/', '/api/sales/financial-summary/', '/api/ingredients/']:
            self.assertEqual(self.client.get(path).status_code, 200, path)
        self.assertEqual(self.client.get('/api/sales/financial-summary/?date_from=invalid').status_code, 400)
        self.assertEqual(self.client.get('/api/dashboard/?date_from=2026-12-31&date_to=2026-01-01').status_code, 400)
        before = self.state()
        self.assertEqual(self.edit(pk, {'date': '2020-01-01'}).status_code, 409)
        self.assertEqual(self.state(), before)

    @skipUnless(connection.vendor == 'postgresql', 'SQLite numeric storage cannot establish full PostgreSQL Decimal(20,9) precision')
    def test_postgresql_maximum_precision_roundtrips_without_lost_quanta(self):
        row = Ingredient.objects.create(name='Precision boundary fixture', quantity=Decimal('99999999999.999999998'), unit='g', cost_per_unit=Decimal('1'))
        row.refresh_from_db()
        self.assertEqual(row.quantity, Decimal('99999999999.999999998'))
        response = self.client.post(f'/api/ingredients/{row.pk}/adjustments/', {'delta': '0.000000001', 'reason': 'Last representable quantum'}, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"0"')
        self.assertEqual(response.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.quantity, Decimal('99999999999.999999999'))
        before = self.state()
        response = self.client.post(f'/api/ingredients/{row.pk}/adjustments/', {'delta': '0.000000001', 'reason': 'Must reject overflow'}, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.state(), before)
        assert_reconciled(self)


@skipUnless(connection.vendor == 'postgresql', 'Requires real independent PostgreSQL transactions')
class ExtendedConcurrencyTests(base.SalesFixture, TransactionTestCase):
    simultaneous = base.SalesConcurrencyTests.simultaneous

    def test_two_operators_compete_for_last_stock(self):
        self.flour.quantity = Decimal('2')
        self.flour.save()
        other = User.objects.create_user(username='second-operator', role='admin')

        def second(client):
            client.force_authenticate(other)
            return self.create(client=client)

        responses = self.simultaneous([lambda c: self.create(client=c), second])
        self.assertEqual(sorted(r.status_code for r in responses), [201, 400])
        assert_reconciled(self)

    def test_real_ingredient_lock_wait_is_observed_then_commits(self):
        ready, worker_pid = Event(), []

        def contender():
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout='8s'")
                    cursor.execute("SET statement_timeout='12s'")
                    cursor.execute('SELECT pg_backend_pid()')
                    worker_pid.append(cursor.fetchone()[0])
                client = SessionClient()
                client.force_authenticate(self.user)
                ready.set()
                return self.create(client=client)
            finally:
                connections.close_all()

        observed = None
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                Ingredient.objects.select_for_update().get(pk=self.flour.pk)
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_backend_pid()')
                    holder = cursor.fetchone()[0]
                future = pool.submit(contender)
                self.assertTrue(ready.wait(3))
                deadline = time.monotonic() + 3
                while time.monotonic() < deadline:
                    with connection.cursor() as cursor:
                        cursor.execute('SELECT pg_stat_clear_snapshot()')
                        cursor.execute('SELECT wait_event_type,pg_blocking_pids(pid) FROM pg_stat_activity WHERE pid=%s', [worker_pid[0]])
                        observed = cursor.fetchone()
                    if observed and observed[0] == 'Lock' and holder in observed[1]:
                        break
                    time.sleep(.02)
                self.assertIsNotNone(observed)
                self.assertEqual(observed[0], 'Lock')
                self.assertIn(holder, observed[1])
            response = future.result(timeout=15)
        self.assertEqual(response.status_code, 201)
        print(f'Observed lock wait: holder_pid={holder}, contender_pid={worker_pid[0]}, wait={observed}', flush=True)
        assert_reconciled(self)

    def test_cancellation_competing_with_edit(self):
        pk = self.existing()
        responses = self.simultaneous([lambda c: self.cancel(pk, revision=1, client=c), lambda c: self.edit(pk, self.payload(2), revision=1, client=c)])
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        assert_reconciled(self)

    def test_recipe_change_competing_with_sale(self):
        responses = self.simultaneous([
            lambda c: self.create(client=c),
            lambda c: c.patch(f'/api/recipes/{self.recipe.pk}/', {'recipe_ingredients': [{'ingredient': self.flour.pk, 'quantity': '3.00'}, {'ingredient': self.milk.pk, 'quantity': '1.00'}]}, format='json'),
        ])
        self.assertEqual([r.status_code for r in responses], [201, 200])
        quantity = SaleConsumption.objects.get(basis__ingredient=self.flour).applied_quantity
        self.assertIn(quantity, [Decimal('2'), Decimal('3')])
        pk = responses[0].data['data']['id']
        self.assertEqual(self.cancel(pk).status_code, 200)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20'))
        assert_reconciled(self)

    def test_multiple_products_and_ingredients_in_opposite_request_orders(self):
        other = Product.objects.create(name='Opposite ordering fixture', price='10', category=self.product.category)
        recipe = Recipe.objects.create(product=other, yield_quantity=1)
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.milk, quantity='1')
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.flour, quantity='1')
        first = self.payload()
        first['sale_items'].append({'product': other.pk, 'quantity': 1, 'unit_price': '10.00'})
        second = dict(first, sale_items=list(reversed(first['sale_items'])))
        responses = self.simultaneous([
            lambda c: c.post('/api/sales/', first, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4())),
            lambda c: c.post('/api/sales/', second, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4())),
        ])
        self.assertEqual([r.status_code for r in responses], [201, 201])
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('14'), self.milk.pk: Decimal('6')})
        assert_reconciled(self)
