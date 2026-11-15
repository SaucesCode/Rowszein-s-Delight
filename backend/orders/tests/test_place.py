"""Customers placing orders from the shop, and reading their order's status."""
from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal
from unittest import mock
from uuid import uuid4

from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from products.models import Assortment, AssortmentItem, BoxSize, Category, Partner, Product
from shop.models import DayOff, DeliveryHours, DeliveryTown, ShopSettings

from ..models import OnlineOrder, OrderEmail

PLACE_URL = '/api/orders/'
# Monday 16 Nov 2026, 10:00 in Manila (UTC+8).
MONDAY_10AM = datetime(2026, 11, 16, 2, 0, tzinfo=dt_timezone.utc)


def manila(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, day, hour - 8, minute, tzinfo=dt_timezone.utc)


class OrderFixture:
    real_limiter = False

    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(slug='order-classics', name='Order classics')
        self.glazed = Product.objects.create(name='Glazed Original', price=Decimal('35.00'), category=category)
        self.ube = Product.objects.create(name='Ube Cream', price=Decimal('55.00'), category=category, box_extra=Decimal('5.00'))
        partner = Partner.objects.create(name='Kape Lokal')
        self.muffin = Product.objects.create(name='Banana muffin', price=Decimal('60.00'), category=category,
                                             partner=partner, partner_payout=Decimal('50.00'), shape='muffin')
        self.box6 = BoxSize.objects.create(size=6, price=Decimal('200.00'), max_flavors=2)
        self.ready = Assortment.objects.create(name='Classic six', box_size=self.box6)
        AssortmentItem.objects.create(assortment=self.ready, product=self.glazed, quantity=6)
        self.lucena = DeliveryTown.objects.get(name='Lucena City')
        self.clock = mock.patch('orders.delivery.current_time', return_value=MONDAY_10AM)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        if not self.real_limiter:
            # The limiter refuses to run inside a test transaction; RateLimitTests covers it for real.
            for name in ('orders.views.admit_order', 'orders.views.record_order'):
                patcher = mock.patch(name)
                patcher.start()
                self.addCleanup(patcher.stop)

    def body(self, **changes):
        data = {
            'client_key': uuid4().hex, 'customer_name': 'Ana Cruz', 'phone': '0917 123 4567',
            'address': '12 Rizal St, near the chapel', 'note': '', 'town': self.lucena.id,
            'delivery_date': '2026-11-18', 'payment_method': '',
            'items': [{'product': self.glazed.id, 'quantity': 2}],
            'boxes': [{'box_size': self.box6.id, 'contents': [{'product': self.glazed.id, 'quantity': 3},
                                                               {'product': self.ube.id, 'quantity': 3}]}],
            'website': '',
        }
        data.update(changes)
        return data

    def place(self, **changes):
        return self.client.post(PLACE_URL, self.body(**changes), format='json')

    def errors(self, response):
        self.assertEqual(response.status_code, 400, response.content)
        return response.json()['error']


class PlaceOrderTests(OrderFixture, TestCase):
    def test_places_an_order_priced_by_the_server(self):
        response = self.place(items=[{'product': self.glazed.id, 'quantity': 2, 'unit_price': '1.00'}],
                              boxes=[{'box_size': self.box6.id, 'price': '1.00',
                                      'contents': [{'product': self.glazed.id, 'quantity': 3}, {'product': self.ube.id, 'quantity': 3}]},
                                     {'assortment': self.ready.id}])
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()['data']
        self.assertRegex(data['number'], r'^RD-261116-[A-HJ-NP-Z2-9]{4}$')
        self.assertEqual(data['status'], 'waiting')
        self.assertEqual(data['items'][0]['unit_price'], '35.00')
        self.assertEqual(data['boxes'][0]['price'], '215.00')  # 200 + 3 Ube x 5.00 extra
        self.assertEqual(data['boxes'][1]['price'], '200.00')
        self.assertEqual(data['boxes'][1]['name'], 'Classic six')
        self.assertEqual(data['subtotal'], '485.00')  # 70 + 215 + 200
        self.assertIsNone(data['delivery_fee'])
        self.assertEqual(data['total'], '485.00')
        order = OnlineOrder.objects.get()
        self.assertEqual(order.phone, '+639171234567')
        self.assertEqual(order.town_name, 'Lucena City')
        self.assertEqual(list(OrderEmail.objects.values_list('status', flat=True)), ['pending'])

    def test_town_fee_is_added_to_the_total(self):
        DeliveryTown.objects.filter(pk=self.lucena.pk).update(fee=Decimal('50.00'))
        data = self.place().json()['data']
        self.assertEqual(data['delivery_fee'], '50.00')
        self.assertEqual(data['total'], '335.00')  # 70 + 215 + 50

    def test_same_client_key_returns_the_same_order(self):
        body = self.body()
        first = self.client.post(PLACE_URL, body, format='json')
        again = self.client.post(PLACE_URL, body, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()['data']['number'], first.json()['data']['number'])
        self.assertEqual(OnlineOrder.objects.count(), 1)
        self.assertEqual(OrderEmail.objects.count(), 1)

    def test_unavailable_product_is_named(self):
        Product.objects.filter(pk=self.glazed.pk).update(is_available=False)
        errors = self.errors(self.place(boxes=[]))
        self.assertEqual(errors['items.0.product'], ['Glazed Original sold out a moment ago. Remove it to send your order.'])

    def test_switched_off_partner_item_is_named(self):
        Partner.objects.update(is_active=False)
        errors = self.errors(self.place(items=[{'product': self.muffin.id, 'quantity': 1}], boxes=[]))
        self.assertIn('Banana muffin sold out', errors['items.0.product'][0])

    def test_items_are_bounded(self):
        self.assertIn('items', self.errors(self.place(items=[{'product': self.glazed.id, 'quantity': 1}] * 2, boxes=[])))
        self.assertIn('items.0.quantity', self.errors(self.place(items=[{'product': self.glazed.id, 'quantity': 100}])))
        self.assertIn('non_field_errors', self.errors(self.place(items=[], boxes=[])))

    def test_box_must_follow_the_flavour_rule_and_be_on_sale(self):
        uneven = [{'box_size': self.box6.id, 'contents': [{'product': self.glazed.id, 'quantity': 5}, {'product': self.ube.id, 'quantity': 1}]}]
        self.assertIn('boxes.0.contents', self.errors(self.place(boxes=uneven)))
        partner_in_box = [{'box_size': self.box6.id, 'contents': [{'product': self.muffin.id, 'quantity': 6}]}]
        self.assertIn('boxes.0.contents', self.errors(self.place(boxes=partner_in_box)))
        BoxSize.objects.filter(pk=self.box6.pk).update(is_available=False)
        self.assertIn('boxes.0.box_size', self.errors(self.place()))
        self.assertIn('boxes.0.assortment', self.errors(self.place(boxes=[{'assortment': self.ready.id}])))

    def test_paused_shop_refuses(self):
        ShopSettings.objects.update(orders_paused=True)
        self.assertEqual(self.errors(self.place())['non_field_errors'], ['Orders are paused right now.'])

    def test_phone_is_normalised_and_checked(self):
        self.assertEqual(self.place(phone='+63 917 123 4567').status_code, 201)
        self.assertEqual(self.errors(self.place(phone='12345'))['phone'], ['Enter a mobile number like 0917 123 4567.'])

    def test_text_fields_are_checked(self):
        errors = self.errors(self.place(customer_name='', address='<b>here</b>', note='x' * 301))
        for key in ('customer_name', 'address', 'note'):
            self.assertIn(key, errors)

    def test_inactive_town_and_unknown_payment_are_refused(self):
        DeliveryTown.objects.filter(pk=self.lucena.pk).update(is_active=False)
        self.assertIn('town', self.errors(self.place()))
        DeliveryTown.objects.filter(pk=self.lucena.pk).update(is_active=True)
        ShopSettings.objects.update(payment_methods=['gcash', 'cod'])
        self.assertIn('payment_method', self.errors(self.place(payment_method='maya')))
        self.assertIn('payment_method', self.errors(self.place(payment_method='')))
        self.assertEqual(self.place(payment_method='cod').status_code, 201)

class RateLimitTests(OrderFixture, TransactionTestCase):
    """The real database limiter, which needs real transactions."""
    real_limiter = True

    def setUp(self):
        # Earlier transaction tests flush the database, taking the migration-seeded shop rows with them.
        ShopSettings.objects.get_or_create(pk=1, defaults={'messenger_url': 'https://m.me/rowszeinsdelight'})
        DeliveryTown.objects.get_or_create(name='Lucena City')
        super().setUp()

    def test_honeypot_saves_nothing(self):
        response = self.place(website='http://spam.example')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(OnlineOrder.objects.count(), 0)
        self.assertEqual(OrderEmail.objects.count(), 0)

    def test_rate_limit_after_five(self):
        for _ in range(5):
            self.assertEqual(self.place().status_code, 201)
        refused = self.place()
        self.assertEqual(refused.status_code, 429)
        self.assertEqual(refused.json()['error']['message'], 'Too many orders from this connection. Try again in a few minutes.')
        self.assertEqual(OnlineOrder.objects.count(), 5)

    def test_corrected_mistakes_do_not_use_up_the_limit(self):
        for _ in range(6):
            self.assertEqual(self.place(phone='12345').status_code, 400)
        self.assertEqual(self.place().status_code, 201)


class DeliveryDayTests(OrderFixture, TestCase):
    def assert_day_refused(self, day, message):
        self.assertEqual(self.errors(self.place(delivery_date=day))['delivery_date'], [message])

    def test_lead_days_set_the_earliest_day(self):
        self.assert_day_refused('2026-11-16', 'Pick a delivery day from Nov 17.')
        self.assertEqual(self.place(delivery_date='2026-11-17').status_code, 201)

    def test_after_the_cutoff_the_earliest_day_moves(self):
        ShopSettings.objects.update(order_cutoff=time(15, 0))
        with mock.patch('orders.delivery.current_time', return_value=manila(16, 15, 1)):
            self.assert_day_refused('2026-11-17', 'Pick a delivery day from Nov 18.')
            self.assertEqual(self.place(delivery_date='2026-11-18').status_code, 201)
        with mock.patch('orders.delivery.current_time', return_value=manila(16, 14, 59)):
            self.assertEqual(self.place(delivery_date='2026-11-17').status_code, 201)

    def test_days_off_are_refused(self):
        DayOff.objects.create(starts='2026-11-24', ends='2026-11-26', note='Break')
        self.assert_day_refused('2026-11-25', "We don't deliver on Nov 25. Pick another day.")

    def test_closed_weekdays_only_count_when_hours_are_shown(self):
        DeliveryHours.objects.filter(weekday=2).update(is_open=False, opens=None, closes=None)  # Wednesday
        self.assertEqual(self.place(delivery_date='2026-11-18').status_code, 201)
        ShopSettings.objects.update(show_hours=True)
        self.assert_day_refused('2026-11-18', "We don't deliver on Nov 18. Pick another day.")

    def test_no_more_than_thirty_days_ahead(self):
        earliest = datetime(2026, 11, 17).date()
        self.assertEqual(self.place(delivery_date=str(earliest + timedelta(days=30))).status_code, 201)
        self.assert_day_refused(str(earliest + timedelta(days=31)), "We don't deliver on Dec 18. Pick another day.")


class OrderStatusTests(OrderFixture, TestCase):
    def test_status_page_shows_first_name_only(self):
        token = self.place(note='Ring twice').json()['data']['token']
        response = self.client.get(f'/api/orders/status/{token}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['customer_first_name'], 'Ana')
        self.assertEqual(data['status'], 'waiting')
        for private in ('phone', 'address', 'note', 'customer_name', 'token'):
            self.assertNotIn(private, data)
        self.assertEqual(self.client.get('/api/orders/status/not-a-real-token/').status_code, 404)
