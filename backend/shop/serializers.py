"""Validation for the Shop settings document, and the public and owner views of it."""
import re

from django.core.validators import RegexValidator
from django.utils import timezone
from rest_framework import serializers

from .models import PAYMENT_METHODS, DayOff, DeliveryHours, DeliveryTown, MeetupPlace, ShopSettings

MESSENGER_LINK = RegexValidator(r'^https://(m\.me|www\.messenger\.com)/[^\s<>"]+$',
                                'Use your Messenger link, like https://m.me/rowszeinsdelight.')
FACEBOOK_LINK = RegexValidator(r'^https://(((www|m|web)\.)?facebook\.com|fb\.com)/[^\s<>"]+$',
                               'Use your Facebook page link, like https://www.facebook.com/rowszeinsdelight.')
# A plain address only: no quoted parts, markup, or ?/& that would add headers to a mailto: link.
PLAIN_EMAIL = RegexValidator(r'^[^\s"<>?&]+@[^\s"<>?&]+$', 'Enter an email address like hello@rowszeinsdelight.com.')
PHONE = RegexValidator(r'^[+0-9()\-\s]{7,20}$', 'Enter a phone number like 0917 123 4567.')
PLAIN_TEXT = RegexValidator(r'^[^<>]*$', "Leave out the < and > characters.")
TIME_FORMAT = '%H:%M'
MAX_TOWNS = 20
MAX_DAYS_OFF = 30
PUBLIC_DAYS_OFF = 10


def _text(max_length, **extra):
    return serializers.CharField(max_length=max_length, allow_blank=True, validators=[PLAIN_TEXT], **extra)


class HoursRowSerializer(serializers.Serializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    is_open = serializers.BooleanField()
    opens = serializers.TimeField(format=TIME_FORMAT, allow_null=True, required=False)
    closes = serializers.TimeField(format=TIME_FORMAT, allow_null=True, required=False)

    def validate(self, row):
        if not row['is_open']:
            return row
        errors = {field: 'Enter a time.' for field in ('opens', 'closes') if not row.get(field)}
        if not errors and row['opens'] >= row['closes']:
            errors['closes'] = 'Closing time must be after opening time.'
        if errors:
            raise serializers.ValidationError(errors)
        return row


class TownRowSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=60, validators=[PLAIN_TEXT])
    is_active = serializers.BooleanField()
    fee = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=0, max_value=1000, allow_null=True)


class DayOffRowSerializer(serializers.Serializer):
    starts = serializers.DateField()
    ends = serializers.DateField()
    note = _text(80, required=False, default='')

    def validate(self, row):
        if row['ends'] < row['starts']:
            raise serializers.ValidationError({'ends': 'The last day off must be on or after the first.'})
        return row


MAX_MEETUP_PLACES = 10
MEETUP_MIN_MINUTES = 30


def _minutes(value):
    return value.hour * 60 + value.minute


def _seven_days(rows):
    if sorted(row['weekday'] for row in rows) != list(range(7)):
        raise serializers.ValidationError('Set hours for each day of the week, Monday to Sunday, once.')
    return sorted(rows, key=lambda row: row['weekday'])


class MeetupHoursRowSerializer(HoursRowSerializer):
    def validate(self, row):
        row = super().validate(row)
        if row['is_open'] and _minutes(row['closes']) - _minutes(row['opens']) < MEETUP_MIN_MINUTES:
            raise serializers.ValidationError({'closes': 'Leave at least 30 minutes between opening and closing.'})
        return row


class MeetupPlaceRowSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=80, validators=[PLAIN_TEXT])
    note = _text(160, required=False, default='')
    is_active = serializers.BooleanField()
    hours = MeetupHoursRowSerializer(many=True)

    def validate_hours(self, rows):
        return _seven_days(rows)

    def validate(self, row):
        if row['is_active'] and not any(day['is_open'] for day in row['hours']):
            raise serializers.ValidationError({'hours': 'Open this place on at least one day, or switch it off.'})
        return row


class ShopSettingsInputSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=1)
    messenger_url = serializers.CharField(max_length=200, validators=[MESSENGER_LINK])
    facebook_url = serializers.CharField(max_length=200, allow_blank=True, validators=[FACEBOOK_LINK])
    email = serializers.EmailField(allow_blank=True, max_length=254, validators=[PLAIN_EMAIL])
    order_email = serializers.EmailField(allow_blank=True, max_length=254, validators=[PLAIN_EMAIL], required=False, default='')
    phone = serializers.CharField(max_length=20, allow_blank=True, validators=[PHONE])
    notice = _text(160)
    orders_paused = serializers.BooleanField()
    pause_message = _text(160)
    lead_days = serializers.IntegerField(min_value=0, max_value=7)
    order_cutoff = serializers.TimeField(format=TIME_FORMAT, allow_null=True)
    show_hours = serializers.BooleanField()
    payment_methods = serializers.ListField(child=serializers.CharField(), max_length=8)
    hours = HoursRowSerializer(many=True)
    towns = TownRowSerializer(many=True, max_length=MAX_TOWNS)
    days_off = DayOffRowSerializer(many=True, max_length=MAX_DAYS_OFF)
    # Optional: a save from a page that predates meet-ups keeps the stored places.
    meetup_places = MeetupPlaceRowSerializer(many=True, required=False, max_length=MAX_MEETUP_PLACES)

    def validate_messenger_url(self, value):
        return value.strip()

    def validate_payment_methods(self, value):
        if any(method not in PAYMENT_METHODS for method in value):
            raise serializers.ValidationError('Pick from GCash, Maya, Bank transfer or Cash on delivery.')
        return [method for method in PAYMENT_METHODS if method in value]

    def validate_hours(self, rows):
        return _seven_days(rows)

    def validate_towns(self, rows):
        return _unique_rows(rows, DeliveryTown, 'town')

    def validate_meetup_places(self, rows):
        return _unique_rows(rows, MeetupPlace, 'place')


def _unique_rows(rows, model, noun):
    """Tidy names; each must be unique ignoring case, and any id must still exist."""
    errors, seen, known = [{} for _ in rows], set(), set(model.objects.values_list('id', flat=True))
    for index, row in enumerate(rows):
        row['name'] = re.sub(r'\s+', ' ', row['name']).strip()
        key = row['name'].casefold()
        if not row['name']:
            errors[index]['name'] = [f'Enter the {noun} name.']
        elif key in seen:
            errors[index]['name'] = [f'This {noun} is already in the list.']
        if 'id' in row and row['id'] not in known:
            errors[index]['id'] = [f'This {noun} was removed. Reload the page.']
        seen.add(key)
    if any(errors):
        raise serializers.ValidationError(errors)
    return rows


def flatten_errors(errors, prefix=''):
    """DRF's nested errors as {"hours.2.closes": ["..."]}, the shape the forms read."""
    if isinstance(errors, dict):
        flat = {}
        for key, value in errors.items():
            path = prefix if key in ('non_field_errors',) else (f'{prefix}.{key}' if prefix else str(key))
            flat.update(flatten_errors(value, path or 'non_field_errors'))
        return flat
    if isinstance(errors, list) and errors and all(isinstance(item, (dict, list)) for item in errors):
        flat = {}
        for index, item in enumerate(errors):
            flat.update(flatten_errors(item, f'{prefix}.{index}'))
        return flat
    messages = [str(message) for message in (errors if isinstance(errors, list) else [errors])]
    return {prefix: messages} if messages else {}


def _time(value):
    return value.strftime(TIME_FORMAT) if value else None


def _fee(value):
    return None if value is None else format(value, '.2f')


def _contact_and_ordering(settings):
    return {
        'messenger_url': settings.messenger_url,
        'facebook_url': settings.facebook_url,
        'email': settings.email,
        'phone': settings.phone,
        'notice': settings.notice,
        'orders_paused': settings.orders_paused,
        'pause_message': settings.pause_message,
        'lead_days': settings.lead_days,
        'order_cutoff': _time(settings.order_cutoff),
        'payment_methods': list(settings.payment_methods),
    }


def _upcoming_days_off():
    return DayOff.objects.filter(ends__gte=timezone.localdate())


def public_document():
    settings = ShopSettings.load()
    hours = [] if not settings.show_hours else [
        {'weekday': row.weekday, 'is_open': row.is_open,
         'opens': _time(row.opens) if row.is_open else None, 'closes': _time(row.closes) if row.is_open else None}
        for row in DeliveryHours.objects.all()
    ]
    return {
        **_contact_and_ordering(settings),
        'hours': hours,
        'towns': [{'id': town.id, 'name': town.name, 'fee': _fee(town.fee)}
                  for town in DeliveryTown.objects.filter(is_active=True)],
        'days_off': [{'starts': day.starts.isoformat(), 'ends': day.ends.isoformat(), 'note': day.note}
                     for day in _upcoming_days_off()[:PUBLIC_DAYS_OFF]],
        'meetup_places': meetup_places_document(active_only=True),
    }


def managed_document():
    settings = ShopSettings.load()
    return {
        **_contact_and_ordering(settings),
        'show_hours': settings.show_hours,
        'order_email': settings.order_email,
        'revision': settings.revision,
        'updated_at': settings.updated_at.isoformat(),
        'hours': [{'weekday': row.weekday, 'is_open': row.is_open, 'opens': _time(row.opens), 'closes': _time(row.closes)}
                  for row in DeliveryHours.objects.all()],
        'towns': [{'id': town.id, 'name': town.name, 'is_active': town.is_active, 'fee': _fee(town.fee)}
                  for town in DeliveryTown.objects.all()],
        'days_off': [{'starts': day.starts.isoformat(), 'ends': day.ends.isoformat(), 'note': day.note}
                     for day in _upcoming_days_off()],
        'meetup_places': meetup_places_document(active_only=False),
    }


def _week(rows):
    return [{'weekday': row.weekday, 'is_open': row.is_open, 'opens': _time(row.opens), 'closes': _time(row.closes)}
            for row in rows]


def meetup_places_document(active_only: bool) -> list[dict]:
    places = MeetupPlace.objects.prefetch_related('hours')
    if active_only:
        return [{'id': place.id, 'name': place.name, 'note': place.note, 'hours': _week(place.hours.all())}
                for place in places.filter(is_active=True)]
    return [{'id': place.id, 'name': place.name, 'note': place.note, 'is_active': place.is_active,
             'hours': _week(place.hours.all())} for place in places]
