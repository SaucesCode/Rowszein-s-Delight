import logging

from django.db import transaction
from django.utils import timezone

from .models import DayOff, DeliveryHours, DeliveryTown, ShopSettings
from .serializers import managed_document

logger = logging.getLogger('shop.settings')

SETTINGS_FIELDS = ('messenger_url', 'facebook_url', 'email', 'order_email', 'phone', 'notice', 'orders_paused', 'pause_message',
                   'lead_days', 'order_cutoff', 'show_hours', 'payment_methods')


class StaleRevision(Exception):
    """The settings changed since the editor loaded them."""


def save_settings(actor, data, revision):
    """Replace the whole settings document. `data` is ShopSettingsInputSerializer.validated_data."""
    with transaction.atomic():
        settings = ShopSettings.objects.select_for_update().get(pk=1)
        if settings.revision != revision:
            raise StaleRevision()
        before = managed_document()

        for field in SETTINGS_FIELDS:
            setattr(settings, field, data[field])
        settings.revision += 1
        settings.updated_by = actor
        settings.save()

        for row in data['hours']:
            DeliveryHours.objects.update_or_create(weekday=row['weekday'], defaults={
                'is_open': row['is_open'], 'opens': row.get('opens'), 'closes': row.get('closes')})

        kept = [row['id'] for row in data['towns'] if 'id' in row]
        DeliveryTown.objects.exclude(id__in=kept).delete()
        # Placeholder names first, so two towns can swap names without tripping the unique-name rule midway.
        for town_id in kept:
            DeliveryTown.objects.filter(id=town_id).update(name=f'~renaming~{town_id}')
        for position, row in enumerate(data['towns']):
            values = {'name': row['name'], 'is_active': row['is_active'], 'fee': row['fee'], 'position': position}
            if 'id' in row:
                DeliveryTown.objects.filter(id=row['id']).update(**values)
            else:
                DeliveryTown.objects.create(**values)

        today = timezone.localdate()
        DayOff.objects.all().delete()
        DayOff.objects.bulk_create(DayOff(starts=row['starts'], ends=row['ends'], note=row.get('note', ''))
                                   for row in data['days_off'] if row['ends'] >= today)

        after = managed_document()
        changed = ','.join(sorted(key for key in after if key not in ('revision', 'updated_at') and before[key] != after[key]))
        actor_id = actor.pk
        transaction.on_commit(lambda: logger.info('Shop settings saved', extra={
            'actor_id': actor_id, 'revision': settings.revision, 'changed': changed}))
    return settings
