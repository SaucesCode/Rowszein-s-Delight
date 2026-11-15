"""Meet-up places in the Shop settings document."""
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User

from .models import MeetupPlace

MANAGE = '/api/shop/settings/manage/'
PUBLIC = '/api/shop/settings/'


def week(open_days=None):
    """Seven rows; `open_days` maps weekday → (opens, closes)."""
    open_days = open_days or {}
    return [{'weekday': day, 'is_open': day in open_days,
             'opens': open_days.get(day, (None, None))[0], 'closes': open_days.get(day, (None, None))[1]}
            for day in range(7)]


def place(name='SM City Lucena, main entrance', note='Look for the pink box', active=True, hours=None, **extra):
    return {'name': name, 'note': note, 'is_active': active, 'hours': hours or week({5: ('14:00', '17:00')}), **extra}


class MeetupSettingsTests(TestCase):
    def setUp(self):
        self.owner = APIClient()
        self.owner.force_authenticate(User.objects.create_user(username='meetup-owner', role='admin'))

    def body(self, **changes):
        doc = self.owner.get(MANAGE).json()['data']
        doc.pop('updated_at')
        doc.update(changes)
        return doc

    def put(self, body):
        return self.owner.put(MANAGE, body, format='json')

    def errors(self, body):
        response = self.put(body)
        self.assertEqual(response.status_code, 400, response.content)
        return response.json()['error']

    def test_new_settings_have_no_places(self):
        self.assertEqual(self.owner.get(MANAGE).json()['data']['meetup_places'], [])
        self.assertEqual(APIClient().get(PUBLIC).json()['data']['meetup_places'], [])

    def test_owner_adds_places_with_hours(self):
        response = self.put(self.body(meetup_places=[place(), place(name='Tayabas plaza', active=False)]))
        self.assertEqual(response.status_code, 200, response.content)
        managed = response.json()['data']['meetup_places']
        self.assertEqual([p['name'] for p in managed], ['SM City Lucena, main entrance', 'Tayabas plaza'])
        self.assertTrue(all(len(p['hours']) == 7 and 'id' in p for p in managed))
        public = APIClient().get(PUBLIC).json()['data']['meetup_places']
        self.assertEqual(len(public), 1)
        self.assertNotIn('is_active', public[0])
        self.assertEqual(public[0]['note'], 'Look for the pink box')
        self.assertEqual(public[0]['hours'][5], {'weekday': 5, 'is_open': True, 'opens': '14:00', 'closes': '17:00'})

    def test_place_rules(self):
        cases = [
            ([place(), place(name='sm city lucena, MAIN entrance')], 'meetup_places.1.name', 'This place is already in the list.'),
            ([place(hours=week({5: ('14:00', '14:20')}))], 'meetup_places.0.hours.5.closes',
             'Leave at least 30 minutes between opening and closing.'),
            ([place(hours=week())], 'meetup_places.0.hours', 'Open this place on at least one day, or switch it off.'),
            ([place(note='<b>hi</b>')], 'meetup_places.0.note', None),
            ([place(hours=week({5: ('14:00', '17:00')})[:6])], 'meetup_places.0.hours', None),
            ([place(name=f'Place {n}') for n in range(11)], 'meetup_places', None),
        ]
        for places, key, message in cases:
            errors = self.errors(self.body(meetup_places=places))
            self.assertIn(key, errors, key)
            if message:
                self.assertEqual(errors[key], [message])
        self.assertEqual(self.put(self.body(meetup_places=[place(active=False, hours=week())])).status_code, 200)

    def test_put_without_places_keeps_them(self):
        self.put(self.body(meetup_places=[place()]))
        body = self.body(notice='Closed on Sunday')
        body.pop('meetup_places')
        self.assertEqual(self.put(body).status_code, 200)
        self.assertEqual(MeetupPlace.objects.count(), 1)

    def test_places_can_swap_names_and_be_removed(self):
        saved = self.put(self.body(meetup_places=[place(name='A'), place(name='B')])).json()['data']['meetup_places']
        a, b = saved
        swapped = self.put(self.body(meetup_places=[dict(a, name='b'), dict(b, name='A')]))
        self.assertEqual(swapped.status_code, 200, swapped.content)
        self.assertEqual([p['name'] for p in swapped.json()['data']['meetup_places']], ['b', 'A'])
        self.assertEqual(self.put(self.body(meetup_places=[])).status_code, 200)
        self.assertEqual(MeetupPlace.objects.count(), 0)
