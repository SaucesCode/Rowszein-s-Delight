"""The same TEN prior release blockers, verified in disposable Phase 1A.3.

Versioned from docs/phase1a2/pending_api_contracts.py (preserved unchanged).
Only the cancellation request fixture now supplies the required reason body.
Assertions are unchanged. Use only the ownership-verified disposable runner.
"""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless
import uuid

from django.db import connection, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem


class ReleaseBlockerContracts(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="pending-contract", role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        category = Category.objects.create(slug="pending-contract", name="Pending contract")
        self.product = Product.objects.create(name="Pending donut", price="50", category=category)
        self.ingredient = Ingredient.objects.create(name="Pending flour", quantity="10", unit="kg", cost_per_unit="60")
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=1)
        self.line = RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.ingredient, quantity="2")

    def create(self, client=None, key=None, quantity=1):
        return (client or self.client).post("/api/sales/", {
            "date": "2026-11-09", "sale_items": [{"product": self.product.pk, "quantity": quantity, "unit_price": "50.00"}],
        }, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()))

    def test_insufficient_stock_rejects_entire_sale(self):
        response = self.create(quantity=10)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Sale.objects.exists())
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity, Decimal("10"))

    def test_same_successful_request_identity_replays_original_sale(self):
        key = str(uuid.uuid4())
        first, second = self.create(key=key), self.create(key=key)
        self.assertEqual(second.status_code, first.status_code)
        self.assertEqual(second.data["data"]["id"], first.data["data"]["id"])
        self.assertEqual(Sale.objects.count(), 1)

    def test_conflicting_payload_same_request_identity_is_rejected(self):
        key = str(uuid.uuid4())
        self.create(key=key)
        self.assertEqual(self.create(key=key, quantity=2).status_code, 409)
        self.assertEqual(Sale.objects.count(), 1)

    def test_cancellation_after_recipe_change_restores_original_consumption(self):
        sale_id = self.create().data["data"]["id"]
        self.line.quantity = Decimal("3")
        self.line.save()
        response = self.client.delete(f"/api/sales/{sale_id}/", {"reason": "Owner cancellation"}, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()), HTTP_IF_MATCH='"1"')
        self.assertEqual(response.status_code, 200)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity, Decimal("10"))

    def test_fractional_three_separate_sales_consume_one_batch(self):
        self.recipe.yield_quantity = 3
        self.recipe.save()
        self.line.quantity = Decimal("0.01")
        self.line.save()
        for _ in range(3):
            self.assertEqual(self.create().status_code, 201)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity, Decimal("9.99"))

    def test_cancellation_preserves_original_sale_and_items(self):
        sale_id = self.create().data["data"]["id"]
        key = str(uuid.uuid4())
        first = self.client.delete(f"/api/sales/{sale_id}/", {"reason": "Owner cancellation"}, format="json", HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"1"')
        second = self.client.delete(f"/api/sales/{sale_id}/", {"reason": "Owner cancellation"}, format="json", HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"1"')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(Sale.objects.filter(pk=sale_id).exists())
        self.assertEqual(SaleItem.objects.filter(sale_id=sale_id).count(), 1)

    def test_unverifiable_legacy_sale_is_not_automatically_restored(self):
        sale = Sale.objects.create(date="2026-01-01", total_amount="50")
        SaleItem.objects.create(sale=sale, product=self.product, quantity=1, unit_price=Decimal("50"))
        response = self.client.delete(f"/api/sales/{sale.pk}/", {"reason": "Owner cancellation"}, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()), HTTP_IF_MATCH='"0"')
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Sale.objects.filter(pk=sale.pk).exists())

    def simultaneous(self, request):
        """Start actual requests together without intercepting service writes.

        A barrier inside a stock-write method would deadlock a CORRECT future
        row-lock implementation and is deliberately not used here.
        """
        barrier = Barrier(2, timeout=8)
        pids = []

        def run(index):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '10000ms'")
                    cursor.execute("SET lock_timeout = '8000ms'")
                    cursor.execute("SELECT pg_backend_pid()")
                    pids.append(cursor.fetchone()[0])
                client = APIClient()
                client.force_authenticate(self.user)
                barrier.wait()
                return request(client, index).status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(run, index) for index in range(2)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual(len(set(pids)), 2, "Concurrency must use separate PostgreSQL connections")
        return results

    @skipUnless(connection.vendor == "postgresql", "PostgreSQL concurrency contract")
    def test_competing_sales_only_one_can_consume_last_stock(self):
        self.ingredient.quantity = Decimal("2")
        self.ingredient.save()
        statuses = self.simultaneous(lambda client, _: self.create(client=client))
        self.assertEqual(sorted(statuses), [201, 400])
        self.assertEqual(Sale.objects.count(), 1)

    @skipUnless(connection.vendor == "postgresql", "PostgreSQL concurrency contract")
    def test_concurrent_duplicate_request_creates_only_one_sale(self):
        key = str(uuid.uuid4())
        statuses = self.simultaneous(lambda client, _: self.create(client=client, key=key))
        self.assertEqual(statuses, [201, 201])
        self.assertEqual(Sale.objects.count(), 1)

    @skipUnless(connection.vendor == "postgresql", "PostgreSQL concurrency contract")
    def test_concurrent_stale_sale_edits_reject_second_revision(self):
        sale_id = self.create().data["data"]["id"]

        def edit(client, index):
            return client.patch(f"/api/sales/{sale_id}/", {
                "sale_items": [{"product": self.product.pk, "quantity": index + 2, "unit_price": "50.00"}],
            }, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()), HTTP_IF_MATCH='"1"')

        self.assertEqual(sorted(self.simultaneous(edit)), [200, 409])
