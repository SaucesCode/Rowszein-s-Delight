"""PG design EXPERIMENTS on existing fixture tables, NOT production service tests.

No new models, tables, constraints or migrations. Ingredient.quantity stores
integer quanta as a test adapter; notes stores a temporary counter/revision.
Category.slug's EXISTING unique index is a stand-in for the unapproved request
identity index. Passing proves primitives, NOT the final schema or API wiring.
"""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from hashlib import sha256
from threading import Barrier
from unittest import skipUnless
import json

from django.db import IntegrityError, connection, connections, transaction
from django.test import TransactionTestCase

from ingredients.models import Ingredient
from products.models import Category
from sales.inventory_math import Basis, Change, InsufficientStock, cumulative_quanta, intent_fingerprint, project_stock, quantity_quanta


@skipUnless(connection.vendor == "postgresql", "Real PostgreSQL primitive experiments only")
class PostgreSQLProtocolExperiments(TransactionTestCase):
    def setUp(self):
        self.basis = Basis(Decimal("0.01"), 3, "kg")
        self.row = Ingredient.objects.create(name="EXPERIMENT quanta counter", quantity="10000000", unit="pcs", cost_per_unit="1", notes=json.dumps({"active": 0, "revision": 0}))

    def parallel(self, calls):
        start = Barrier(len(calls), timeout=8)
        pids = []

        def invoke(call):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '10000ms'")
                    cursor.execute("SET lock_timeout = '8000ms'")
                    cursor.execute("SELECT pg_backend_pid()")
                    pids.append(cursor.fetchone()[0])
                start.wait()
                return call()
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(calls)) as pool:
            futures = [pool.submit(invoke, call) for call in calls]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual(len(set(pids)), len(calls))
        return results

    def transition(self, change, expected_revision=None, fail=False):
        try:
            with transaction.atomic():
                row = Ingredient.objects.select_for_update().get(pk=self.row.pk)
                state = json.loads(row.notes)
                if expected_revision is not None and state["revision"] != expected_revision:
                    return "stale"
                available = Decimal(int(row.quantity)).scaleb(-9)
                plan = project_stock(available, "kg", [Change(self.basis, state["active"], state["active"] + change)])
                state["active"] += change
                state["revision"] += 1
                row.quantity = Decimal(quantity_quanta(plan.resulting_quantity))
                row.notes = json.dumps(state)
                row.save()
                if fail:
                    raise RuntimeError("Experiment failure after persistent write")
                return int(plan.quantity_delta.scaleb(9))
        except InsufficientStock:
            return "insufficient"

    def test_three_competing_fractional_sales_reconcile_exact_batch(self):
        deltas = self.parallel([lambda: self.transition(1)] * 3)
        self.assertEqual(sorted(deltas), [-3333334, -3333333, -3333333])
        self.row.refresh_from_db()
        self.assertEqual(self.row.quantity, 0)
        self.assertEqual(json.loads(self.row.notes)["active"], 3)

    def test_competing_sales_reject_insufficient_aggregate_stock(self):
        self.row.quantity = Decimal("5000000")
        self.row.save()
        results = self.parallel([lambda: self.transition(1)] * 2)
        self.assertEqual(results.count("insufficient"), 1)
        self.row.refresh_from_db()
        self.assertEqual(self.row.quantity, Decimal("1666667"))

    def test_competing_updates_use_fresh_locked_revision(self):
        self.transition(1)
        results = self.parallel([lambda: self.transition(1, expected_revision=1), lambda: self.transition(2, expected_revision=1)])
        self.assertEqual(results.count("stale"), 1)
        self.row.refresh_from_db()
        state = json.loads(self.row.notes)
        self.assertEqual(state["revision"], 2)
        self.assertEqual(int(self.row.quantity), 10000000 - cumulative_quanta(self.basis, state["active"]))

    def test_concurrent_distinct_cancellations_restore_opening_stock(self):
        self.transition(3)
        results = self.parallel([lambda: self.transition(-1), lambda: self.transition(-2)])
        self.assertEqual(sum(results), 10000000)
        self.row.refresh_from_db()
        self.assertEqual(self.row.quantity, Decimal("10000000"))

    def test_exception_after_locked_stock_write_rolls_back(self):
        self.row.refresh_from_db()
        before = (self.row.quantity, self.row.notes)
        with self.assertRaises(RuntimeError):
            self.transition(1, fail=True)
        self.row.refresh_from_db()
        self.assertEqual((self.row.quantity, self.row.notes), before)

    def operation_experiment(self, row_id, key, fingerprint, before_insert=None):
        """Existing Category unique key simulates the proposed commit-time guard."""
        slug = "op-" + sha256(key.encode()).hexdigest()[:46]

        def replay():
            record = Category.objects.filter(slug=slug).first()
            if record is None:
                return None
            stored = json.loads(record.description)
            return "replay" if stored["fingerprint"] == fingerprint else "conflict"

        try:
            with transaction.atomic():
                row = Ingredient.objects.select_for_update().get(pk=row_id)
                existing = replay()
                if existing:
                    return existing
                row.quantity -= Decimal("1")
                row.save()
                if before_insert:
                    before_insert.wait()
                Category.objects.create(slug=slug, name=slug, description=json.dumps({"fingerprint": fingerprint}))
                return "created"
        except IntegrityError:
            # Outside the entire transaction: speculative stock writes have
            # rolled back. Final implementation must inspect constraint name.
            existing = replay()
            if existing is None:
                raise
            return existing

    def test_concurrent_duplicate_operation_credits_or_deducts_only_once(self):
        fingerprint = intent_fingerprint({"target": self.row.pk, "quantity": "0.000000001"})
        results = self.parallel([lambda: self.operation_experiment(self.row.pk, "duplicate", fingerprint)] * 2)
        self.assertEqual(sorted(results), ["created", "replay"])
        self.row.refresh_from_db()
        self.assertEqual(self.row.quantity, Decimal("9999999"))

    def test_unique_identity_race_rolls_back_conflicting_disjoint_stock_write(self):
        other = Ingredient.objects.create(name="EXPERIMENT other counter", quantity="10", unit="pcs", cost_per_unit="1")
        race = Barrier(2, timeout=8)
        calls = [lambda: self.operation_experiment(self.row.pk, "collision", "a" * 64, race), lambda: self.operation_experiment(other.pk, "collision", "b" * 64, race)]
        results = self.parallel(calls)
        self.assertEqual(sorted(results), ["conflict", "created"])
        self.row.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual((Decimal("10000000") - self.row.quantity) + (Decimal("10") - other.quantity), Decimal("1"))

    def test_duplicate_replay_survives_new_database_connection(self):
        fingerprint = "a" * 64
        self.assertEqual(self.operation_experiment(self.row.pk, "durable", fingerprint), "created")
        connection.close()
        self.assertEqual(self.operation_experiment(self.row.pk, "durable", fingerprint), "replay")
        self.row.refresh_from_db()
        self.assertEqual(self.row.quantity, Decimal("9999999"))
