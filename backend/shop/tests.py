from datetime import date, time
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from accounts.models import User
from accounts.permissions import can

from .models import DayOff, DeliveryHours, DeliveryTown, ShopSettings


class ShopSettingsModelTests(TestCase):
    def assert_rejected(self, action):
        with self.assertRaises(IntegrityError), transaction.atomic():
            action()

    def test_seed_creates_the_shop_defaults(self):
        settings = ShopSettings.load()
        self.assertEqual(settings.messenger_url, 'https://m.me/rowszeinsdelight')
        self.assertEqual(settings.email, 'hello@rowszeinsdelight.com')
        self.assertFalse(settings.show_hours)
        self.assertEqual(settings.lead_days, 1)
        self.assertIsNone(settings.order_cutoff)
        self.assertEqual(settings.revision, 1)
        hours = list(DeliveryHours.objects.order_by('weekday'))
        self.assertEqual([row.weekday for row in hours], list(range(7)))
        for row in hours:
            self.assertEqual((row.is_open, row.opens, row.closes), (True, time(9), time(18)))
        towns = list(DeliveryTown.objects.all())
        self.assertEqual([town.name for town in towns], ['Lucena City', 'Tayabas', 'Sariaya'])
        self.assertTrue(all(town.is_active and town.fee is None for town in towns))

    def test_second_settings_row_is_rejected(self):
        self.assert_rejected(lambda: ShopSettings.objects.create(pk=2, messenger_url='https://m.me/x'))

    def test_open_day_needs_closing_after_opening(self):
        self.assert_rejected(lambda: DeliveryHours.objects.filter(weekday=2).update(
            is_open=True, opens=time(18), closes=time(9)))

    def test_open_day_needs_both_times(self):
        self.assert_rejected(lambda: DeliveryHours.objects.filter(weekday=2).update(is_open=True, closes=None))

    def test_town_names_are_unique_ignoring_case(self):
        self.assert_rejected(lambda: DeliveryTown.objects.create(name='lucena city', position=9))

    def test_town_fee_over_1000_is_rejected(self):
        self.assert_rejected(lambda: DeliveryTown.objects.create(name='Pagbilao', fee=Decimal('1000.01'), position=9))

    def test_day_off_cannot_end_before_it_starts(self):
        self.assert_rejected(lambda: DayOff.objects.create(starts=date(2026, 12, 26), ends=date(2026, 12, 24)))

    def test_lead_days_stay_within_a_week(self):
        self.assert_rejected(lambda: ShopSettings.objects.filter(pk=1).update(lead_days=8))

    def test_only_the_owner_can_manage_shop_settings(self):
        owner = User.objects.create_user(username='settings-owner', role='admin')
        staff = User.objects.create_user(username='settings-staff', role='staff')
        self.assertTrue(can(owner, 'shop.manage'))
        self.assertFalse(can(staff, 'shop.manage'))
