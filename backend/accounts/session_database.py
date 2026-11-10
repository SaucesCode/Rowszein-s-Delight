"""Authoritative clock and explicit user-lock ordering; never creates schema."""
from datetime import datetime, timezone
from django.db import connection
from .session_errors import AuthUnavailable


def database_time():
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute('SELECT clock_timestamp()')
            return cursor.fetchone()[0]
        if connection.vendor == 'sqlite':
            cursor.execute("SELECT strftime('%Y-%m-%d %H:%M:%f', 'now') || '000'")
            return datetime.fromisoformat(cursor.fetchone()[0]).replace(tzinfo=timezone.utc)
    raise AuthUnavailable()


def lock_users(ids, *, exclusive=False):
    from .models import User
    if not connection.in_atomic_block:
        raise AuthUnavailable()
    ids = sorted(set(ids))
    result = {}
    for pk in ids:
        if connection.vendor == 'postgresql':
            table = connection.ops.quote_name(User._meta.db_table)
            mode = 'UPDATE' if exclusive else 'SHARE'
            rows = list(User.objects.raw(f'SELECT * FROM {table} WHERE id = %s FOR {mode}', [pk]))
            if rows: result[pk] = rows[0]
        else:
            user = User.objects.filter(pk=pk).first()
            if user: result[pk] = user
    return result


def set_transaction_bounds():
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '2s'")
            cursor.execute("SET LOCAL statement_timeout = '3s'")
            cursor.execute("SET LOCAL idle_in_transaction_session_timeout = '10s'")
    assert_database_guards()


def assert_database_guards():
    """A partially applied/disabled guard migration must never enable login.

    No positive cache: operator removal/disablement is noticed next request.
    A database owner able to replace function bodies is a trusted boundary.
    """
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            expected=[('accounts_security_epoch_direct','accounts_user'),('accounts_security_epoch_guard','accounts_user'),
                ('accounts_security_epoch_revoke','accounts_user'),('accounts_device_guard','accounts_devicesession'),
                ('accounts_throttle_guard','accounts_auththrottlebucket')]
            cursor.execute("SELECT t.tgname,c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "
                "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal "
                "AND t.tgenabled IN ('O','A') AND t.tgname IN (%s,%s,%s,%s,%s)",[name for name,_ in expected])
            if set(cursor.fetchall()) != set(expected): raise AuthUnavailable()
        elif connection.vendor == 'sqlite':
            expected={'accounts_security_epoch_insert','accounts_security_epoch_guard','accounts_security_epoch_bump',
                'accounts_device_insert','accounts_device_update','accounts_throttle_insert','accounts_throttle_update'}
            cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
            if not expected.issubset({row[0] for row in cursor.fetchall()}): raise AuthUnavailable()
            cursor.execute('SELECT rs_guarded_connection()')
            if cursor.fetchone()[0] != 1: raise AuthUnavailable()
        else:
            raise AuthUnavailable()
