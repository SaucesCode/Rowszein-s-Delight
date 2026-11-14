"""Read-only financial postings plus an explicitly disjoint legacy source."""
from collections import defaultdict
from decimal import Decimal, localcontext

from django.db.models import Sum

from products.models import Partner, PartnerPayment

from sales.financial_math import financial_totals
from sales.models import Sale, SaleFinancialEntry
from sales.services import payout_lines


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


def _partner_lines(sales):
    """Yield (sale, line) for every partner line, payout as a Decimal. Sales from before
    current_items existed predate partners, so they are skipped rather than loaded."""
    for sale in sales.filter(current_items__isnull=False).only('pk', 'date', 'current_items'):
        for line in payout_lines(sale):
            if line['partner'] is not None:
                yield sale, line


class _RemovedPartner:
    """Stands in for a partner deleted after its items were sold, so old orders still add up."""
    name = 'Removed partner'
    sort_order = 2 ** 31

    def __init__(self, pk):
        self.pk = pk


def partner_payouts(date_from, date_to):
    """What Rowszein owes each partner for recorded (not cancelled) orders dated in the range."""
    sales = Sale.objects.filter(status='recorded', date__gte=date_from, date__lte=date_to).order_by('date', 'pk')
    partners = {partner.pk: partner for partner in Partner.objects.all()}
    owed_by_partner, by_month = {}, defaultdict(Decimal)
    with localcontext() as context:
        context.prec = 50
        for sale, line in _partner_lines(sales):
            owed = line['partner_payout'] * line['quantity']
            by_month[sale.date.strftime('%Y-%m')] += owed
            partner = partners.get(line['partner']) or _RemovedPartner(line['partner'])
            row = owed_by_partner.setdefault(line['partner'], {'partner': partner, 'owed': Decimal('0'), 'items': {}})
            row['owed'] += owed
            # A rate change gives the same item a second line, so each line has one payout.
            item = row['items'].setdefault((line['product'], line['partner_payout']), {
                'product': line['product'], 'product_name': line['product_name'], 'quantity': 0,
                'payout': line['partner_payout'], 'owed': Decimal('0')})
            item['quantity'] += line['quantity']
            item['owed'] += owed
        total = sum(by_month.values(), Decimal('0'))
    rows = sorted(owed_by_partner.values(), key=lambda row: (row['partner'].sort_order, row['partner'].name))
    return {
        'partners': [{
            'id': row['partner'].pk, 'name': row['partner'].name, 'owed': format(row['owed'], '.2f'),
            'items': [dict(item, payout=format(item['payout'], '.2f'), owed=format(item['owed'], '.2f'))
                      for item in sorted(row['items'].values(), key=lambda item: (item['product_name'], item['payout']))],
        } for row in rows],
        'total': format(total, '.2f'),
        'by_month': {month: format(value, '.2f') for month, value in sorted(by_month.items())},
    }


def still_to_pay_all(today):
    """Every partner's balance in one pass: owed on recorded orders up to today, minus payments
    that aren't voided. Partners with nothing owed or paid are absent. Negative = paid ahead."""
    balances = defaultdict(Decimal)
    with localcontext() as context:
        context.prec = 50
        for _, line in _partner_lines(Sale.objects.filter(status='recorded', date__lte=today)):
            balances[line['partner']] += line['partner_payout'] * line['quantity']
        paid = PartnerPayment.objects.filter(voided_at__isnull=True).values('partner').annotate(total=Sum('amount'))
        for row in paid:
            balances[row['partner']] -= row['total']
    return {partner: value.quantize(Decimal('0.01')) for partner, value in balances.items()}


def still_to_pay(partner_id, today):
    """One partner's balance; see still_to_pay_all."""
    return still_to_pay_all(today).get(partner_id, Decimal('0.00'))
