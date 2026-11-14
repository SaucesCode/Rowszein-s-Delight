from datetime import time

from django.db import migrations

TOWNS = ['Lucena City', 'Tayabas', 'Sariaya']


def seed(apps, schema_editor):
    ShopSettings = apps.get_model('shop', 'ShopSettings')
    DeliveryHours = apps.get_model('shop', 'DeliveryHours')
    DeliveryTown = apps.get_model('shop', 'DeliveryTown')
    ShopSettings.objects.get_or_create(pk=1, defaults={
        'messenger_url': 'https://m.me/rowszeinsdelight',
        'email': 'hello@rowszeinsdelight.com',
        'lead_days': 1,
        'show_hours': False,
    })
    # Hidden until the owner switches "Show delivery hours in the shop" on; a starting point to edit.
    for weekday in range(7):
        DeliveryHours.objects.get_or_create(weekday=weekday, defaults={'is_open': True, 'opens': time(9), 'closes': time(18)})
    if not DeliveryTown.objects.exists():
        DeliveryTown.objects.bulk_create(DeliveryTown(name=name, position=index) for index, name in enumerate(TOWNS))


class Migration(migrations.Migration):
    dependencies = [('shop', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
