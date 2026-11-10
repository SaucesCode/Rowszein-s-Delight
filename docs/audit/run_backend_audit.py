"""Reproduce existing behavior, without fixing it. Green probes are NOT fixed bugs.

Run from the repository root: python docs/audit/run_backend_audit.py
Uses only an in-memory SQLite test database. PostgreSQL concurrency is not tested.
"""
import os
import sys
sys.dont_write_bytecode = True
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ["DJANGO_SETTINGS_MODULE"] = "audit_settings"
import django
django.setup()

from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test import TransactionTestCase
from django.test.runner import DiscoverRunner
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem
from sales.services import deduct_inventory_for_sale


class ExistingBehaviorAudit(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="audit-local", password="local-only")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.category = Category.objects.first()
        self.product = Product.objects.create(name="Audit donut", price="50", category=self.category)
        self.ingredient = Ingredient.objects.create(name="Audit flour", quantity="10", unit="kg", cost_per_unit="60")
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=1)
        self.line = RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.ingredient, quantity="2")

    def sale(self, quantity=1, day="2026-11-09"):
        return self.client.post("/api/sales/", {"date": day, "sale_items": [{"product": self.product.pk, "quantity": quantity, "unit_price": "50.00"}]}, format="json")

    def stock(self):
        self.ingredient.refresh_from_db()
        return self.ingredient.quantity

    def test_baseline_valid_sale_totals_and_deduction(self):
        response = self.sale(2)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data["data"]["total_amount"]), Decimal("100"))
        self.assertEqual(self.stock(), Decimal("6"))

    def test_baseline_api_rejects_negative_ingredient_cost(self):
        response = self.client.patch(f"/api/ingredients/{self.ingredient.pk}/", {"cost_per_unit": "-1"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.stock(), Decimal("10"))

    def test_baseline_recipe_batch_and_unit_cost(self):
        self.recipe.yield_quantity = 4
        self.recipe.save()
        self.assertEqual(self.recipe.production_cost, Decimal("120"))
        self.assertEqual(self.recipe.cost_per_unit, Decimal("30"))

    def test_baseline_anonymous_private_api_denied(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/ingredients/").status_code, 401)

    def test_defect_invalid_sale_update_increases_stock(self):
        sale_id = self.sale().data["data"]["id"]
        self.assertEqual(self.stock(), Decimal("8"))
        for expected in ("10", "12"):
            response = self.client.patch(f"/api/sales/{sale_id}/", {"date": "invalid"}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.stock(), Decimal(expected))

    def test_defect_overselling_then_deleting_creates_stock(self):
        response = self.sale(10)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.stock(), Decimal("0"))
        self.client.delete(f"/api/sales/{response.data['data']['id']}/")
        self.assertEqual(self.stock(), Decimal("20"))

    def test_defect_recipe_change_corrupts_restoration(self):
        sale_id = self.sale().data["data"]["id"]
        self.line.quantity = Decimal("3")
        self.line.save()
        self.client.delete(f"/api/sales/{sale_id}/")
        self.assertEqual(self.stock(), Decimal("11"))

    def test_defect_recipe_deletion_loses_restoration(self):
        sale_id = self.sale().data["data"]["id"]
        self.recipe.delete()
        self.client.delete(f"/api/sales/{sale_id}/")
        self.assertEqual(self.stock(), Decimal("8"))

    def test_defect_duplicate_post_records_and_deducts_twice(self):
        self.assertEqual(self.sale().status_code, 201)
        self.assertEqual(self.sale().status_code, 201)
        self.assertEqual(Sale.objects.count(), 2)
        self.assertEqual(self.stock(), Decimal("6"))

    def test_defect_inventory_service_is_not_idempotent(self):
        sale_id = self.sale().data["data"]["id"]
        deduct_inventory_for_sale(Sale.objects.get(pk=sale_id))
        self.assertEqual(self.stock(), Decimal("6"))

    def test_defect_sale_persists_after_deduction_failure(self):
        from unittest.mock import patch
        self.client.raise_request_exception = False
        with patch("sales.views.deduct_inventory_for_sale", side_effect=RuntimeError("local injected failure")):
            self.assertEqual(self.sale().status_code, 500)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)
        self.assertEqual(self.stock(), Decimal("10"))

    def test_defect_negative_cost_allowed_through_model_validation(self):
        self.ingredient.cost_per_unit = Decimal("-60")
        self.ingredient.full_clean()
        self.ingredient.save()
        self.assertEqual(Recipe.objects.get(pk=self.recipe.pk).cost_per_unit, Decimal("-120"))

    def test_defect_cookie_auth_write_accepted_without_csrf(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient(enforce_csrf_checks=True)
        client.cookies["access_token"] = str(RefreshToken.for_user(self.user).access_token)
        response = client.patch(f"/api/ingredients/{self.ingredient.pk}/", {"quantity": "9"}, format="json", HTTP_ORIGIN="https://untrusted.example")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.stock(), Decimal("9"))

    def test_defect_cross_origin_simple_form_accepted_without_csrf(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient(enforce_csrf_checks=True)
        client.cookies["access_token"] = str(RefreshToken.for_user(self.user).access_token)
        response = client.post("/api/expenses/", "category=other&amount=15&date=2026-11-09",
                               content_type="application/x-www-form-urlencoded",
                               HTTP_ORIGIN="https://untrusted.example")
        self.assertEqual(response.status_code, 201)

    def test_defect_staff_can_delete_expense(self):
        response = self.client.post("/api/expenses/", {"amount": "10", "date": "2026-11-09", "category": "other"}, format="json")
        self.assertEqual(self.user.role, "staff")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.delete(f"/api/expenses/{response.data['data']['id']}/").status_code, 200)

    def test_defect_referenced_ingredient_delete_is_500(self):
        self.client.raise_request_exception = False
        response = self.client.delete(f"/api/ingredients/{self.ingredient.pk}/")
        self.assertEqual(response.status_code, 500)

    def test_defect_unavailable_product_can_be_sold_without_recipe(self):
        self.recipe.delete()
        self.product.is_available = False
        self.product.save()
        self.assertEqual(self.sale().status_code, 201)
        self.assertEqual(self.stock(), Decimal("10"))

    def test_defect_public_list_exposes_unavailable_product_and_ignores_filter(self):
        self.product.is_available = False
        self.product.save()
        client = APIClient()
        response = client.get("/api/products/?is_featured=true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["count"], 1)
        self.assertFalse(response.data["data"]["results"][0]["is_available"])
        self.assertFalse(response.data["data"]["results"][0]["is_featured"])

    def test_defect_chart_loses_same_month_across_years(self):
        self.sale(day="2025-01-10")
        self.sale(day="2026-01-10")
        response = self.client.get("/api/dashboard/?date_from=2025-01-01&date_to=2026-12-31")
        payload = response.data["data"]
        self.assertEqual(payload["totals"]["total_sales"], 100)
        self.assertEqual(sum(row["sales"] for row in payload["chart_data"]), 50)

    def test_defect_rounding_discards_small_deductions(self):
        self.recipe.yield_quantity = 3
        self.recipe.save()
        self.line.quantity = Decimal("0.01")
        self.line.save()
        for _ in range(3):
            self.sale()
        self.assertEqual(self.stock(), Decimal("10"))

    def test_measure_margin_query_growth(self):
        def queries():
            with CaptureQueriesContext(connection) as captured:
                self.client.get("/api/dashboard/profit-margins/")
            return len(captured)
        one = queries()
        for i in range(5):
            Product.objects.create(name=f"Extra {i}", price="50", category=self.category)
        six = queries()
        print(f"MARGIN_QUERY_BASELINE one_product={one} six_products={six}")
        self.assertGreaterEqual(six - one, 5)


class HistoricalMigrationAudit(TransactionTestCase):
    def test_defect_subtotal_migration_does_not_backfill_existing_items(self):
        from django.db.migrations.executor import MigrationExecutor
        executor = MigrationExecutor(connection)
        executor.migrate([("sales", "0001_initial")])
        historical = executor.loader.project_state([("sales", "0001_initial")]).apps
        OldSale = historical.get_model("sales", "Sale")
        OldItem = historical.get_model("sales", "SaleItem")
        # Product's current table is present; historical FK is assigned by ID.
        category = Category.objects.first()
        product = Product.objects.create(name="Historical audit", price=50, category=category)
        sale = OldSale.objects.create(date="2026-01-01", total_amount=100)
        item = OldItem.objects.create(sale=sale, product_id=product.pk, quantity=2, unit_price=50)
        executor = MigrationExecutor(connection)
        executor.migrate([("sales", "0002_saleitem_subtotal_amount")])
        self.assertEqual(SaleItem.objects.get(pk=item.pk).subtotal_amount, Decimal("0"))
        self.assertEqual(Sale.objects.get(pk=sale.pk).total_amount, Decimal("100"))


if __name__ == "__main__":
    print("AUDIT PROBES: baseline assertions plus existing defects; passing does not mean defects are fixed.")
    sys.exit(bool(DiscoverRunner(verbosity=2).run_tests(["__main__"])))
