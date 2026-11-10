"""Primary-database quotas. No cache fallback and no unlocked hash admission."""
from contextlib import contextmanager
import time
import logging
from django.conf import settings
from django.db import connection, transaction
from rest_framework.exceptions import Throttled
from .models import AuthThrottleBucket
from .session_database import database_time, set_transaction_bounds
from .session_errors import AuthUnavailable
from .session_policy import SCOPES, EVENT_CEILING, client_ip, normalized_account, subject_digest, prune_events, retry_seconds, micros
logger = logging.getLogger('accounts.security')


def identity(request):
    try:
        return client_ip(request.META, settings.AUTH_PROXY_MODE, settings.AUTH_TRUSTED_PROXY_CIDRS)
    except ValueError:
        raise AuthUnavailable() from None


def keys(scope, value):
    ring = settings.AUTH_RATE_KEYS
    if not isinstance(ring, dict) or not ring or len(ring) > 2:
        raise AuthUnavailable()
    result = []
    for version, key in ring.items():
        if (not str(version).isdecimal() or str(int(version)) != str(version)
                or not 1 <= int(version) <= 32767 or not isinstance(key,str) or len(key) < 32):
            raise AuthUnavailable()
        result.append((scope,int(version),subject_digest(key,scope,value)))
    return sorted(result)


def limit(scope):
    if not isinstance(settings.AUTH_RATE_LIMITS,dict):
        raise AuthUnavailable()
    value = settings.AUTH_RATE_LIMITS.get(scope)
    if type(value) is not int or not 1 <= value <= EVENT_CEILING:
        raise AuthUnavailable()
    return value


def allocate(wanted):
    """Separate short allocation transaction, before any counter/user lock.

    Global bound prevents distributed random identifiers from growing rows
    without limit. Existing buckets continue while new allocation is refused.
    """
    if connection.in_atomic_block:
        raise AuthUnavailable()
    if type(settings.AUTH_MAX_BUCKET_ROWS) is not int or not 1 <= settings.AUTH_MAX_BUCKET_ROWS <= 50000:
        raise AuthUnavailable()
    with transaction.atomic():
        set_transaction_bounds()
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(182731, 31)')
        missing = [key for key in wanted if not AuthThrottleBucket.objects.filter(scope=key[0],key_version=key[1],subject_digest=key[2]).exists()]
        if missing and AuthThrottleBucket.objects.count() + len(missing) > settings.AUTH_MAX_BUCKET_ROWS:
            raise AuthUnavailable()
        now = database_time()
        for scope, version, digest in missing:
            AuthThrottleBucket.objects.get_or_create(scope=scope,key_version=version,subject_digest=digest,
                defaults={'event_times':[],'updated_at':now})


def locked(wanted):
    rows = []
    # LI before LA, versions/digests ordered within each scope.
    for scope, version, digest in sorted(wanted,key=lambda key:({'LI':0,'LA':1}.get(key[0],0),key[1],key[2])):
        row = AuthThrottleBucket.objects.select_for_update().filter(scope=scope,key_version=version,subject_digest=digest).first()
        if row is None:
            raise AuthUnavailable()
        rows.append(row)
    return rows


def check(rows, now):
    wait = 0
    for row in rows:
        try:
            row.event_times = prune_events(row.event_times,row.updated_at,now,SCOPES[row.scope][1])
        except ValueError:
            raise AuthUnavailable() from None
        wait = max(wait,retry_seconds(row.event_times,limit(row.scope),now,SCOPES[row.scope][1]))
    if wait:
        logger.warning('Authentication quota denied',extra={'retry_seconds':wait})
        raise Throttled(wait=wait)


def append(rows, now):
    check(rows, now)
    for row in rows:
        row.event_times.append(micros(now))
        row.updated_at = now
        row.save(update_fields=['event_times','updated_at'])


def debit(request, scope):
    wanted = keys(scope,identity(request))
    allocate(wanted)
    with transaction.atomic():
        set_transaction_bounds()
        rows = locked(wanted)
        append(rows,database_time())


@contextmanager
def credential_gate(request, username):
    started = time.monotonic()
    ip_keys = keys('LI',identity(request))
    account_keys = keys('LA',normalized_account(username))
    # Check a full IP first, before allocating a new account identifier.
    allocate(ip_keys)
    with transaction.atomic():
        set_transaction_bounds()
        check(locked(ip_keys),database_time())
    allocate(account_keys)
    with transaction.atomic():
        set_transaction_bounds()
        rows = locked(ip_keys + account_keys)
        check(rows,database_time())
        outcome = {'failed':False}
        yield outcome
        if time.monotonic()-started > 10:
            raise AuthUnavailable()
        if outcome['failed']:
            append(rows,database_time())
        # Successful/blocked attempts never reset or extend failure history.
