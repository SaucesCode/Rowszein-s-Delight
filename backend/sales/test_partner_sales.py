from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from accounts.session_fixtures import SessionClient
from products.models import Partner, Product
from sales.models import Sale, SaleConsumption
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
