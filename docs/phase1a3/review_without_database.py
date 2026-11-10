"""Generate/inspect migrations, system-check and pure-test WITHOUT a database.

Never calls migrate, a Django test runner, a schema editor or SQL execution.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.schema_review_settings'
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'

from django.db.backends.base.base import BaseDatabaseWrapper

attempts = []


def deny_database(self, *args, **kwargs):
    attempts.append('database connection attempted')
    raise AssertionError('Database access is forbidden at this checkpoint')


BaseDatabaseWrapper.ensure_connection = deny_database
BaseDatabaseWrapper.cursor = deny_database
import django
django.setup()
from django.apps import apps
from django.core.management import call_command
from django.db.models import NOT_PROVIDED
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.state import ProjectState
from django.db.migrations.questioner import NonInteractiveMigrationQuestioner

evidence = root / 'docs/phase1a3/evidence'
evidence.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--generate', action='store_true')
args = parser.parse_args()
call_command('check')
if args.generate:
    call_command('makemigrations', 'ingredients', 'sales', name='inventory_integrity', interactive=False)
loader = MigrationLoader(None, ignore_no_migrations=True)
assert not loader.detect_conflicts()
changes = MigrationAutodetector(loader.project_state(), ProjectState.from_apps(apps), NonInteractiveMigrationQuestioner()).changes(graph=loader.graph)
assert not changes, 'Model/migration state differs'
new_files = [root/'backend/ingredients/migrations/0004_inventory_integrity.py', root/'backend/sales/migrations/0003_inventory_integrity.py']
allowed = {'AddField', 'AlterField', 'CreateModel', 'AddConstraint', 'AddIndex'}
operations = {}
for path in new_files:
    key = (path.parts[-3], path.stem)
    migration = loader.disk_migrations[key]
    names = [type(op).__name__ for op in migration.operations]
    assert set(names) <= allowed, (path.name, names)
    operations[str(path.relative_to(root)).replace('\\', '/')] = [repr(op) for op in migration.operations]
(evidence/'migration-operations.json').write_text(json.dumps(operations, indent=2, default=str), encoding='utf-8')
manifest = {}
for label in ['sales.Sale', 'ingredients.Ingredient', 'sales.InventoryOperation', 'sales.ConsumptionBasis', 'sales.SaleConsumption', 'sales.StockMovement', 'sales.SaleFinancialEntry']:
    model = apps.get_model(label)
    manifest[label] = {
        'fields': [{
            'name': field.name, 'type': field.get_internal_type(), 'null': field.null,
            'default': (field.default.__module__ + '.' + field.default.__qualname__) if callable(field.default) else repr(field.default), 'max_length': field.max_length,
            'choices': list(field.choices or []),
            'max_digits': getattr(field, 'max_digits', None), 'decimal_places': getattr(field, 'decimal_places', None),
            'primary_key': field.primary_key, 'unique': field.unique, 'db_index': field.db_index,
            'auto_now': getattr(field, 'auto_now', False), 'auto_now_add': getattr(field, 'auto_now_add', False),
            'persistent_db_default': field.db_default is not NOT_PROVIDED,
            'relation': field.related_model._meta.label if field.is_relation else None,
            'on_delete': field.remote_field.on_delete.__name__ if field.is_relation else None,
        } for field in model._meta.fields],
        'constraints': [repr(c) for c in model._meta.constraints], 'indexes': [repr(i) for i in model._meta.indexes],
    }
(evidence/'implemented-models.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
# unittest, NOT Django DiscoverRunner: no database setup or migrations.
suite = unittest.defaultTestLoader.loadTestsFromNames(['sales.test_inventory_math', 'sales.test_approved_math', 'sales.test_schema_contracts'])
result = unittest.TextTestRunner(verbosity=2).run(suite)
assert not attempts, attempts
summary = {'django_version': django.get_version(), 'database_engine': 'dummy', 'connection_attempts': attempts,
           'migrations_executed': 0, 'model_migration_drift': False, 'tests': result.testsRun,
           'failures': len(result.failures), 'errors': len(result.errors),
           'integrated_api_blockers': 10, 'integrated_api_tests_executed': False}
(evidence/'review-results.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary, indent=2))
sys.exit(0 if result.wasSuccessful() else 1)
