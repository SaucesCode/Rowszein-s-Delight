"""Desired behavior of the UNWIRED, schema-free precision/identity kernel."""
from decimal import Decimal, localcontext
from itertools import permutations
import random

from django.test import SimpleTestCase

from sales.inventory_math import (
    Basis, Change, InsufficientStock, MAX_ACTIVE_UNITS, MAX_BATCH_QUANTITY, MAX_QUANTITY,
    cumulative_quanta, intent_fingerprint, money_text, project_stock,
    quantity_quanta, quantity_text,
)


class InventoryMathTests(SimpleTestCase):
    def setUp(self):
        self.basis = Basis(Decimal("0.01"), 3, "kg")

    def test_three_separate_sales_consume_exactly_one_batch(self):
        stock = Decimal("1")
        deltas = []
        for units in range(3):
            plan = project_stock(stock, "kg", [Change(self.basis, units, units + 1)])
            stock = plan.resulting_quantity
            deltas.append(plan.quantity_delta)
        self.assertEqual(deltas, [Decimal("-0.003333333"), Decimal("-0.003333334"), Decimal("-0.003333333")])
        self.assertEqual(stock, Decimal("0.990000000"))

    def test_update_and_cancellations_reconcile_to_opening_balance(self):
        stock = Decimal("1")
        for before, after in [(0, 1), (1, 2), (2, 3), (3, 4), (4, 3), (3, 1), (1, 0)]:
            stock = project_stock(stock, "kg", [Change(self.basis, before, after)]).resulting_quantity
        self.assertEqual(stock, Decimal("1.000000000"))

    def test_cancelling_round_up_sale_uses_current_cumulative_allocation(self):
        # Original second sale deducted .003333334. Removing ANY one active
        # unit at N=3 credits .003333333; the surviving total remains correct.
        plan = project_stock(Decimal("0.99"), "kg", [Change(self.basis, 3, 2)])
        self.assertEqual(plan.quantity_delta, Decimal("0.003333333"))
        self.assertEqual(plan.resulting_quantity, Decimal("0.993333333"))

    def test_cancellation_order_always_restores_all_stock(self):
        for order in permutations([1, 2, 3]):
            active = {1: 1, 2: 2, 3: 3}
            stock = project_stock(Decimal("1"), "kg", [Change(self.basis, 0, 6)]).resulting_quantity
            for sale_id in order:
                before = sum(active.values())
                del active[sale_id]
                stock = project_stock(stock, "kg", [Change(self.basis, before, sum(active.values()))]).resulting_quantity
            self.assertEqual(stock, Decimal("1.000000000"))

    def test_recipe_change_uses_old_and_new_immutable_bases(self):
        old_basis = self.basis
        new_basis = Basis(Decimal("0.02"), 3, "kg")
        stock = project_stock(Decimal("1"), "kg", [Change(old_basis, 0, 1)]).resulting_quantity
        edited = project_stock(stock, "kg", [Change(old_basis, 1, 0), Change(new_basis, 0, 1)])
        self.assertEqual(edited.resulting_quantity, Decimal("0.993333333"))
        cancelled = project_stock(edited.resulting_quantity, "kg", [Change(new_basis, 1, 0)])
        self.assertEqual(cancelled.resulting_quantity, Decimal("1"))

    def test_aggregate_insufficiency_is_rejected_without_mutating_inputs(self):
        available = Decimal("0.005")
        with self.assertRaises(InsufficientStock):
            project_stock(available, "kg", [Change(self.basis, 0, 2)])
        self.assertEqual(available, Decimal("0.005"))

    def test_net_reversal_and_replacement_are_validated_together(self):
        other = Basis(Decimal("0.01"), 2, "kg")
        plan = project_stock(Decimal("0"), "kg", [Change(self.basis, 3, 0), Change(other, 0, 2)])
        self.assertEqual(plan.resulting_quantity, Decimal("0"))

    def test_half_quantum_ties_round_up_exactly(self):
        basis = Basis(Decimal("0.03"), 20000000, "g")
        self.assertEqual([cumulative_quanta(basis, n) for n in range(5)], [0, 2, 3, 5, 6])

    def test_units_are_never_implicitly_converted(self):
        with self.assertRaises(ValueError):
            project_stock(Decimal("1000"), "g", [Change(self.basis, 0, 1)])

    def test_invalid_and_out_of_range_numbers_are_rejected(self):
        for value in [0.01, Decimal("NaN"), Decimal("Infinity"), Decimal("-1"), Decimal("0.0000000001"), Decimal("100000000000")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                quantity_quanta(value)
        for count in [-1, True, 1.5, MAX_ACTIVE_UNITS + 1]:
            with self.subTest(count=count), self.assertRaises(ValueError):
                cumulative_quanta(self.basis, count)
        with self.assertRaises(ValueError):
            Basis(Decimal("0"), 3, "kg")
        with self.assertRaises(ValueError):
            Basis(Decimal("1"), 0, "kg")
        with self.assertRaises(ValueError):
            Basis(Decimal("0.01"), 20000000, "kg")
        with self.assertRaises(ValueError):
            Basis(Decimal("0.005"), 1, "kg")

    def test_overflow_credit_is_rejected(self):
        with self.assertRaises(ValueError):
            project_stock(MAX_QUANTITY, "kg", [Change(self.basis, 1, 0)])

    def test_cumulative_total_can_exceed_instantaneous_stock_column_limit(self):
        basis = Basis(MAX_BATCH_QUANTITY, 1, "kg")
        self.assertEqual(cumulative_quanta(basis, MAX_ACTIVE_UNITS), quantity_quanta(MAX_BATCH_QUANTITY) * MAX_ACTIVE_UNITS)

    def test_global_decimal_context_cannot_change_allocation(self):
        with localcontext() as context:
            context.prec = 3
            plan = project_stock(Decimal("1"), "kg", [Change(self.basis, 1, 2)])
            self.assertEqual(plan.quantity_delta, Decimal("-0.003333334"))

    def test_money_and_stock_have_separate_precision_policies(self):
        self.assertEqual(money_text(Decimal("45.25")), "45.25")
        self.assertEqual(quantity_text(Decimal("0.003333333")), "0.003333333")
        self.assertEqual(quantity_text(Decimal("1.0000000000")), "1.000000000")
        with self.assertRaises(ValueError):
            money_text(Decimal("45.255"))

    def test_deterministic_random_lifecycle_telescopes_without_drift(self):
        rng = random.Random(20261109)
        for _ in range(100):
            basis = Basis(Decimal(rng.randint(1, 100000)).scaleb(-2), rng.randint(1, 97), "kg")
            stock, active = Decimal("100000000"), 0
            for _ in range(50):
                next_active = rng.randint(0, 1000)
                stock = project_stock(stock, "kg", [Change(basis, active, next_active)]).resulting_quantity
                active = next_active
            stock = project_stock(stock, "kg", [Change(basis, active, 0)]).resulting_quantity
            self.assertEqual(stock, Decimal("100000000"))


class IntentFingerprintTests(SimpleTestCase):
    def test_key_order_does_not_change_fingerprint(self):
        self.assertEqual(intent_fingerprint({"target": 1, "revision": 2}), intent_fingerprint({"revision": 2, "target": 1}))

    def test_changed_payload_action_target_or_revision_changes_fingerprint(self):
        original = {"action": "sale.update", "target": 1, "revision": 2, "price": "45.25"}
        for key, value in [("action", "sale.cancel"), ("target", 2), ("revision", 3), ("price", "45.26")]:
            self.assertNotEqual(intent_fingerprint(original), intent_fingerprint(dict(original, **{key: value})))

    def test_float_and_implicit_decimal_inputs_are_rejected(self):
        for value in [1.5, float("nan"), Decimal("1.5"), {1: "bad key"}]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                intent_fingerprint({"value": value})

    def test_explicit_money_normalization_makes_equivalent_input_equal(self):
        self.assertEqual(intent_fingerprint({"price": money_text(Decimal("1"))}), intent_fingerprint({"price": money_text(Decimal("1.00"))}))
