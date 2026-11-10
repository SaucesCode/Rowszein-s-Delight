"""18 prior regression behaviors ported to approved identities/history retention.

Original definitions/evidence remain in b87d36d/docs/phase1a. Successful edits
now retain original lines, and DELETE now soft-cancels. Fault injection follows
the new service boundaries; rollback/stock/price assertions remain substantive.
"""
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
from django.test import TestCase
from ingredients.models import Ingredient
from sales.models import Sale, SaleItem, StockMovement
from sales import tests as base


class Phase1A1CompatibilityTests(base.SalesFixture, TestCase):
    def assert_empty(self):
        self.assertFalse(Sale.objects.exists())
        self.assertFalse(SaleItem.objects.exists())
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('20'), self.milk.pk: Decimal('10')})

    def fail_after_stock(self, ingredient_id):
        save = Ingredient.save

        def fail(instance, *args, **kwargs):
            save(instance, *args, **kwargs)
            if instance.pk == ingredient_id:
                raise RuntimeError('Injected after actual ingredient write')

        return patch.object(Ingredient, 'save', new=fail)

    def test_successful_create_preserves_historical_price_and_decimal_totals(self):
        self.product.price = Decimal('99')
        self.product.save()
        response = self.create(2, '45.25')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Sale.objects.get().total_amount, Decimal('90.50'))
        self.assertEqual(SaleItem.objects.get().unit_price, Decimal('45.25'))
        self.assertEqual(SaleItem.objects.get().subtotal_amount, Decimal('90.50'))
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('16'), self.milk.pk: Decimal('8')})

    def test_invalid_create_has_no_persistent_effects(self):
        self.assertEqual(self.create(0).status_code, 400)
        self.assert_empty()

    def test_repeated_invalid_patch_does_not_inflate_stock_or_change_sale(self):
        pk, before = self.existing(), None
        before = self.state()
        for _ in range(2):
            self.assertEqual(self.edit(pk, {'date': 'invalid'}).status_code, 400)
            self.assertEqual(self.state(), before)

    def test_invalid_put_nested_items_leaves_all_records_unchanged(self):
        pk = self.existing()
        before = self.state()
        response = self.client.put(f'/api/sales/{pk}/', self.payload(0), format='json', HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.state(), before)

    def test_invalid_update_after_recipe_change_does_not_restore_current_recipe(self):
        pk = self.existing()
        self.flour_line.quantity = Decimal('5')
        self.flour_line.save()
        before = self.state()
        self.assertEqual(self.edit(pk, {'date': 'invalid'}).status_code, 400)
        self.assertEqual(self.state(), before)

    def test_invalid_update_after_recipe_removal_leaves_records_unchanged(self):
        pk = self.existing()
        self.recipe.delete()
        before = self.state()
        self.assertEqual(self.edit(pk, {'date': 'invalid'}).status_code, 400)
        self.assertEqual(self.state(), before)

    def test_create_failure_after_item_insertion_rolls_back_parent_and_items(self):
        bulk = SaleItem.objects.bulk_create

        def fail(*args, **kwargs):
            bulk(*args, **kwargs)
            raise RuntimeError('Injected after original item insertion')

        with patch('sales.services.SaleItem.objects.bulk_create', side_effect=fail), self.assertRaises(RuntimeError):
            self.create()
        self.assert_empty()

    def test_create_failure_after_first_deduction_rolls_back_every_write(self):
        with self.fail_after_stock(self.flour.pk), self.assertRaises(RuntimeError):
            self.create()
        self.assert_empty()

    def test_create_failure_after_last_deduction_rolls_back_every_write(self):
        with self.fail_after_stock(self.milk.pk), self.assertRaises(RuntimeError):
            self.create()
        self.assert_empty()

    def test_failed_create_can_be_retried_without_residual_sale_or_stock_changes(self):
        key = uuid4()
        with self.fail_after_stock(self.flour.pk), self.assertRaises(RuntimeError):
            self.create(key=key)
        self.assert_empty()
        self.assertEqual(self.create(key=key).status_code, 201)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('18'), self.milk.pk: Decimal('9')})

    def test_response_serialization_failure_rolls_back_sale_and_inventory(self):
        with patch('sales.services.sale_data', side_effect=RuntimeError('Injected response construction failure')), self.assertRaises(RuntimeError):
            self.create()
        self.assert_empty()

    def test_successful_update_retains_original_items_and_reconciles_stock(self):
        pk = self.existing()
        originals = list(SaleItem.objects.values())
        response = self.edit(pk, self.payload(3, '40.25'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['total_amount'], '120.75')
        self.assertEqual(response.data['data']['sale_items'][0]['unit_price'], '40.25')
        self.assertEqual(Sale.objects.get(pk=pk).total_amount, Decimal('50'))
        self.assertEqual(list(SaleItem.objects.values()), originals)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('14'), self.milk.pk: Decimal('7')})

    def test_update_failure_during_stock_write_preserves_entire_state(self):
        pk = self.existing()
        before = self.state()
        with self.fail_after_stock(self.flour.pk), self.assertRaises(RuntimeError):
            self.edit(pk)
        self.assertEqual(self.state(), before)

    def test_update_failure_after_projection_write_preserves_original_items_and_prices(self):
        pk = self.existing()
        before = self.state()
        with patch('sales.services.InventoryOperation.objects.create', side_effect=RuntimeError('Injected after projection save')), self.assertRaises(RuntimeError):
            self.edit(pk, self.payload(2, '45.25'))
        self.assertEqual(self.state(), before)

    def test_update_failure_after_new_deduction_rolls_back_everything(self):
        pk = self.existing()
        before, create = self.state(), StockMovement.objects.create

        def fail(**kwargs):
            create(**kwargs)
            raise RuntimeError('Injected after stock movement insertion')

        with patch('sales.services.StockMovement.objects.create', side_effect=fail), self.assertRaises(RuntimeError):
            self.edit(pk)
        self.assertEqual(self.state(), before)

    def test_soft_delete_restores_stock_and_retry_cannot_restore_again(self):
        pk, key = self.existing(), uuid4()
        originals = list(SaleItem.objects.values())
        self.assertEqual(self.cancel(pk, key=key, revision=1).status_code, 200)
        before = self.state()
        self.assertEqual(self.cancel(pk, key=key, revision=1).status_code, 200)
        self.assertEqual(self.cancel(pk).status_code, 409)
        self.assertEqual(self.state(), before)
        self.assertEqual(Sale.objects.get(pk=pk).status, 'cancelled')
        self.assertEqual(list(SaleItem.objects.values()), originals)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('20'), self.milk.pk: Decimal('10')})

    def test_cancellation_failure_during_restoration_rolls_back_partial_credits(self):
        pk = self.existing()
        before = self.state()
        with self.fail_after_stock(self.flour.pk), self.assertRaises(RuntimeError):
            self.cancel(pk)
        self.assertEqual(self.state(), before)

    def test_cancellation_failure_after_status_save_restores_every_record(self):
        pk = self.existing()
        before, save = self.state(), Sale.save

        def fail(instance, *args, **kwargs):
            save(instance, *args, **kwargs)
            if instance.status == 'cancelled':
                raise RuntimeError('Injected after actual cancellation status save')

        with patch.object(Sale, 'save', new=fail), self.assertRaises(RuntimeError):
            self.cancel(pk)
        self.assertEqual(self.state(), before)
