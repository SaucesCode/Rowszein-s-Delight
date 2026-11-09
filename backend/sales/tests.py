"""Desired-behavior regressions for the schema-free Phase 1A package.

These verify validation and rollback, not historical consumption, durable
idempotency, precision changes, or PostgreSQL concurrency guarantees.
"""
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem


class SaleTransactionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user(username="transaction-test"))
        category = Category.objects.create(slug="transaction-test", name="Transaction test")
        self.product = Product.objects.create(name="Test donut", price="50.00", category=category)
        self.flour = Ingredient.objects.create(name="Test flour", quantity="20.00", unit="kg", cost_per_unit="60.00")
        self.milk = Ingredient.objects.create(name="Test milk", quantity="10.00", unit="l", cost_per_unit="90.00")
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=1)
        self.flour_line = RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.flour, quantity="2.00")
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.milk, quantity="1.00")

    def payload(self, quantity=1, price="50.00"):
        return {
            "date": "2026-11-09",
            "notes": "Original notes",
            "sale_items": [{"product": self.product.pk, "quantity": quantity, "unit_price": price}],
        }

    def create_sale(self, **kwargs):
        return self.client.post("/api/sales/", self.payload(**kwargs), format="json")

    def existing_sale(self):
        response = self.create_sale()
        self.assertEqual(response.status_code, 201)
        return response.data["data"]["id"]

    def inventory(self):
        return dict(Ingredient.objects.order_by("pk").values_list("pk", "quantity"))

    def state(self):
        """Include IDs, timestamps, historical prices and all persisted item fields."""
        return (
            list(Sale.objects.order_by("pk").values()),
            list(SaleItem.objects.order_by("pk").values()),
            list(Ingredient.objects.order_by("pk").values()),
        )

    def assert_empty_sale_and_original_stock(self):
        self.assertFalse(Sale.objects.exists())
        self.assertFalse(SaleItem.objects.exists())
        self.assertEqual(self.inventory(), {self.flour.pk: Decimal("20.00"), self.milk.pk: Decimal("10.00")})

    def fail_after_ingredient_write(self, ingredient_id):
        original_save = Ingredient.save

        def save_then_fail(instance, *args, **kwargs):
            original_save(instance, *args, **kwargs)
            if instance.pk == ingredient_id:
                raise RuntimeError("Injected failure after an ingredient write")

        return patch.object(Ingredient, "save", new=save_then_fail)

    def test_successful_create_preserves_historical_price_and_decimal_totals(self):
        self.product.price = Decimal("99.00")
        self.product.save()
        response = self.create_sale(quantity=2, price="45.25")
        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get()
        item = sale.sale_items.get()
        self.assertEqual(sale.total_amount, Decimal("90.50"))
        self.assertEqual(item.unit_price, Decimal("45.25"))
        self.assertEqual(item.subtotal_amount, Decimal("90.50"))
        self.assertEqual(self.inventory(), {self.flour.pk: Decimal("16.00"), self.milk.pk: Decimal("8.00")})

    def test_invalid_create_has_no_persistent_effects(self):
        response = self.create_sale(quantity=0)
        self.assertEqual(response.status_code, 400)
        self.assert_empty_sale_and_original_stock()

    def test_repeated_invalid_patch_does_not_inflate_stock_or_change_sale(self):
        sale_id = self.existing_sale()
        before = self.state()
        for _ in range(2):
            response = self.client.patch(f"/api/sales/{sale_id}/", {"date": "invalid"}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.state(), before)

    def test_invalid_put_nested_items_leaves_all_records_unchanged(self):
        sale_id = self.existing_sale()
        before = self.state()
        response = self.client.put(f"/api/sales/{sale_id}/", self.payload(quantity=0), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.state(), before)

    def test_invalid_update_after_recipe_change_does_not_restore_current_recipe(self):
        sale_id = self.existing_sale()
        self.flour_line.quantity = Decimal("5.00")
        self.flour_line.save()
        before = self.state()
        response = self.client.patch(f"/api/sales/{sale_id}/", {"date": "invalid"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.state(), before)

    def test_invalid_update_after_recipe_removal_leaves_records_unchanged(self):
        sale_id = self.existing_sale()
        self.recipe.delete()
        before = self.state()
        response = self.client.patch(f"/api/sales/{sale_id}/", {"date": "invalid"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.state(), before)

    def test_create_failure_after_item_insertion_rolls_back_parent_and_items(self):
        original_bulk_create = SaleItem.objects.bulk_create

        def insert_then_fail(*args, **kwargs):
            original_bulk_create(*args, **kwargs)
            raise RuntimeError("Injected failure after item insertion")

        with patch("sales.serializers.SaleItem.objects.bulk_create", side_effect=insert_then_fail):
            with self.assertRaises(RuntimeError):
                self.create_sale()
        self.assert_empty_sale_and_original_stock()

    def test_create_failure_after_first_deduction_rolls_back_every_write(self):
        with self.fail_after_ingredient_write(self.flour.pk):
            with self.assertRaises(RuntimeError):
                self.create_sale()
        self.assert_empty_sale_and_original_stock()

    def test_create_failure_after_last_deduction_rolls_back_every_write(self):
        with self.fail_after_ingredient_write(self.milk.pk):
            with self.assertRaises(RuntimeError):
                self.create_sale()
        self.assert_empty_sale_and_original_stock()

    def test_failed_create_can_be_retried_without_residual_sale_or_stock_changes(self):
        with self.fail_after_ingredient_write(self.flour.pk):
            with self.assertRaises(RuntimeError):
                self.create_sale()
        self.assert_empty_sale_and_original_stock()
        self.assertEqual(self.create_sale().status_code, 201)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)
        self.assertEqual(self.inventory(), {self.flour.pk: Decimal("18.00"), self.milk.pk: Decimal("9.00")})

    def test_response_serialization_failure_rolls_back_sale_and_inventory(self):
        with patch("sales.serializers.SaleSerializer.to_representation", side_effect=RuntimeError("Injected response failure")):
            with self.assertRaises(RuntimeError):
                self.create_sale()
        self.assert_empty_sale_and_original_stock()

    def test_successful_update_replaces_items_and_reconciles_unchanged_recipe(self):
        sale_id = self.existing_sale()
        response = self.client.put(f"/api/sales/{sale_id}/", self.payload(quantity=3, price="40.25"), format="json")
        self.assertEqual(response.status_code, 200)
        sale = Sale.objects.get(pk=sale_id)
        self.assertEqual(sale.total_amount, Decimal("120.75"))
        self.assertEqual(sale.sale_items.get().unit_price, Decimal("40.25"))
        self.assertEqual(self.inventory(), {self.flour.pk: Decimal("14.00"), self.milk.pk: Decimal("7.00")})

    def test_update_failure_after_restore_rolls_back_stock_and_preserves_sale(self):
        sale_id = self.existing_sale()
        before = self.state()
        with self.fail_after_ingredient_write(self.flour.pk):
            with self.assertRaises(RuntimeError):
                self.client.put(f"/api/sales/{sale_id}/", self.payload(quantity=2), format="json")
        self.assertEqual(self.state(), before)

    def test_update_failure_after_replacing_items_restores_original_items_and_prices(self):
        sale_id = self.existing_sale()
        before = self.state()
        original_bulk_create = SaleItem.objects.bulk_create

        def replace_then_fail(*args, **kwargs):
            original_bulk_create(*args, **kwargs)
            raise RuntimeError("Injected failure after replacing items")

        with patch("sales.serializers.SaleItem.objects.bulk_create", side_effect=replace_then_fail):
            with self.assertRaises(RuntimeError):
                self.client.put(f"/api/sales/{sale_id}/", self.payload(quantity=2, price="45.25"), format="json")
        self.assertEqual(self.state(), before)

    def test_update_failure_after_new_deduction_rolls_back_restore_and_replacement(self):
        sale_id = self.existing_sale()
        before = self.state()
        from sales.services import deduct_inventory_for_sale

        def deduct_then_fail(sale):
            deduct_inventory_for_sale(sale)
            raise RuntimeError("Injected failure after replacement deduction")

        with patch("sales.views.deduct_inventory_for_sale", side_effect=deduct_then_fail):
            with self.assertRaises(RuntimeError):
                self.client.put(f"/api/sales/{sale_id}/", self.payload(quantity=2), format="json")
        self.assertEqual(self.state(), before)

    def test_successful_delete_restores_unchanged_recipe_and_retry_cannot_restore_again(self):
        sale_id = self.existing_sale()
        self.assertEqual(self.client.delete(f"/api/sales/{sale_id}/").status_code, 200)
        self.assert_empty_sale_and_original_stock()
        self.assertEqual(self.client.delete(f"/api/sales/{sale_id}/").status_code, 404)
        self.assert_empty_sale_and_original_stock()

    def test_delete_failure_during_restoration_rolls_back_partial_credits(self):
        sale_id = self.existing_sale()
        before = self.state()
        with self.fail_after_ingredient_write(self.flour.pk):
            with self.assertRaises(RuntimeError):
                self.client.delete(f"/api/sales/{sale_id}/")
        self.assertEqual(self.state(), before)

    def test_delete_failure_after_deletion_restores_sale_items_and_stock(self):
        sale_id = self.existing_sale()
        before = self.state()
        original_delete = Sale.delete

        def delete_then_fail(instance, *args, **kwargs):
            original_delete(instance, *args, **kwargs)
            raise RuntimeError("Injected failure after sale deletion")

        with patch.object(Sale, "delete", new=delete_then_fail):
            with self.assertRaises(RuntimeError):
                self.client.delete(f"/api/sales/{sale_id}/")
        self.assertEqual(self.state(), before)
