"""New-schema API regressions: DEFINED, NOT EXECUTED before migration approval.

The earlier 1A.1 definitions/results remain in Git b87d36d/docs/phase1a.
Do not run a Django test runner until disposable migration execution is approved.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import ConsumptionBasis, InventoryOperation, Sale, SaleConsumption, SaleFinancialEntry, SaleItem, StockMovement
from sales.reporting import financial_summary


class SalesFixture:
    def setUp(self):
        self.user = User.objects.create_user(username='ledger-test')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        category = Category.objects.create(slug='ledger-test', name='Ledger test')
        self.product = Product.objects.create(name='Test donut', price='50', category=category)
        self.flour = Ingredient.objects.create(name='Test flour', quantity='20', unit='kg', cost_per_unit='60')
        self.milk = Ingredient.objects.create(name='Test milk', quantity='10', unit='l', cost_per_unit='90')
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=1)
        self.flour_line = RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.flour, quantity='2')
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.milk, quantity='1')

    def payload(self, quantity=1, price='50.00'):
        return {'date': '2026-11-09', 'notes': 'Original notes', 'sale_items': [{'product': self.product.pk, 'quantity': quantity, 'unit_price': price}]}

    def create(self, quantity=1, price='50.00', key=None, client=None):
        return (client or self.client).post('/api/sales/', self.payload(quantity, price), format='json', HTTP_IDEMPOTENCY_KEY=str(key or uuid4()))

    def existing(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        return response.data['data']['id']

    def edit(self, sale_id, data=None, key=None, revision=None, client=None):
        revision = Sale.objects.get(pk=sale_id).revision if revision is None else revision
        return (client or self.client).patch(f'/api/sales/{sale_id}/', data or self.payload(2), format='json', HTTP_IDEMPOTENCY_KEY=str(key or uuid4()), HTTP_IF_MATCH=f'"{revision}"')

    def cancel(self, sale_id, key=None, revision=None, client=None):
        revision = Sale.objects.get(pk=sale_id).revision if revision is None else revision
        return (client or self.client).delete(f'/api/sales/{sale_id}/', {'reason': 'Order cancelled by owner'}, format='json', HTTP_IDEMPOTENCY_KEY=str(key or uuid4()), HTTP_IF_MATCH=f'"{revision}"')

    def stock(self):
        return dict(Ingredient.objects.order_by('pk').values_list('pk', 'quantity'))

    def state(self):
        models = [Sale, SaleItem, Ingredient, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]
        return [list(model.objects.order_by('pk').values()) for model in models]


class SalesIntegrityTests(SalesFixture, TestCase):
    def test_successful_create_snapshots_submitted_historical_price(self):
        response = self.create(quantity=2, price='45.25')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['total_amount'], '90.50')
        self.assertEqual(SaleItem.objects.get().unit_price, Decimal('45.25'))
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('16'), self.milk.pk: Decimal('8')})
        self.assertEqual(SaleFinancialEntry.objects.get().amount, Decimal('90.50'))

    def test_invalid_creation_and_missing_identity_write_nothing(self):
        before = self.state()
        self.assertEqual(self.create(quantity=0).status_code, 400)
        self.assertEqual(self.client.post('/api/sales/', self.payload(), format='json').status_code, 400)
        self.assertEqual(self.state(), before)

    def test_invalid_edits_never_restore_stock(self):
        sale_id = self.existing()
        before = self.state()
        for _ in range(2):
            self.assertEqual(self.edit(sale_id, {'date': 'invalid'}).status_code, 400)
            self.assertEqual(self.state(), before)

    def test_insufficient_stock_rolls_back_all_records(self):
        before = self.state()
        self.assertEqual(self.create(quantity=100).status_code, 400)
        self.assertEqual(self.state(), before)

    def test_insufficient_edit_does_not_leave_restored_inventory(self):
        sale_id = self.existing()
        before = self.state()
        self.assertEqual(self.edit(sale_id, self.payload(100)).status_code, 400)
        self.assertEqual(self.state(), before)

    def test_successful_edit_retry_does_not_repeat_allocation(self):
        sale_id, key = self.existing(), uuid4()
        first = self.edit(sale_id, key=key, revision=1)
        before = self.state()
        repeated = self.edit(sale_id, key=key, revision=1)
        self.assertEqual(first.data, repeated.data)
        self.assertEqual(self.state(), before)

    def test_successful_retry_replays_once_and_conflicting_payload_is_rejected(self):
        key = uuid4()
        first, replay = self.create(key=key), self.create(key=key)
        self.assertEqual(first.data, replay.data)
        self.assertEqual(replay['Idempotency-Replayed'], 'true')
        self.assertEqual(self.create(quantity=2, key=key).status_code, 409)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(InventoryOperation.objects.count(), 1)

    def test_stale_edit_leaves_every_record_unchanged(self):
        sale_id = self.existing()
        self.assertEqual(self.edit(sale_id, revision=1).status_code, 200)
        before = self.state()
        self.assertEqual(self.edit(sale_id, self.payload(3), revision=1).status_code, 409)
        self.assertEqual(self.state(), before)

    def test_edits_preserve_original_items_and_total_instead_of_rewriting_history(self):
        sale_id = self.existing()
        original = list(SaleItem.objects.values())
        response = self.edit(sale_id, self.payload(3, '40.25'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['total_amount'], '120.75')
        self.assertEqual(Sale.objects.get(pk=sale_id).total_amount, Decimal('50'))
        self.assertEqual(list(SaleItem.objects.values()), original)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('14'))

    def test_price_only_edit_does_not_reallocate_inventory(self):
        sale_id = self.existing()
        old_stock, old_snapshots = self.stock(), list(SaleConsumption.objects.values())
        cursors = list(ConsumptionBasis.objects.values_list('pk', 'allocated_units'))
        self.assertEqual(self.edit(sale_id, self.payload(1, '45.25')).status_code, 200)
        self.assertEqual(self.stock(), old_stock)
        self.assertEqual(list(SaleConsumption.objects.values()), old_snapshots)
        self.assertEqual(list(ConsumptionBasis.objects.values_list('pk', 'allocated_units')), cursors)

    def test_quantity_edit_uses_new_recipe_but_retains_original_snapshot(self):
        sale_id = self.existing()
        original = SaleConsumption.objects.get(sale_id=sale_id, basis__ingredient=self.flour)
        self.flour_line.quantity = Decimal('3')
        self.flour_line.save()
        self.assertEqual(self.edit(sale_id).status_code, 200)
        original.refresh_from_db()
        self.assertEqual(original.applied_quantity, Decimal('2'))
        self.assertIsNotNone(original.reversed_by_id)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('14'))
        self.assertEqual(self.cancel(sale_id).status_code, 200)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20'))

    def test_recipe_change_and_removal_cannot_change_cancellation_credit(self):
        sale_id = self.existing()
        self.flour_line.quantity = Decimal('3')
        self.flour_line.save()
        self.recipe.delete()
        self.assertEqual(self.cancel(sale_id).status_code, 200)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('20'), self.milk.pk: Decimal('10')})
        self.assertEqual(Sale.objects.get(pk=sale_id).status, 'cancelled')
        self.assertEqual(SaleItem.objects.filter(sale_id=sale_id).count(), 1)

    def test_cancellation_retry_and_new_key_cannot_restore_twice(self):
        sale_id, key = self.existing(), uuid4()
        first = self.cancel(sale_id, key=key, revision=1)
        replay = self.cancel(sale_id, key=key, revision=1)
        self.assertEqual(first.data, replay.data)
        before = self.state()
        self.assertEqual(self.cancel(sale_id).status_code, 409)
        self.assertEqual(self.state(), before)
        self.assertEqual(InventoryOperation.objects.filter(sale_id=sale_id, action='sale_cancel').count(), 1)
        self.assertEqual(SaleFinancialEntry.objects.filter(sale_id=sale_id, kind='cancellation').count(), 1)
        self.assertFalse(Expense.objects.exists(), 'Cancellation must not invent a cash refund/expense')

    def test_database_cancel_uniqueness_is_independent_of_uuid(self):
        sale_id = self.existing()
        self.cancel(sale_id)
        with self.assertRaises(IntegrityError), transaction.atomic():
            InventoryOperation.objects.create(actor=self.user, client_key=uuid4(), action='sale_cancel', sale_id=sale_id, request_fingerprint='a' * 64, reason='duplicate', response_status=200, response_body={})

    def test_legacy_safeguards_do_not_create_consumption_or_financial_backfill(self):
        legacy = Sale.objects.create(date='2026-01-01', total_amount='50')
        SaleItem.objects.create(sale=legacy, product=self.product, quantity=1, unit_price=Decimal('50'))
        before = self.state()
        self.assertEqual(self.cancel(legacy.pk).status_code, 409)
        self.assertEqual(self.edit(legacy.pk).status_code, 409)
        self.assertEqual(self.state(), before)
        self.assertEqual(self.edit(legacy.pk, {'notes': 'Verified record retained'}).status_code, 200)
        self.assertFalse(SaleConsumption.objects.exists())
        self.assertFalse(SaleFinancialEntry.objects.exists())

    def test_fractional_exact_middle_cancellation_and_monotonic_cursor(self):
        self.recipe.yield_quantity = 3
        self.recipe.save()
        self.flour_line.quantity = Decimal('.01')
        self.flour_line.save()
        ids = [self.existing() for _ in range(3)]
        flour_basis = ConsumptionBasis.objects.get(ingredient=self.flour)
        amounts = list(SaleConsumption.objects.filter(basis=flour_basis).order_by('allocation_start').values_list('applied_quantity', flat=True))
        self.assertEqual(amounts, [Decimal('.003333333'), Decimal('.003333334'), Decimal('.003333333')])
        self.cancel(ids[1])
        self.assertEqual(self.stock()[self.flour.pk], Decimal('19.993333334'))
        flour_basis.refresh_from_db()
        self.assertEqual(flour_basis.allocated_units, 3)
        following = self.existing()
        flour_basis.refresh_from_db()
        self.assertEqual(flour_basis.allocated_units, 4)
        for sale_id in [ids[0], ids[2], following]:
            self.cancel(sale_id)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20'))

    def test_posting_date_and_legacy_source_have_no_double_count(self):
        legacy = Sale.objects.create(date='2026-11-09', total_amount='10')
        SaleItem.objects.create(sale=legacy, product=self.product, quantity=1, unit_price=Decimal('10'))
        sale_id = self.existing()
        with patch('sales.services.timezone.localdate', return_value=date(2026, 11, 10)):
            self.edit(sale_id, self.payload(1, '60.00'))
        with patch('sales.services.timezone.localdate', return_value=date(2026, 11, 11)):
            self.cancel(sale_id)
        self.assertEqual(financial_summary(date(2026, 11, 9), date(2026, 11, 9))['totals']['gross_sales'], '60.00')
        self.assertEqual(financial_summary(date(2026, 11, 11), date(2026, 11, 11))['totals']['signed_cancellations'], '-60.00')
        self.assertEqual(financial_summary(date(2026, 11, 9), date(2026, 11, 11))['totals']['net_sales'], '10.00')

    def test_legacy_report_source_is_disjoint_even_if_posting_exists(self):
        # Deliberately inconsistent ISOLATED fixture: reporting must never add
        # both sources. The documented reconciliation procedure must flag it.
        legacy = Sale.objects.create(date='2026-11-09', total_amount='10')
        operation = InventoryOperation.objects.create(actor=self.user, client_key=uuid4(), action='sale_create', sale=legacy, request_fingerprint='a' * 64, response_status=201, response_body={})
        SaleFinancialEntry.objects.create(sale=legacy, operation=operation, sale_revision=1, kind='gross_sale', effective_date='2026-11-09', amount=Decimal('10'))
        self.assertEqual(financial_summary(date(2026, 11, 9), date(2026, 11, 9))['totals']['net_sales'], '10.00')

    def test_failures_at_each_write_boundary_roll_back_the_entire_creation(self):
        for target in ['InventoryOperation', 'SaleConsumption', 'StockMovement', 'SaleFinancialEntry']:
            with self.subTest(target=target):
                before = self.state()
                with patch(f'sales.services.{target}.objects.create', side_effect=RuntimeError('Injected write failure')):
                    with self.assertRaises(RuntimeError):
                        self.create()
                self.assertEqual(self.state(), before)

    def test_failed_create_can_be_retried_with_same_identity(self):
        key = uuid4()
        with patch('sales.services.SaleFinancialEntry.objects.create', side_effect=RuntimeError('Injected posting failure')):
            with self.assertRaises(RuntimeError):
                self.create(key=key)
        self.assertFalse(Sale.objects.exists())
        self.assertEqual(self.create(key=key).status_code, 201)
        self.assertEqual(Sale.objects.count(), 1)

    def test_original_line_and_counter_write_failures_roll_back_creation(self):
        for target in ['sales.services.SaleItem.objects.bulk_create', 'sales.services.ConsumptionBasis.save']:
            before = self.state()
            with patch(target, side_effect=RuntimeError('Injected early failure')):
                with self.assertRaises(RuntimeError):
                    self.create()
            self.assertEqual(self.state(), before)

    def test_exception_after_actual_stock_write_rolls_back_everything(self):
        before, original_save = self.state(), Ingredient.save

        def save_then_fail(instance, *args, **kwargs):
            original_save(instance, *args, **kwargs)
            raise RuntimeError('Injected AFTER stock SQL write')

        with patch('sales.services.Ingredient.save', new=save_then_fail):
            with self.assertRaises(RuntimeError):
                self.create()
        self.assertEqual(self.state(), before)

    def test_failed_edit_and_cancellation_preserve_every_original_record(self):
        sale_id = self.existing()
        for action in [lambda: self.edit(sale_id), lambda: self.cancel(sale_id)]:
            before = self.state()
            with patch('sales.services.SaleFinancialEntry.objects.create', side_effect=RuntimeError('Injected posting failure')):
                with self.assertRaises(RuntimeError):
                    action()
            self.assertEqual(self.state(), before)

    def test_stock_adjustment_is_revision_checked_idempotent_and_audited(self):
        key = str(uuid4())
        path = f'/api/ingredients/{self.flour.pk}/adjustments/'
        payload = {'delta': '0.000000001', 'reason': 'Verified count correction'}
        first = self.client.post(path, payload, format='json', HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"0"')
        second = self.client.post(path, payload, format='json', HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"0"')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data, second.data)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20.000000001'))
        self.assertEqual(self.client.post(path, payload, format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"0"').status_code, 409)

    def test_direct_quantity_and_tracked_unit_changes_are_rejected(self):
        self.existing()
        self.assertEqual(self.client.patch(f'/api/ingredients/{self.flour.pk}/', {'quantity': '100'}, format='json').status_code, 409)
        self.assertEqual(self.client.patch(f'/api/ingredients/{self.flour.pk}/', {'unit': 'g'}, format='json').status_code, 409)


@skipUnless(connection.vendor == 'postgresql', 'Requires explicitly authorized disposable PostgreSQL migrations')
class SalesConcurrencyTests(SalesFixture, TransactionTestCase):
    def simultaneous(self, calls):
        start, pids = Barrier(len(calls), timeout=8), []

        def run(call):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET lock_timeout='8s'")
                    cursor.execute("SET statement_timeout='12s'")
                    cursor.execute('SELECT pg_backend_pid()')
                    pids.append(cursor.fetchone()[0])
                client = APIClient()
                client.force_authenticate(self.user)
                start.wait()
                return call(client)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(calls)) as pool:
            futures = [pool.submit(run, call) for call in calls]
            responses = [future.result(timeout=20) for future in futures]
        self.assertEqual(len(set(pids)), len(calls))
        return responses

    def test_competing_last_stock_sales(self):
        self.flour.quantity = Decimal('2')
        self.flour.save()
        responses = self.simultaneous([lambda c: self.create(client=c)] * 2)
        self.assertEqual(sorted(r.status_code for r in responses), [201, 400])
        self.assertEqual(Sale.objects.count(), 1)

    def test_duplicate_uuid_creates_one_complete_transaction(self):
        key = uuid4()
        responses = self.simultaneous([lambda c: self.create(client=c, key=key)] * 2)
        self.assertEqual([r.status_code for r in responses], [201, 201])
        self.assertEqual(responses[0].data, responses[1].data)
        self.assertEqual(InventoryOperation.objects.count(), 1)
        self.assertEqual(SaleFinancialEntry.objects.count(), 1)

    def test_stale_edits_cannot_overwrite_new_revision(self):
        sale_id = self.existing()
        responses = self.simultaneous([lambda c: self.edit(sale_id, self.payload(2), revision=1, client=c), lambda c: self.edit(sale_id, self.payload(3), revision=1, client=c)])
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])

    def test_cancellation_is_unique_across_different_request_keys(self):
        sale_id = self.existing()
        responses = self.simultaneous([lambda c: self.cancel(sale_id, revision=1, client=c)] * 2)
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        self.assertEqual(SaleFinancialEntry.objects.filter(kind='cancellation').count(), 1)

    def test_fractional_competing_sales_and_cancellations_conserve_stock(self):
        self.recipe.yield_quantity = 3
        self.recipe.save()
        self.flour_line.quantity = Decimal('.01')
        self.flour_line.save()
        responses = self.simultaneous([lambda c: self.create(client=c)] * 3)
        self.assertEqual([r.status_code for r in responses], [201, 201, 201])
        self.assertEqual(self.stock()[self.flour.pk], Decimal('19.99'))
        basis = ConsumptionBasis.objects.get(ingredient=self.flour)
        self.assertEqual(basis.allocated_units, 3)
        amounts = list(SaleConsumption.objects.filter(basis=basis).order_by('allocation_start').values_list('applied_quantity', flat=True))
        self.assertEqual(amounts, [Decimal('.003333333'), Decimal('.003333334'), Decimal('.003333333')])
        ids = [r.data['data']['id'] for r in responses]
        cancelled = self.simultaneous([lambda c, pk=pk: self.cancel(pk, revision=1, client=c) for pk in ids])
        self.assertEqual([r.status_code for r in cancelled], [200, 200, 200])
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20'))
        basis.refresh_from_db()
        self.assertEqual((basis.allocated_units, basis.active_units), (3, 0))

    def test_conflicting_payload_same_uuid_rolls_back_losing_request(self):
        key = uuid4()
        responses = self.simultaneous([lambda c: self.create(client=c, key=key), lambda c: self.create(client=c, key=key, quantity=2)])
        self.assertEqual(sorted(r.status_code for r in responses), [201, 409])
        sale = Sale.objects.get()
        self.assertEqual(self.stock()[self.flour.pk], Decimal('20') - Decimal(2) * sale.current_items[0]['quantity'])
        self.assertEqual(InventoryOperation.objects.count(), 1)

    def test_database_uuid_collision_with_disjoint_stock_rolls_back_loser(self):
        other = Product.objects.create(name='Independent donut', price='50', category=self.product.category)
        ingredient = Ingredient.objects.create(name='Independent stock', quantity='10', unit='kg', cost_per_unit='1')
        recipe = Recipe.objects.create(product=other, yield_quantity=1)
        RecipeIngredient.objects.create(recipe=recipe, ingredient=ingredient, quantity='1')
        key, insert_gate = uuid4(), Barrier(2, timeout=8)
        original_create = InventoryOperation.objects.create

        def collide(**kwargs):
            # Disjoint product/ingredient locks: force the DB unique-key race,
            # without parking a contender behind locks held by this barrier.
            insert_gate.wait()
            return original_create(**kwargs)

        payload = self.payload()
        payload['sale_items'][0]['product'] = other.pk
        with patch('sales.services.InventoryOperation.objects.create', side_effect=collide):
            responses = self.simultaneous([
                lambda c: self.create(client=c, key=key),
                lambda c: c.post('/api/sales/', payload, format='json', HTTP_IDEMPOTENCY_KEY=str(key)),
            ])
        self.assertEqual(sorted(r.status_code for r in responses), [201, 409])
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)
        self.assertEqual(InventoryOperation.objects.count(), 1)
        winner = Sale.objects.get().current_items[0]['product']
        self.assertEqual(self.stock()[self.flour.pk], Decimal('18') if winner == self.product.pk else Decimal('20'))
        self.assertEqual(self.stock()[ingredient.pk], Decimal('9') if winner == other.pk else Decimal('10'))

    def test_direct_adjustment_and_sale_follow_same_stock_lock(self):
        key = str(uuid4())
        responses = self.simultaneous([
            lambda c: self.create(client=c),
            lambda c: c.post(f'/api/ingredients/{self.flour.pk}/adjustments/', {'delta': '0.000000001', 'reason': 'Count correction'}, format='json', HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"0"'),
        ])
        self.assertEqual(responses[0].status_code, 201)
        self.assertIn(responses[1].status_code, [200, 409])
        expected = Decimal('18.000000001') if responses[1].status_code == 200 else Decimal('18')
        self.assertEqual(self.stock()[self.flour.pk], expected)
