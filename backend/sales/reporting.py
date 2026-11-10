"""Read-only financial postings plus an explicitly disjoint legacy source."""
from collections import defaultdict

from sales.financial_math import financial_totals
from sales.models import Sale, SaleFinancialEntry


def financial_summary(date_from, date_to):
    rows = list(SaleFinancialEntry.objects.filter(sale__financial_tracking='ledger', effective_date__gte=date_from, effective_date__lte=date_to).values_list('effective_date', 'kind', 'amount'))
    # No backfill and no double counting: ledger sales are NEVER included here.
    legacy = list(Sale.objects.filter(financial_tracking='legacy_source', date__gte=date_from, date__lte=date_to).values_list('date', 'total_amount'))
    by_month = defaultdict(list)
    legacy_months = defaultdict(list)
    for day, kind, amount in rows:
        by_month[day.strftime('%Y-%m')].append((kind, amount))
    for day, amount in legacy:
        legacy_months[day.strftime('%Y-%m')].append(amount)
    totals = financial_totals(((kind, amount) for _, kind, amount in rows), legacy_amounts=(amount for _, amount in legacy))
    return {
        'totals': {name: format(value, '.2f') for name, value in totals.items()},
        'months': {month: {name: format(value, '.2f') for name, value in financial_totals(by_month[month], legacy_amounts=legacy_months[month]).items()} for month in sorted(set(by_month) | set(legacy_months))},
        'legacy_record_count': len(legacy),
        'legacy_nonpositive_count': sum(amount <= 0 for _, amount in legacy),
        'refund_status': 'not_tracked',
        'source_policy': 'legacy_source sale totals plus ledger postings; no overlap',
    }
