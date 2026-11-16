"""Meet-up orders: the owner's places, a day the place is open, and a 30-minute time inside its hours."""
from datetime import date, time
from unittest import mock

from django.test import TestCase

from shop.models import DeliveryTown, MeetupHours, MeetupPlace, ShopSettings

from ..emails import deliver
from ..meetups import meetup_day_problem, meetup_time_problem, meetup_times
from ..models import OnlineOrder, OrderEmail
from .test_owner import MANAGE, OwnerFixture
from .test_place import PLACE_URL, manila

SATURDAY = date(2026, 11, 21)
WEDNESDAY = date(2026, 11, 18)


def make_place(name='SM City Lucena, main entrance', note='Look for the pink box', active=True, hours=None):
    place = MeetupPlace.objects.create(name=name, note=note, is_active=active)
    hours = hours or {5: (time(14), time(17)), 2: (time(10), time(12))}
    for weekday in range(7):
        opens, closes = hours.get(weekday, (None, None))
        MeetupHours.objects.create(place=place, weekday=weekday, is_open=weekday in hours, opens=opens, closes=closes)
    return place


class MeetupFixture(OwnerFixture):
    def setUp(self):
        super().setUp()
        self.spot = make_place()

    def meetup(self, **changes):
        body = self.body(fulfilment='meetup', meetup_place=self.spot.id, delivery_date='2026-11-21', meetup_time='15:00',
                         town=None, address='')
        body.update(changes)
        return self.client.post(PLACE_URL, body, format='json')


class MeetupRuleTests(MeetupFixture, TestCase):
    def test_meetup_times_follow_the_place_hours(self):
        times = meetup_times(self.spot, SATURDAY, manila(16, 10))
        self.assertEqual(times, [time(14), time(14, 30), time(15), time(15, 30), time(16), time(16, 30)])
        self.assertEqual(meetup_times(self.spot, date(2026, 11, 19), manila(16, 10)), [])

    def test_today_needs_an_hour(self):
        ShopSettings.objects.update(lead_days=0)
        self.assertEqual(meetup_times(self.spot, WEDNESDAY, manila(18, 10, 20)), [time(11, 30)])
        self.assertEqual(meetup_times(self.spot, WEDNESDAY, manila(18, 11, 10)), [])
        self.assertEqual(meetup_day_problem(self.spot, WEDNESDAY, manila(18, 11, 10)),
                         "We don't meet there on Nov 18. Pick another day.")
        self.assertEqual(meetup_time_problem(self.spot, WEDNESDAY, time(11), manila(18, 10, 20)),
                         'Pick a time at least an hour from now.')

    def test_days_follow_the_shop_rules(self):
        self.assertIsNone(meetup_day_problem(self.spot, SATURDAY, manila(16, 10)))
        self.assertEqual(meetup_day_problem(self.spot, date(2026, 11, 19), manila(16, 10)),
                         "We don't meet there on Nov 19. Pick another day.")
        self.assertEqual(meetup_day_problem(self.spot, date(2026, 11, 16), manila(16, 10)), 'Pick a day from Nov 17.')


class MeetupOrderTests(MeetupFixture, TestCase):
    def test_places_a_meetup_order(self):
        DeliveryTown.objects.filter(name='Lucena City').update(fee='50.00')
        response = self.meetup()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()['data']
        self.assertEqual(data['fulfilment'], 'meetup')
        self.assertEqual(data['delivery_fee'], '0.00')
        self.assertEqual(data['total'], data['subtotal'])
        self.assertEqual(data['meetup_time'], '15:00')
        self.assertEqual(data['fulfilment_line'], 'Meet-up: SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM')
        order = OnlineOrder.objects.get()
        self.assertEqual((order.town_name, order.address, order.meetup_place_note), ('', '', 'Look for the pink box'))

    def test_meetup_rules(self):
        self.spot_off = make_place(name='Closed spot', active=False)
        cases = [
            ({'meetup_place': 999999}, 'meetup_place', 'Pick where to meet.'),
            ({'meetup_place': self.spot_off.id}, 'meetup_place', 'Pick where to meet.'),
            ({'delivery_date': '2026-11-19'}, 'delivery_date', "We don't meet there on Nov 19. Pick another day."),
            ({'meetup_time': '17:00'}, 'meetup_time', 'Pick a time between 2:00 PM and 4:30 PM.'),
            ({'meetup_time': '13:30'}, 'meetup_time', 'Pick a time between 2:00 PM and 4:30 PM.'),
            ({'meetup_time': '15:10'}, 'meetup_time', 'Pick a time between 2:00 PM and 4:30 PM.'),
            ({'meetup_time': None}, 'meetup_time', 'Pick a time.'),
        ]
        for changes, key, message in cases:
            errors = self.errors(self.meetup(**changes))
            self.assertEqual(errors.get(key), [message], (changes, errors))

    def test_delivery_still_needs_town_and_address(self):
        self.assertIn('address', self.errors(self.place(address='')))
        self.assertIn('town', self.errors(self.place(town=None)))

    def test_fingerprint_includes_the_meetup(self):
        first = self.meetup(client_key='same-key-123')
        self.assertEqual(first.status_code, 201)
        again = self.meetup(client_key='same-key-123', meetup_time='16:00')
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()['error']['code'], 'already_sent')


class MeetupConfirmTests(MeetupFixture, TestCase):
    def test_confirm_records_a_meetup_sale_and_emails_the_line(self):
        ShopSettings.objects.update(order_email='owner@example.com')
        self.assertEqual(self.meetup().status_code, 201)
        order = OnlineOrder.objects.get()
        with self.settings(RESEND_API_KEY='re_test'), mock.patch('orders.emails.post_to_resend') as post:
            deliver(OrderEmail.objects.get().pk)
        self.assertIn('Meet-up: SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM', post.call_args.args[0]['text'])
        self.assertEqual(self.confirm(order).status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.sale.notes,
                         f'Online order {order.number}, Ana Cruz, meet-up at SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM')

    def test_renamed_or_removed_place_keeps_the_snapshot(self):
        self.assertEqual(self.meetup().status_code, 201)
        order = OnlineOrder.objects.get()
        MeetupPlace.objects.filter(pk=self.spot.pk).update(name='Somewhere else', note='')
        self.spot.delete()
        detail = self.owner.get(f'{MANAGE}{order.pk}/').json()['data']
        self.assertEqual(detail['meetup_place_name'], 'SM City Lucena, main entrance')
        self.assertEqual(detail['meetup_place_note'], 'Look for the pink box')
        self.assertEqual(detail['fulfilment_line'], 'Meet-up: SM City Lucena, main entrance, Sat, Nov 21, 3:00 PM')
        order.refresh_from_db()
        self.assertIsNone(order.meetup_place)
        self.assertEqual(self.confirm(order).status_code, 200)
