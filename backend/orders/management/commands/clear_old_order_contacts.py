from django.core.management.base import BaseCommand
from django.utils import timezone

from orders.owner import clear_old_contacts


class Command(BaseCommand):
    help = "Clear phone, address and note on orders delivered over 90 days ago (the Orders page also does this)."

    def handle(self, *args, **options):
        cleared = clear_old_contacts(timezone.localdate())
        self.stdout.write(f'Cleared contact details on {cleared} order(s).')
