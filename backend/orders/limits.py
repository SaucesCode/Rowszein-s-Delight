"""How many orders one connection may send: scope 'OS' on the shared database-backed limiter.

Only orders that are actually saved count, so a customer correcting form mistakes is never locked out.
"""
from django.db import transaction
from rest_framework.exceptions import Throttled

from accounts import login_limiter
from accounts.session_database import database_time, set_transaction_bounds

SCOPE = 'OS'
TOO_MANY = 'Too many orders from this connection. Try again in a few minutes.'


def _buckets(request):
    wanted = login_limiter.keys(SCOPE, login_limiter.identity(request))
    login_limiter.allocate(wanted)
    return wanted


def admit_order(request) -> None:
    """Raise Throttled (with the customer-facing message) when this connection has sent too many orders."""
    wanted = _buckets(request)
    with transaction.atomic():
        set_transaction_bounds()
        try:
            login_limiter.check(login_limiter.locked(wanted), database_time())
        except Throttled as refused:
            raise Throttled(wait=refused.wait, detail=TOO_MANY) from None


def record_order(request) -> None:
    wanted = _buckets(request)
    with transaction.atomic():
        set_transaction_bounds()
        login_limiter.append(login_limiter.locked(wanted), database_time())
