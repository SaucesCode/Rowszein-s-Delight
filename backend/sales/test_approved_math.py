"""Database-free tests of monotonic allocation, exact reversal and signed PHP."""
from decimal import Decimal, localcontext
import random
from django.test import SimpleTestCase

from sales.inventory_math import Basis, MAX_ACTIVE_UNITS, allocate, apply_deltas
from sales.financial_math import financial_totals, posting_amount


class ApprovedAllocationTests(SimpleTestCase):
    def setUp(self):
        self.basis = Basis(Decimal('0.01'), 3, 'kg')

    def test_cursor_never_rewinds_when_middle_sale_is_cancelled(self):
        allocations = [allocate(self.basis, start, 1) for start in range(3)]
        self.assertEqual([a.applied_quantity for a in allocations], [Decimal('.003333333'), Decimal('.003333334'), Decimal('.003333333')])
        stock = apply_deltas(Decimal('1'), [a.applied_quantity.copy_negate() for a in allocations])
        stock = apply_deltas(stock, [allocations[1].applied_quantity])
        self.assertEqual(stock, Decimal('.993333334'))
        following = allocate(self.basis, allocations[-1].end, 1)
        self.assertEqual((following.start, following.end), (3, 4))
        self.assertEqual(following.applied_quantity, Decimal('.003333333'))
        stock = apply_deltas(stock, [following.applied_quantity.copy_negate()])
        stock = apply_deltas(stock, [allocations[0].applied_quantity, allocations[2].applied_quantity, following.applied_quantity])
        self.assertEqual(stock, Decimal('1'))

    def test_update_reverses_exact_snapshot_then_uses_next_interval(self):
        first = allocate(self.basis, 0, 1)
        second = allocate(self.basis, first.end, 1)
        stock = apply_deltas(Decimal('1'), [first.applied_quantity.copy_negate(), second.applied_quantity.copy_negate()])
        replacement = allocate(self.basis, second.end, 2)
        stock = apply_deltas(stock, [second.applied_quantity, replacement.applied_quantity.copy_negate()])
        stock = apply_deltas(stock, [first.applied_quantity, replacement.applied_quantity])
        self.assertEqual(stock, Decimal('1'))
        self.assertEqual(replacement.end, 4)

    def test_changed_recipe_does_not_change_recorded_quantity(self):
        original = allocate(self.basis, 0, 1)
        changed = Basis(Decimal('.02'), 3, 'kg')
        self.assertNotEqual(original.applied_quantity, allocate(changed, 0, 1).applied_quantity)
        self.assertEqual(apply_deltas(Decimal('1'), [original.applied_quantity.copy_negate(), original.applied_quantity]), Decimal('1'))

    def test_cursor_overflow_rejects_instead_of_wrapping(self):
        with self.assertRaises(ValueError):
            allocate(self.basis, MAX_ACTIVE_UNITS, 1)

    def test_unrepresentable_applied_quantity_is_rejected(self):
        with self.assertRaises(ValueError):
            allocate(Basis(Decimal('99999999.99'), 1, 'kg'), 0, 10000)

    def test_zero_units_and_floats_are_rejected(self):
        for value in [0, -1, 1.5, True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                allocate(self.basis, 0, value)

    def test_zero_available_stock_cannot_fund_positive_consumption(self):
        allocation = allocate(self.basis, 0, 1)
        with self.assertRaises(ValueError):
            apply_deltas(Decimal('0'), [allocation.applied_quantity.copy_negate()])

    def test_quantities_are_conserved_across_random_exact_reversals(self):
        rng = random.Random(20261109)
        stock, cursor, active = Decimal('100'), 0, {}
        for index in range(2000):
            if active and rng.randrange(3) == 0:
                key = rng.choice(list(active))
                stock = apply_deltas(stock, [active.pop(key).applied_quantity])
            else:
                allocation = allocate(self.basis, cursor, rng.randint(1, 7))
                self.assertGreater(allocation.end, cursor)
                cursor = allocation.end
                active[index] = allocation
                stock = apply_deltas(stock, [allocation.applied_quantity.copy_negate()])
        stock = apply_deltas(stock, [value.applied_quantity for value in active.values()])
        self.assertEqual(stock, Decimal('100'))

    def test_ambient_context_does_not_change_exact_credit(self):
        with localcontext() as context:
            context.prec = 3
            amount = allocate(self.basis, 1, 1).applied_quantity
            result = apply_deltas(Decimal('.993333333'), [amount])
        self.assertEqual(result, Decimal('.996666667'))


class SignedFinancialTests(SimpleTestCase):
    def test_legacy_totals_are_preserved_without_fabricating_postings(self):
        from sales.inventory_math import signed_money_text
        self.assertEqual(signed_money_text(Decimal('-2.00')), '-2.00')
        result = financial_totals([('gross_sale', Decimal('50'))], legacy_amounts=[Decimal('0'), Decimal('-2'), Decimal('10')])
        self.assertEqual(result['gross_sales'], Decimal('58'))
        self.assertEqual(result['legacy_sales'], Decimal('8'))
        self.assertEqual(result['net_sales'], Decimal('58'))
        with self.assertRaises(ValueError):
            posting_amount('gross_sale', Decimal('0'))

    def test_cancellation_is_not_subtracted_twice(self):
        result = financial_totals([('gross_sale', Decimal('150')), ('cancellation', Decimal('-150'))])
        self.assertEqual(result['signed_cancellations'], Decimal('-150'))
        self.assertEqual(result['cancellation_amount'], Decimal('150'))
        self.assertEqual(result['net_sales'], Decimal('0'))

    def test_three_dates_keep_gross_adjustment_and_reversal_separate(self):
        self.assertEqual(financial_totals([('gross_sale', Decimal('150'))])['net_sales'], Decimal('150'))
        self.assertEqual(financial_totals([('sale_adjustment', Decimal('30'))])['net_sales'], Decimal('30'))
        self.assertEqual(financial_totals([('cancellation', Decimal('-180'))])['net_sales'], Decimal('-180'))
        self.assertEqual(financial_totals([('gross_sale', Decimal('150')), ('sale_adjustment', Decimal('30')), ('cancellation', Decimal('-180'))])['net_sales'], Decimal('0'))

    def test_negative_adjustment_is_summed_as_signed_value(self):
        self.assertEqual(financial_totals([('gross_sale', Decimal('150')), ('sale_adjustment', Decimal('-20')), ('cancellation', Decimal('-130'))])['net_sales'], Decimal('0'))

    def test_wrong_posting_sign_or_fractional_cent_is_rejected(self):
        for kind, amount in [('gross_sale', '-1'), ('cancellation', '1'), ('sale_adjustment', '0'), ('gross_sale', '1.001')]:
            with self.subTest(kind=kind, amount=amount), self.assertRaises(ValueError):
                posting_amount(kind, Decimal(amount))

    def test_report_sum_can_exceed_one_posting_field_capacity(self):
        result = financial_totals([('gross_sale', Decimal('99999999.99'))] * 2)
        self.assertEqual(result['net_sales'], Decimal('199999999.98'))

    def test_refund_is_not_a_posting_kind(self):
        with self.assertRaises(ValueError):
            posting_amount('refund', Decimal('-1'))
