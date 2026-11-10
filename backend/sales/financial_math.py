"""Signed PHP posting/reporting contract. A reversal is not a cash refund."""
from decimal import Decimal, localcontext
from sales.inventory_math import money_text


def posting_amount(kind, amount):
    if not isinstance(amount, Decimal) or not amount.is_finite():
        raise ValueError('Financial postings require finite Decimal amounts')
    money_text(amount.copy_abs())
    if kind == 'gross_sale' and amount > 0:
        return amount
    if kind == 'sale_adjustment' and amount != 0:
        return amount
    if kind == 'cancellation' and amount < 0:
        return amount
    raise ValueError('Posting kind/amount sign is invalid')


def financial_totals(postings, *, legacy_amounts=()):
    with localcontext() as context:
        context.prec = 50
        values = {kind: Decimal('0.00') for kind in ['gross_sale', 'sale_adjustment', 'cancellation']}
        for kind, amount in postings:
            values[kind] += posting_amount(kind, amount)
        # Existing values are a read-only source, never invented ledger entries.
        # Preserve even zero/negative legacy totals and flag them in the report.
        legacy_total = Decimal('0.00')
        for amount in legacy_amounts:
            money_text(amount.copy_abs())
            legacy_total += amount
        values['gross_sale'] += legacy_total
        # Cancellation postings are ALREADY negative. Never subtract them again.
        return {
            'gross_sales': values['gross_sale'],
            'sales_adjustments': values['sale_adjustment'],
            'signed_cancellations': values['cancellation'],
            'cancellation_amount': -values['cancellation'],
            'net_sales': sum(values.values(), Decimal('0.00')),
            'legacy_sales': legacy_total,
        }
