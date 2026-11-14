from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase

from accounts.models import User

from .models import Category, Partner, PartnerPayment, Product


class PartnerFixture:
    def setUp(self):
        self.owner_user = User.objects.create_user(username='partner-owner', role='admin')
        self.category = Category.objects.create(slug='partner-test', name='Partner test')
        self.kape = Partner.objects.create(name='Kape Lokal', blurb='Muffins from Marikina')

    def partner_item(self, name='Banana muffin', price='60.00', payout='50.00', **extra):
        return Product.objects.create(name=name, price=Decimal(price), category=self.category,
                                      partner=self.kape, partner_payout=Decimal(payout), **extra)


class PartnerModelTests(PartnerFixture, TestCase):
    def assert_rejected(self, **fields):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(name='Rejected item', category=self.category, **fields)

    def test_partner_item_needs_a_positive_payout(self):
        self.assert_rejected(price=Decimal('60.00'), partner=self.kape, partner_payout=Decimal('0.00'))

    def test_own_item_has_no_payout(self):
        self.assert_rejected(price=Decimal('60.00'), partner=None, partner_payout=Decimal('5.00'))

    def test_patong_is_never_negative(self):
        self.assert_rejected(price=Decimal('60.00'), partner=self.kape, partner_payout=Decimal('61.00'))

    def test_zero_patong_is_allowed(self):
        item = self.partner_item(price='50.00', payout='50.00')
        self.assertEqual(item.price - item.partner_payout, Decimal('0.00'))

    def test_partner_with_items_cannot_be_deleted(self):
        self.partner_item()
        with self.assertRaises(ProtectedError):
            self.kape.delete()

    def test_payment_amount_must_be_positive(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 14), amount=Decimal('0.00'),
                                          recorded_by=self.owner_user)

    def test_voided_payment_needs_a_reason(self):
        payment = PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 14), amount=Decimal('100.00'),
                                                recorded_by=self.owner_user)
        payment.voided_at, payment.voided_by = payment.created_at, self.owner_user
        with self.assertRaises(IntegrityError), transaction.atomic():
            payment.save()
