from django.core.management.base import BaseCommand

from orders.emails import send_due_emails


class Command(BaseCommand):
    help = "Retry new-order emails that are waiting or failed (the Orders page also does this when opened)."

    def handle(self, *args, **options):
        sent = send_due_emails()
        self.stdout.write(f'Sent {sent} new-order email(s).')
