"""The owner's new-order email, sent through Resend's HTTPS API from the OrderEmail outbox.

An order is saved first; its email row is sent after the order commits and retried later if it fails,
so a slow or broken email service never loses an order. The email carries no phone, address or note.
"""
import json
import logging
import threading
import urllib.request
from datetime import datetime, timedelta

from django.conf import settings
from django.db import connections
from django.db.models import F
from django.utils import timezone

from shop.models import ShopSettings

from .delivery import day_label
from .models import OrderEmail

logger = logging.getLogger('orders')

RESEND_URL = 'https://api.resend.com/emails'
RETRY_AFTER = timedelta(minutes=5)
MAX_ATTEMPTS = 5


def post_to_resend(payload: dict) -> None:
    """The only network call. Raises on a non-2xx answer or a timeout."""
    request = urllib.request.Request(
        RESEND_URL, data=json.dumps(payload).encode('utf-8'), method='POST',
        headers={'Authorization': f'Bearer {settings.RESEND_API_KEY}', 'Content-Type': 'application/json',
                 'User-Agent': 'rowszein-delight'},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f'Resend answered {response.status}')


def _message(order) -> tuple[str, str]:
    first_name = order.customer_name.split()[0] if order.customer_name else 'A customer'
    when = day_label(order.delivery_date)
    lines = [f'{line["quantity"]} × {line["name"]}  ₱{line["line_total"]}' for line in order.items]
    lines += [f'{box["name"]}  ₱{box["price"]}' for box in order.boxes]
    fee = f'₱{order.delivery_fee}' if order.delivery_fee is not None else 'to confirm'
    body = '\n'.join([
        f'New order {order.number} from {first_name}.',
        f'Delivery: {when}, {order.town_name}.',
        '',
        *lines,
        '',
        f'Delivery fee: {fee}',
        f'Total: ₱{order.total}',
        '',
        f'Open it to confirm or decline: {settings.APP_URL.rstrip("/")}/orders/{order.pk}',
    ])
    return f'New order {order.number} for {when}', body


def email_problem() -> str:
    """Why new-order emails aren't reaching the owner right now, in a line; '' when nothing is wrong."""
    if not ShopSettings.load().order_email:
        return 'No email address set'
    if not settings.RESEND_API_KEY and not settings.DEBUG:
        return "RESEND_API_KEY isn't set on the server, so new-order emails are only logged."
    latest = OrderEmail.objects.order_by('-updated_at', '-id').first()
    if latest is not None and latest.status == 'failed':
        return latest.last_error or 'Sending failed'
    return ''


def _error_text(error: Exception) -> str:
    detail = str(error)
    return (f'{type(error).__name__}: {detail}' if detail else type(error).__name__)[:120]


def deliver(email_id: int, due_before: datetime | None = None) -> str:
    """Try to send one outbox row: 'sent', 'failed', or 'skipped' when it was sent or claimed elsewhere.

    The row is claimed with one conditional UPDATE (which also moves updated_at), so two sweeps holding the
    same due list never both send it. `due_before` is the sweep's cutoff; a direct send passes None.
    """
    claim = OrderEmail.objects.filter(pk=email_id, status__in=('pending', 'failed'))
    if due_before is not None:
        claim = claim.filter(updated_at__lte=due_before, attempts__lt=MAX_ATTEMPTS)
    recipient = ShopSettings.load().order_email
    if not recipient:
        # Not an attempt: once the owner sets the address, the email still has all its tries.
        marked = claim.update(status='failed', last_error='No email address set', updated_at=timezone.now())
        return 'failed' if marked else 'skipped'
    if not claim.update(attempts=F('attempts') + 1, updated_at=timezone.now()):
        return 'skipped'
    email = OrderEmail.objects.select_related('order').get(pk=email_id)
    order, attempt = email.order, email.attempts
    outcome, error = 'sent', ''
    if not settings.RESEND_API_KEY:
        logger.info('New-order email would send (no RESEND_API_KEY)',
                    extra={'order_id': order.pk, 'attempt': attempt, 'outcome': 'logged'})
    else:
        subject, text = _message(order)
        try:
            post_to_resend({'from': settings.ORDER_EMAIL_FROM, 'to': [recipient], 'subject': subject, 'text': text})
        except Exception as failure:  # noqa: BLE001 - any failure is recorded on the row and retried later
            outcome, error = 'failed', _error_text(failure)
        logger.info('New-order email attempt', extra={'order_id': order.pk, 'attempt': attempt, 'outcome': outcome})
    OrderEmail.objects.filter(pk=email.pk).update(
        status=outcome, last_error=error, sent_at=timezone.now() if outcome == 'sent' else None, updated_at=timezone.now())
    return outcome


def send_due_emails(now: datetime | None = None, limit: int = 10) -> int:
    """Retry rows that are pending or failed, last tried over 5 minutes ago, with attempts to spare."""
    cutoff = (now or timezone.now()) - RETRY_AFTER
    due = list(OrderEmail.objects.filter(status__in=('pending', 'failed'), attempts__lt=MAX_ATTEMPTS,
                                         updated_at__lte=cutoff).order_by('updated_at').values_list('pk', flat=True)[:limit])
    return sum(deliver(pk, due_before=cutoff) == 'sent' for pk in due)


def in_background_thread(work, *args) -> None:
    """Run email work off the request thread: log any failure, and always close this thread's connections."""
    try:
        work(*args)
    except Exception:  # noqa: BLE001 - a failed send is retried by the next sweep; never lose the log
        logger.exception('Background order email work failed')
    finally:
        connections.close_all()


def queue_delivery(email_id: int) -> None:
    """Send soon after the order commits, without making the customer wait for the email service."""
    if settings.ORDER_EMAIL_INLINE:
        deliver(email_id)
    else:
        threading.Thread(target=in_background_thread, args=(deliver, email_id), daemon=True).start()


def retry_due_emails_soon() -> None:
    """Run the retry sweep without holding up the owner's page."""
    if settings.ORDER_EMAIL_INLINE:
        send_due_emails()
    else:
        threading.Thread(target=in_background_thread, args=(send_due_emails,), daemon=True).start()
