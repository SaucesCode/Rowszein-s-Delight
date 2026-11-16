"""The owner's new-order email: sent after the order is saved, retried, and never carrying contact details."""
import json
from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone

from backend.log_format import JsonFormatter
from shop.models import ShopSettings

from ..emails import deliver, send_due_emails
from ..models import OnlineOrder, OrderEmail
from .test_place import OrderFixture

KEY = 're_test_key_never_real'


@override_settings(RESEND_API_KEY=KEY, ORDER_EMAIL_FROM="Rowszein's Delight <onboarding@resend.dev>",
                   APP_URL='https://shop.example', ORDER_EMAIL_INLINE=True)
class OrderEmailTests(OrderFixture, TestCase):
    def setUp(self):
        super().setUp()
        ShopSettings.objects.update(order_email='owner@example.com')
        self.assertEqual(self.place(note='Ring the bell twice').status_code, 201)
        self.order = OnlineOrder.objects.get()
        self.email = OrderEmail.objects.get()

    def test_sends_to_the_private_address_without_contact_details(self):
        with mock.patch('orders.emails.post_to_resend') as post:
            self.assertEqual(deliver(self.email.pk), 'sent')
        payload = post.call_args.args[0]
        self.assertEqual(payload['to'], ['owner@example.com'])
        self.assertEqual(payload['from'], "Rowszein's Delight <onboarding@resend.dev>")
        self.assertEqual(payload['subject'], f'New order {self.order.number} for Nov 18')
        self.assertIn(f'https://shop.example/orders/{self.order.pk}', payload['text'])
        self.assertIn('Ana', payload['text'])
        self.assertIn('Lucena City', payload['text'])
        text = json.dumps(payload)
        for private in ('+639171234567', '0917', 'Rizal', 'Ring the bell', 'Cruz'):
            self.assertNotIn(private, text)
        self.email.refresh_from_db()
        self.assertEqual((self.email.status, self.email.attempts), ('sent', 1))
        self.assertIsNotNone(self.email.sent_at)

    def test_no_recipient_marks_failed(self):
        ShopSettings.objects.update(order_email='')
        with mock.patch('orders.emails.post_to_resend') as post:
            self.assertEqual(deliver(self.email.pk), 'failed')
        post.assert_not_called()
        self.email.refresh_from_db()
        self.assertEqual((self.email.status, self.email.last_error), ('failed', 'No email address set'))

    @override_settings(RESEND_API_KEY='')
    def test_without_api_key_logs_and_marks_sent(self):
        with self.assertLogs('orders', 'INFO') as logs, mock.patch('orders.emails.post_to_resend') as post:
            self.assertEqual(deliver(self.email.pk), 'sent')
        post.assert_not_called()
        self.assertIn('would send', logs.output[0])
        self.assertNotIn('owner@example.com', ' '.join(logs.output))
        line = json.loads(JsonFormatter().format(logs.records[0]))
        self.assertEqual((line['order_id'], line['attempt'], line['outcome']), (self.order.pk, 1, 'logged'))

    def test_failure_is_retried_later_and_capped(self):
        with mock.patch('orders.emails.post_to_resend', side_effect=RuntimeError('boom')):
            self.assertEqual(deliver(self.email.pk), 'failed')
        self.email.refresh_from_db()
        self.assertEqual(self.email.last_error, 'RuntimeError: boom')
        self.assertNotIn(KEY, self.email.last_error)
        now = timezone.now()
        with mock.patch('orders.emails.post_to_resend') as post:
            self.assertEqual(send_due_emails(now + timedelta(minutes=4)), 0)
            post.assert_not_called()
            self.assertEqual(send_due_emails(now + timedelta(minutes=6)), 1)
        self.email.refresh_from_db()
        self.assertEqual((self.email.status, self.email.attempts), ('sent', 2))
        OrderEmail.objects.filter(pk=self.email.pk).update(status='failed', attempts=5)
        with mock.patch('orders.emails.post_to_resend') as post:
            self.assertEqual(send_due_emails(now + timedelta(hours=1)), 0)
            post.assert_not_called()

    def test_a_sent_email_is_never_sent_again(self):
        with mock.patch('orders.emails.post_to_resend') as post:
            deliver(self.email.pk)
            self.assertEqual(deliver(self.email.pk), 'skipped')
        self.assertEqual(post.call_count, 1)

    def test_order_is_saved_even_when_sending_fails(self):
        with mock.patch('orders.emails.post_to_resend', side_effect=TimeoutError()), \
                self.captureOnCommitCallbacks(execute=True):
            response = self.place()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(OnlineOrder.objects.count(), 2)
        newest = OrderEmail.objects.order_by('-pk').first()
        self.assertEqual((newest.status, newest.last_error), ('failed', 'TimeoutError'))


class SendOrderEmailsCommandTests(TestCase):
    def test_command_reports_how_many_were_sent(self):
        from io import StringIO

        from django.core.management import call_command
        out = StringIO()
        call_command('send_order_emails', stdout=out)
        self.assertEqual(out.getvalue().strip(), 'Sent 0 new-order email(s).')


@override_settings(RESEND_API_KEY=KEY, ORDER_EMAIL_INLINE=True)
class OutboxSafetyTests(OrderFixture, TestCase):
    def setUp(self):
        super().setUp()
        ShopSettings.objects.update(order_email='owner@example.com')
        self.place()
        self.email = OrderEmail.objects.get()

    def test_two_sweeps_with_the_same_list_send_once(self):
        old = timezone.now() - timedelta(minutes=10)
        OrderEmail.objects.filter(pk=self.email.pk).update(status='failed', attempts=1, updated_at=old)
        cutoff = timezone.now() - timedelta(minutes=5)
        with mock.patch('orders.emails.post_to_resend', side_effect=RuntimeError('down')) as post:
            self.assertEqual(deliver(self.email.pk, due_before=cutoff), 'failed')
            # A second sweep that read the same due list a moment earlier finds the row already claimed.
            self.assertEqual(deliver(self.email.pk, due_before=cutoff), 'skipped')
        self.assertEqual(post.call_count, 1)
        self.email.refresh_from_db()
        self.assertEqual(self.email.attempts, 2)

    def test_missing_address_does_not_use_up_attempts(self):
        ShopSettings.objects.update(order_email='')
        for _ in range(6):
            deliver(self.email.pk)
        self.email.refresh_from_db()
        self.assertEqual((self.email.status, self.email.attempts), ('failed', 0))
        ShopSettings.objects.update(order_email='owner@example.com')
        with mock.patch('orders.emails.post_to_resend'):
            self.assertEqual(deliver(self.email.pk), 'sent')

    def test_background_work_closes_its_connections_and_logs_failures(self):
        from ..emails import in_background_thread
        with mock.patch('orders.emails.connections') as connections, self.assertLogs('orders', 'ERROR') as logs:
            in_background_thread(mock.Mock(side_effect=RuntimeError('boom')))
        connections.close_all.assert_called_once()
        self.assertIn('Background order email work failed', logs.output[0])
