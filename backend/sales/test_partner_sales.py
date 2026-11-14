from datetime import date
from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from accounts.session_fixtures import SessionClient
from products.models import Partner, PartnerPayment, Product
from sales.models import Sale, SaleConsumption
from sales.reporting import partner_payouts, still_to_pay
from sales.tests import SalesFixture


class PartnerSalesFixture(SalesFixture):
    def setUp(self):
        super().setUp()
        self.kape = Partner.objects.create(name='Kape Lokal')
        self.muffin = Product.objects.create(name='Banana muffin', price=Decimal('60.00'), category=self.product.category,
                                             partner=self.kape, partner_payout=Decimal('50.00'))
        self.cake = Product.objects.create(name='Ube cake slice', price=Decimal('120.00'), category=self.product.category,
                                           partner=self.kape, partner_payout=Decimal('100.00'))
        self.staff = SessionClient()
        self.staff.force_authenticate(User.objects.create_user(username='partner-sale-staff', role='staff'))

    def sell(self, lines, client=None, key=None, day='2026-11-09'):
        payload = {'date': day, 'notes': '', 'sale_items': [
            {'product': product.pk, 'quantity': quantity, 'unit_price': str(product.price)} for product, quantity in lines]}
        return (client or self.client).post('/api/sales/', payload, format='json', HTTP_IDEMPOTENCY_KEY=str(key or uuid4()))

    def stored_line(self, sale_id, product):
        return next(line for line in Sale.objects.get(pk=sale_id).current_items if line['product'] == product.pk)

    def today(self):
        return timezone.localdate(timezone=ZoneInfo('Asia/Manila')).isoformat()


class PartnerSalesTests(PartnerSalesFixture, TestCase):
    def test_partner_only_sale_needs_no_recipe_and_moves_no_stock(self):
        before = self.stock()
        response = self.sell([(self.muffin, 2)])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(SaleConsumption.objects.exists())
        self.assertEqual(self.stock(), before)

    def test_mixed_sale_lowers_stock_only_for_donuts(self):
        response = self.sell([(self.product, 1), (self.muffin, 2)])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['data']['total_amount'], '170.00')
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('18'), self.milk.pk: Decimal('9')})
        self.assertEqual({row.basis.product_id for row in SaleConsumption.objects.all()}, {self.product.pk})

    def test_sale_snapshots_partner_payout(self):
        sale_id = self.sell([(self.product, 1), (self.muffin, 2)]).data['data']['id']
        muffin_line = self.stored_line(sale_id, self.muffin)
        self.assertEqual((muffin_line['partner'], muffin_line['partner_payout']), (self.kape.pk, '50.00'))
        donut_line = self.stored_line(sale_id, self.product)
        self.assertEqual((donut_line['partner'], donut_line['partner_payout']), (None, '0.00'))

    def test_staff_never_sees_payout_in_sale_or_replay(self):
        key = uuid4()
        created = self.sell([(self.muffin, 1)], client=self.staff, key=key, day=self.today())
        self.assertEqual(created.status_code, 201, created.data)
        replayed = self.sell([(self.muffin, 1)], client=self.staff, key=key, day=self.today())
        fetched = self.staff.get(f"/api/sales/{created.data['data']['id']}/")
        for response in (created, replayed, fetched):
            self.assertNotIn('partner_payout', str(response.data))

    def test_rate_change_keeps_old_lines_and_new_line_uses_new_rate(self):
        sale_id = self.sell([(self.muffin, 1)]).data['data']['id']
        self.muffin.partner_payout = Decimal('55.00')
        self.muffin.save()
        edited = self.edit(sale_id, {'sale_items': [
            {'product': self.muffin.pk, 'quantity': 2, 'unit_price': '60.00'},
            {'product': self.cake.pk, 'quantity': 1, 'unit_price': '120.00'}]})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(self.stored_line(sale_id, self.muffin)['partner_payout'], '50.00')
        self.assertEqual(self.stored_line(sale_id, self.cake)['partner_payout'], '100.00')

    def test_staff_cannot_sell_items_of_switched_off_partner(self):
        self.kape.is_active = False
        self.kape.save()
        response = self.sell([(self.muffin, 1)], client=self.staff, day=self.today())
        self.assertEqual(response.status_code, 400)
        self.assertIn('Kape Lokal is switched off.', str(response.data))

    def test_owner_can_still_record_switched_off_partner_items(self):
        self.kape.is_active = False
        self.kape.save()
        self.assertEqual(self.sell([(self.muffin, 1)]).status_code, 201)


class PartnerReportingTests(PartnerSalesFixture, TestCase):
    NOVEMBER = (date(2026, 11, 1), date(2026, 11, 30))

    def test_payouts_grouped_by_partner_and_item(self):
        self.sell([(self.product, 1), (self.muffin, 2), (self.cake, 1)])
        report = partner_payouts(*self.NOVEMBER)
        self.assertEqual(report['total'], '200.00')
        self.assertEqual(report['by_month'], {'2026-11': '200.00'})
        kape = report['partners'][0]
        self.assertEqual((kape['id'], kape['name'], kape['owed']), (self.kape.pk, 'Kape Lokal', '200.00'))
        self.assertEqual(kape['items'], [
            {'product': self.muffin.pk, 'product_name': 'Banana muffin', 'quantity': 2, 'payout': '50.00', 'owed': '100.00'},
            {'product': self.cake.pk, 'product_name': 'Ube cake slice', 'quantity': 1, 'payout': '100.00', 'owed': '100.00'},
        ])

    def test_cancelled_sale_owes_nothing(self):
        sale_id = self.sell([(self.muffin, 2)]).data['data']['id']
        self.assertEqual(self.cancel(sale_id).status_code, 200)
        self.assertEqual(partner_payouts(*self.NOVEMBER)['total'], '0.00')

    def test_payouts_counted_by_order_date(self):
        self.sell([(self.muffin, 1)], day='2026-10-31')
        self.assertEqual(partner_payouts(*self.NOVEMBER)['total'], '0.00')
        self.assertEqual(partner_payouts(date(2026, 10, 1), date(2026, 10, 31))['total'], '50.00')

    def test_still_to_pay_follows_edits_and_ignores_voided_payments(self):
        sale_id = self.sell([(self.muffin, 2)]).data['data']['id']
        payment = PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 10), amount=Decimal('30.00'), recorded_by=self.user)
        self.assertEqual(still_to_pay(self.kape.pk, date(2026, 11, 14)), Decimal('70.00'))
        payment.voided_at, payment.voided_by, payment.void_reason = timezone.now(), self.user, 'Typed the wrong amount'
        payment.save()
        self.assertEqual(still_to_pay(self.kape.pk, date(2026, 11, 14)), Decimal('100.00'))
        self.edit(sale_id, {'sale_items': [{'product': self.muffin.pk, 'quantity': 1, 'unit_price': '60.00'}]})
        self.assertEqual(still_to_pay(self.kape.pk, date(2026, 11, 14)), Decimal('50.00'))

    def test_overpayment_gives_negative_still_to_pay(self):
        self.sell([(self.muffin, 1)])
        PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 10), amount=Decimal('80.00'), recorded_by=self.user)
        self.assertEqual(still_to_pay(self.kape.pk, date(2026, 11, 14)), Decimal('-30.00'))

    def test_dashboard_profit_subtracts_partner_payouts(self):
        self.sell([(self.product, 1), (self.muffin, 2)])
        data = self.client.get('/api/dashboard/?date_from=2026-11-01&date_to=2026-11-30').data['data']
        self.assertEqual(data['totals']['partner_payouts'], '100.00')
        self.assertEqual(data['totals']['net_profit'], 70.0)
        november = next(row for row in data['chart_data'] if row['month'] == 'Nov')
        self.assertEqual((november['payouts'], november['profit']), (100.0, 70.0))

    def test_profit_margin_marks_partner_item_with_patong(self):
        rows = {row['product_name']: row for row in self.client.get('/api/dashboard/profit-margins/').data['data']}
        muffin = rows['Banana muffin']
        self.assertEqual((muffin['is_partner'], muffin['production_cost'], muffin['profit_per_unit']), (True, 50.0, 10.0))
        self.assertFalse(rows['Test donut']['is_partner'])
