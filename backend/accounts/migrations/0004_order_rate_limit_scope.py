"""Admit the 'OS' scope (online order submits) to the rate-limit table.

SQLite can only change a CHECK constraint by rebuilding the table, and the rebuild drops the table's
triggers. The two throttle triggers from 0003 are put back afterwards. PostgreSQL alters the constraint
in place and keeps its triggers, so it needs nothing extra.
"""
import importlib

from django.db import migrations, models

guards = importlib.import_module('accounts.migrations.0003_session_security_guards')
THROTTLE_TRIGGERS = ('accounts_throttle_insert', 'accounts_throttle_update')


def restore_sqlite_throttle_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != 'sqlite':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        present = {row[0] for row in cursor.fetchall()}
    for name in THROTTLE_TRIGGERS:
        if name not in present:
            schema_editor.execute(guards.SQLITE_TRIGGERS[name], params=None)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_session_security_guards'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='auththrottlebucket',
            name='at_scope_valid',
        ),
        migrations.AlterField(
            model_name='auththrottlebucket',
            name='scope',
            field=models.CharField(choices=[('LA', 'LA'), ('LI', 'LI'), ('LR', 'LR'), ('RR', 'RR'), ('OS', 'OS')], max_length=2),
        ),
        migrations.AddConstraint(
            model_name='auththrottlebucket',
            constraint=models.CheckConstraint(condition=models.Q(('scope__in', ['LA', 'LI', 'LR', 'RR', 'OS'])), name='at_scope_valid'),
        ),
        migrations.RunPython(restore_sqlite_throttle_triggers, migrations.RunPython.noop),
    ]
