from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts import login_limiter
from accounts.models import User
from accounts.permissions import can
from accounts.session_errors import AuthUnavailable
from sales.models import Sale

from ..models import OnlineOrder


def order(**fields):
    values = dict(
        number='RD-261115-ABCD', token='t' * 32, client_key='k' * 32, customer_name='Ana Cruz',
        phone='+639171234567', address='12 Rizal St, near the chapel', town_name='Lucena City',
        delivery_date=date(2026, 11, 20), items=[], boxes=[], subtotal=Decimal('100.00'), total=Decimal('100.00'),
    )
    values.update(fields)
    return OnlineOrder(**values)


class OnlineOrderModelTests(TestCase):
    def assert_rejected(self, instance):
        with self.assertRaises(IntegrityError), transaction.atomic():
            instance.save()

    def test_confirmed_order_needs_its_sale_and_others_have_none(self):
        sale = Sale.objects.create(date=date(2026, 11, 20), total_amount=Decimal('100.00'))
        self.assert_rejected(order(status='confirmed'))
        self.assert_rejected(order(status='waiting', sale=sale, number='RD-261115-ABCE', token='u' * 32, client_key='l' * 32))
        order(status='confirmed', sale=sale).save()

    def test_status_must_be_known(self):
        self.assert_rejected(order(status='shipped'))

    def test_shown_status_reads_a_cancelled_sale(self):
        self.assertEqual(order(status='confirmed', sale=Sale(status='cancelled')).shown_status, 'cancelled')
        self.assertEqual(order(status='confirmed', sale=Sale(status='recorded')).shown_status, 'confirmed')
        self.assertEqual(order(status='waiting').shown_status, 'waiting')

    def test_number_and_token_are_unique(self):
        order().save()
        self.assert_rejected(order(token='v' * 32, client_key='m' * 32))
        self.assert_rejected(order(number='RD-261115-ZZZZ', client_key='m' * 32))
        self.assert_rejected(order(number='RD-261115-ZZZZ', token='v' * 32))


class OwnerCapabilityTests(TestCase):
    def test_only_the_owner_manages_orders(self):
        self.assertTrue(can(User.objects.create_user(username='o-owner', role='admin'), 'orders.manage'))
        self.assertFalse(can(User.objects.create_user(username='o-staff', role='staff'), 'orders.manage'))


class OrderLimiterTests(TestCase):
    @override_settings(AUTH_RATE_LIMITS={'LA': 5, 'LI': 20, 'LR': 60, 'RR': 30})
    def test_order_scope_defaults_when_not_configured(self):
        # Customers can share one address behind the hosting proxies, so the default leaves room.
        self.assertEqual(login_limiter.limit('OS'), 20)

    @override_settings(AUTH_RATE_LIMITS={'LI': 20, 'LR': 60, 'RR': 30})
    def test_sign_in_scopes_stay_strict(self):
        with self.assertRaises(AuthUnavailable):
            login_limiter.limit('LA')

    @override_settings(AUTH_RATE_LIMITS={'LA': 5, 'LI': 20, 'LR': 60, 'RR': 30, 'OS': 9})
    def test_order_scope_can_be_configured(self):
        self.assertEqual(login_limiter.limit('OS'), 9)


class OrderEmailSettingTests(TestCase):
    def setUp(self):
        self.owner = APIClient()
        self.owner.force_authenticate(User.objects.create_user(username='oe-owner', role='admin'))

    def test_order_email_is_private_and_checked(self):
        self.assertNotIn('order_email', APIClient().get('/api/shop/settings/').json()['data'])
        doc = self.owner.get('/api/shop/settings/manage/').json()['data']
        self.assertEqual(doc['order_email'], '')
        doc.pop('updated_at')
        bad = self.owner.put('/api/shop/settings/manage/', dict(doc, order_email='"?bcc=x"@a.com'), format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertIn('order_email', bad.json()['error'])
        good = self.owner.put('/api/shop/settings/manage/', dict(doc, order_email='owner@example.com'), format='json')
        self.assertEqual(good.status_code, 200, good.content)
        self.assertEqual(good.json()['data']['order_email'], 'owner@example.com')
        self.assertNotIn('order_email', APIClient().get('/api/shop/settings/').json()['data'])
