"""Expected migration rejection on its own owned DEFAULT database, no repair."""
from decimal import Decimal
import json
import os
from pathlib import Path
import django
django.setup()
from django.db import connection, IntegrityError
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder

executor = MigrationExecutor(connection)
latest = executor.loader.graph.leaf_nodes()
historical = [(app, '0003_ingredient_category_ingredient_image_and_more') if app == 'ingredients' else
              (app, '0002_saleitem_subtotal_amount') if app == 'sales' else (app, name) for app, name in latest]
executor.migrate(historical)
apps = MigrationExecutor(connection).loader.project_state(historical).apps
Ingredient = apps.get_model('ingredients', 'Ingredient')
bad = Ingredient.objects.create(name='Invalid synthetic legacy stock', quantity=Decimal('-1'), unit='kg', cost_per_unit=Decimal('1'))
result = {'expected_rejection': False, 'silent_repair': False, 'fixture': 'separate owned default database'}
try:
    MigrationExecutor(connection).migrate(latest)
except IntegrityError as error:
    result.update(expected_rejection=True, exception_type=type(error).__name__, message=str(error))
else:
    raise AssertionError('Invalid historical stock was unexpectedly accepted')
assert Ingredient.objects.get(pk=bad.pk).quantity == Decimal('-1'), 'Invalid stock must not be changed'
assert ('ingredients', '0004_inventory_integrity') not in MigrationRecorder(connection).applied_migrations()
result.update(quantity_unchanged='-1.00', migration_recorded=False, fixture_stopped=True)
Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2), flush=True)
