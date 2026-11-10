"""SQLite development connections: deny direct epoch SQL, allow named trigger.

Raw external SQLite clients lack rs_guarded_connection(), so user writes fail
closed. Access to the database file/Python connection remains a trusted boundary.
"""
import sqlite3
from django.db.backends.signals import connection_created


def install_guard(sender, connection, **kwargs):
    if connection.vendor != 'sqlite':
        return
    def authorize(action, table, column, database, source):
        if action == sqlite3.SQLITE_UPDATE and table == 'accounts_user' and column == 'session_epoch':
            return sqlite3.SQLITE_OK if source == 'accounts_security_epoch_bump' else sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    connection.connection.set_authorizer(authorize)
    connection.connection.create_function('rs_guarded_connection', 0, lambda: 1, deterministic=True)


def register():
    connection_created.connect(install_guard, dispatch_uid='accounts.sqlite_security_guard', weak=False)
