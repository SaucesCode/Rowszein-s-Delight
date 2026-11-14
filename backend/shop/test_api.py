import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from backend.log_format import JsonFormatter

from .models import DayOff, DeliveryTown, ShopSettings

SETTINGS_URL = '/api/shop/settings/'
MANAGE_URL = '/api/shop/settings/manage/'


class ShopSettingsApiTests(TestCase):
    def setUp(self):
        self.owner = APIClient()
        self.owner.force_authenticate(User.objects.create_user(username='api-owner', role='admin'))
        self.staff = APIClient()
        self.staff.force_authenticate(User.objects.create_user(username='api-staff', role='staff'))
        self.anonymous = APIClient()
        self.today = timezone.localdate()

    def body(self, **changes):
        """The current manage document as a PUT body, with changes applied."""
        doc = self.owner.get(MANAGE_URL).json()['data']
        doc.pop('updated_at')
        doc.update(changes)
        return doc

    def put(self, body):
        return self.owner.put(MANAGE_URL, body, format='json')

    def test_public_read_hides_hours_until_shown(self):
        response = self.anonymous.get(SETTINGS_URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['hours'], [])
        self.assertEqual(data['messenger_url'], 'https://m.me/rowszeinsdelight')
        for private in ('revision', 'updated_by', 'show_hours', 'updated_at'):
            self.assertNotIn(private, data)

    def test_public_read_lists_active_towns_and_upcoming_days_off(self):
        DeliveryTown.objects.filter(name='Sariaya').update(is_active=False)
        DayOff.objects.create(starts=self.today - timedelta(days=3), ends=self.today - timedelta(days=1), note='Ended')
        DayOff.objects.create(starts=self.today - timedelta(days=1), ends=self.today, note='Ends today')
        for offset in range(12):
            day = self.today + timedelta(days=30 - offset)
            DayOff.objects.create(starts=day, ends=day)
        data = self.anonymous.get(SETTINGS_URL).json()['data']
        self.assertEqual([town['name'] for town in data['towns']], ['Lucena City', 'Tayabas'])
        self.assertNotIn('is_active', data['towns'][0])
        self.assertEqual(len(data['days_off']), 10)
        self.assertEqual(data['days_off'][0]['note'], 'Ends today')
        starts = [day['starts'] for day in data['days_off']]
        self.assertEqual(starts, sorted(starts))

    def test_staff_and_anonymous_cannot_manage(self):
        self.assertEqual(self.staff.get(MANAGE_URL).status_code, 403)
        self.assertEqual(self.staff.put(MANAGE_URL, {}, format='json').status_code, 403)
        self.assertIn(self.anonymous.put(MANAGE_URL, {}, format='json').status_code, (401, 403))
        self.assertIn(self.anonymous.get(MANAGE_URL).status_code, (401, 403))

    def test_owner_saves_the_whole_document(self):
        body = self.body(show_hours=True, payment_methods=['cod', 'gcash', 'gcash'], notice='No deliveries on Nov 30',
                         order_cutoff='15:00')
        body['hours'][0] = {'weekday': 0, 'is_open': False, 'opens': None, 'closes': None}
        lucena, tayabas, _sariaya = body['towns']
        body['towns'] = [dict(lucena, fee='0.00'), dict(tayabas, fee=None),
                         {'name': 'Pagbilao', 'is_active': True, 'fee': '80.00'}]
        body['days_off'] = [{'starts': str(self.today + timedelta(days=40)), 'ends': str(self.today + timedelta(days=42)),
                             'note': 'Christmas break'}]
        response = self.put(body)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()['data']
        self.assertEqual(data['revision'], 2)
        self.assertEqual(data['payment_methods'], ['gcash', 'cod'])
        self.assertEqual(data['order_cutoff'], '15:00')
        self.assertEqual([town['name'] for town in data['towns']], ['Lucena City', 'Tayabas', 'Pagbilao'])
        self.assertEqual(data['towns'][0]['id'], lucena['id'])
        self.assertFalse(DeliveryTown.objects.filter(name='Sariaya').exists())
        public = self.anonymous.get(SETTINGS_URL).json()['data']
        self.assertEqual(len(public['hours']), 7)
        self.assertEqual(public['hours'][0], {'weekday': 0, 'is_open': False, 'opens': None, 'closes': None})
        self.assertEqual(public['hours'][1]['opens'], '09:00')
        self.assertEqual(public['towns'][0]['fee'], '0.00')
        self.assertIsNone(public['towns'][1]['fee'])
        self.assertEqual(public['days_off'][0]['note'], 'Christmas break')
        self.assertEqual(ShopSettings.load().updated_by.username, 'api-owner')

    def test_messenger_link_is_required_and_must_be_messenger(self):
        for bad in ('', 'https://evil.example/x', 'http://m.me/rowszeinsdelight', 'https://m.me.evil.example/x'):
            response = self.put(self.body(messenger_url=bad))
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn('messenger_url', response.json()['error'])
        self.assertEqual(ShopSettings.load().revision, 1)
        good = self.put(self.body(messenger_url='https://www.messenger.com/t/rowszeinsdelight'))
        self.assertEqual(good.status_code, 200, good.content)

    def test_contact_fields_are_checked(self):
        cases = {'facebook_url': 'https://evil.example/fb', 'email': 'not-an-email', 'phone': 'call me'}
        for field, bad in cases.items():
            response = self.put(self.body(**{field: bad}))
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field, response.json()['error'])
        ok = self.put(self.body(facebook_url='https://www.facebook.com/rowszeinsdelight', email='', phone='0917 123 4567'))
        self.assertEqual(ok.status_code, 200, ok.content)

    def test_row_errors_use_flat_keys(self):
        body = self.body(notice='<b>Sale</b>')
        body['hours'][2] = {'weekday': 2, 'is_open': True, 'opens': '18:00', 'closes': '09:00'}
        body['towns'].insert(1, {'name': 'lucena city', 'is_active': True, 'fee': None})
        body['days_off'] = [{'starts': str(self.today + timedelta(days=5)), 'ends': str(self.today + timedelta(days=2)),
                             'note': ''}]
        errors = self.put(body).json()['error']
        for key in ('hours.2.closes', 'towns.1.name', 'days_off.0.ends', 'notice'):
            self.assertIn(key, errors)
            self.assertIsInstance(errors[key], list)

    def test_hours_must_be_seven_distinct_weekdays(self):
        body = self.body()
        body['hours'] = body['hours'][:6]
        self.assertIn('hours', self.put(body).json()['error'])
        body = self.body()
        body['hours'][6] = dict(body['hours'][6], weekday=5)
        self.assertIn('hours', self.put(body).json()['error'])

    def test_numbers_stay_in_range(self):
        body = self.body(lead_days=8, payment_methods=['gcash', 'paypal'])
        body['towns'][0] = dict(body['towns'][0], fee='1500.00')
        errors = self.put(body).json()['error']
        for key in ('lead_days', 'payment_methods', 'towns.0.fee'):
            self.assertIn(key, errors)

    def test_stale_revision_is_a_conflict(self):
        first = self.body(notice='First tab')
        second = self.body(notice='Second tab')
        self.assertEqual(self.put(first).status_code, 200)
        response = self.put(second)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'conflict')
        self.assertEqual(response.json()['data']['revision'], 2)
        self.assertEqual(response.json()['data']['notice'], 'First tab')
        self.assertEqual(ShopSettings.load().notice, 'First tab')

    def test_two_towns_can_swap_names(self):
        body = self.body()
        lucena, tayabas, sariaya = body['towns']
        body['towns'] = [dict(lucena, name='Tayabas'), dict(tayabas, name='lucena city'), sariaya]
        response = self.put(body)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual([town['name'] for town in response.json()['data']['towns']], ['Tayabas', 'lucena city', 'Sariaya'])

    def test_ended_days_off_are_dropped_on_save(self):
        body = self.body(days_off=[
            {'starts': str(self.today - timedelta(days=4)), 'ends': str(self.today - timedelta(days=1)), 'note': 'Past'},
            {'starts': str(self.today), 'ends': str(self.today), 'note': 'Today'},
        ])
        self.assertEqual(self.put(body).status_code, 200)
        self.assertEqual(list(DayOff.objects.values_list('note', flat=True)), ['Today'])

    def test_save_logs_changed_field_names_only(self):
        with self.assertLogs('shop.settings', 'INFO') as logs, self.captureOnCommitCallbacks(execute=True):
            response = self.put(self.body(notice='Closed Sunday', email='owner@example.com'))
            self.assertEqual(response.status_code, 200)
        self.assertEqual(len(logs.records), 1)
        record = logs.records[0]
        self.assertIn('notice', record.changed)
        self.assertIn('email', record.changed)
        self.assertEqual(record.revision, 2)
        line = json.loads(JsonFormatter().format(record))
        self.assertEqual(line['changed'], 'email,notice')
        self.assertNotIn('owner@example.com', logs.output[0] + str(record.changed))
