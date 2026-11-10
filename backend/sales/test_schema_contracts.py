"""Metadata-only constraints; these do NOT validate a migrated database."""
from django.db.models.deletion import PROTECT
from django.test import SimpleTestCase
from sales.models import InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry, Sale, SaleItem
from ingredients.models import Ingredient


class SchemaContractTests(SimpleTestCase):
    def test_five_concrete_models_have_protected_foreign_keys(self):
        for model in [InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]:
            for field in model._meta.fields:
                if field.is_relation:
                    self.assertIs(field.remote_field.on_delete, PROTECT)

    def test_cancellation_uniqueness_does_not_depend_on_request_key(self):
        op = {constraint.name: constraint for constraint in InventoryOperation._meta.constraints}
        finance = {constraint.name: constraint for constraint in SaleFinancialEntry._meta.constraints}
        self.assertEqual(op['invop_sale_cancel_once'].fields, ('sale',))
        self.assertEqual(finance['finance_cancel_once'].fields, ('sale',))
        self.assertIsNotNone(op['invop_sale_cancel_once'].condition)

    def test_identity_and_stock_revision_unique_constraints_exist(self):
        op = {constraint.name: constraint for constraint in InventoryOperation._meta.constraints}
        movement = {constraint.name: constraint for constraint in StockMovement._meta.constraints}
        self.assertEqual(op['invop_actor_key_unique'].fields, ('actor', 'client_key'))
        self.assertEqual(movement['movement_ing_rev_unique'].fields, ('ingredient', 'stock_revision'))

    def test_stock_and_money_precision_are_distinct(self):
        self.assertEqual(Ingredient._meta.get_field('quantity').decimal_places, 9)
        self.assertEqual(SaleConsumption._meta.get_field('applied_quantity').decimal_places, 9)
        self.assertEqual(SaleFinancialEntry._meta.get_field('amount').decimal_places, 2)

    def test_monotonic_cursor_is_separate_from_active_count(self):
        self.assertIsNotNone(ConsumptionBasis._meta.get_field('allocated_units'))
        self.assertIsNotNone(ConsumptionBasis._meta.get_field('active_units'))

    def test_existing_sale_items_uniqueness_and_legacy_defaults_are_preserved(self):
        self.assertEqual(SaleItem._meta.unique_together, (('sale', 'product'),))
        self.assertEqual(Sale._meta.get_field('inventory_tracking').default, 'legacy_unknown')
        self.assertEqual(Sale._meta.get_field('financial_tracking').default, 'legacy_source')

    def test_new_records_cannot_be_deleted_through_model_method(self):
        from django.core.exceptions import ValidationError
        for model in [InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]:
            with self.assertRaises(ValidationError):
                model().delete()
