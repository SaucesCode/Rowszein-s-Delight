"""How many orders one connection may send: scope 'OS' on the shared database-backed limiter.

Only saved orders count, so a customer correcting form mistakes is never locked out. The check and the
record happen inside the same transaction as the save, so parallel requests from one address queue on
the bucket row instead of all slipping past the check.
"""
from rest_framework.exceptions import Throttled

from accounts import login_limiter
from accounts.session_database import database_time, set_transaction_bounds

SCOPE = 'OS'
TOO_MANY = 'Too many orders from this connection. Try again in a few minutes.'


class OrderGate:
    """Created outside any transaction (allocation needs its own); used inside the order's transaction."""

    def __init__(self, request):
        self.wanted = login_limiter.keys(SCOPE, login_limiter.identity(request))
        login_limiter.allocate(self.wanted)
        self.rows = None

    def admit(self) -> None:
        """Lock this address's bucket and raise Throttled (customer message) when it is full."""
        set_transaction_bounds()
        self.rows = login_limiter.locked(self.wanted)
        try:
            login_limiter.check(self.rows, database_time())
        except Throttled as refused:
            raise Throttled(wait=refused.wait, detail=TOO_MANY) from None

    def record(self) -> None:
        """Count one saved order. Call after admit(), in the same transaction."""
        login_limiter.append(self.rows, database_time())
