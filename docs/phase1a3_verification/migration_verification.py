"""Fresh/upgrade/reverse/backup/invalid-fixture checks on an owned target only."""
from copy import deepcopy
from datetime import date
from decimal import Decimal
from hashlib import sha256
import json
import os
from pathlib import Path
import sqlite3
import subprocess

import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from django.db import connection, connections, IntegrityError
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder

TARGET = json.loads(Path(os.environ['ROWSZEIN_VERIFY_MARKER']).read_text())
RUNTIME = Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
OUTPUT = Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
results = {}
executor = MigrationExecutor(connection)
latest = executor.loader.graph.leaf_nodes()
historical = [(app, '0003_ingredient_category_ingredient_image_and_more') if app == 'ingredients' else
              (app, '0002_saleitem_subtotal_amount') if app == 'sales' else (app, name) for app, name in latest]


def check(condition, description):
    if not condition:
        raise AssertionError(description)
    print('PASS: ' + description, flush=True)


def migrate(targets, db=connection):
    executor = MigrationExecutor(db)
    plan = executor.migration_plan(targets)
    sequence = [{'app': migration.app_label, 'name': migration.name, 'backwards': backwards} for migration, backwards in plan]
    executor.migrate(targets)
    return sequence


def table_snapshot(apps, alias='default'):
    labels = ['accounts.User', 'products.Category', 'products.Product', 'ingredients.Ingredient', 'sales.Sale', 'sales.SaleItem']
    return {label: list(apps.get_model(label).objects.using(alias).order_by('pk').values()) for label in labels}


def canonical(value):
    if isinstance(value, Decimal):
        text = format(value, 'f')
        return (text.rstrip('0').rstrip('.') if '.' in text else text) if value else '0'
    if isinstance(value, dict):
        return {key: canonical(item) for key, item in value.items()}
    if isinstance(value, list):
        return [canonical(item) for item in value]
    return value


def docker(*args, input=None):
    return subprocess.check_output(['docker', '--context', 'desktop-linux', 'exec', *(['-i'] if input else []), TARGET['container_id'], *args], input=input)


def make_alias(kind):
    config = deepcopy(connection.settings_dict)
    if connection.vendor == 'postgresql':
        name = kind + '_' + TARGET['name']
        check(name == kind + '_rowszein_verify_' + TARGET['identity'], 'auxiliary database name is disposable')
        docker('createdb', '-U', TARGET['user'], name)
        config['NAME'] = name
    else:
        config['NAME'] = str(RUNTIME/(kind + '.sqlite3'))
    connections.databases[kind] = config
    return connections[kind]


results['fresh_forward_sequence'] = migrate(latest)
check(('sales', '0003_inventory_integrity') in MigrationRecorder(connection).applied_migrations(), 'fresh install applies approved sales migration')
check(('ingredients', '0004_inventory_integrity') in MigrationRecorder(connection).applied_migrations(), 'fresh install applies approved ingredient migration')
results['second_apply_sequence'] = migrate(latest)
check(results['second_apply_sequence'] == [], 'second migration application is a no-op')
from sales.models import Sale, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry
check(not Sale.objects.exists() and not InventoryOperation.objects.exists(), 'unused schema contains no sale/operation history')
results['unused_reverse_sequence'] = migrate(historical)
check('sales_inventoryoperation' not in connection.introspection.table_names(), 'unused reversal removes new tables')
with connection.cursor() as cursor:
    columns = [field.name for field in connection.introspection.get_table_description(cursor, 'ingredients_ingredient')]
check('stock_revision' not in columns, 'unused reversal removes added ingredient fields')

apps = MigrationExecutor(connection).loader.project_state(historical).apps
User = apps.get_model('accounts', 'User')
Category = apps.get_model('products', 'Category')
Product = apps.get_model('products', 'Product')
Ingredient = apps.get_model('ingredients', 'Ingredient')
OldSale = apps.get_model('sales', 'Sale')
Item = apps.get_model('sales', 'SaleItem')
User.objects.create(username='synthetic-legacy-only', password='!')
category = Category.objects.create(slug='upgrade-fixture', name='Upgrade fixture')
product = Product.objects.create(name='Synthetic historical product', price=Decimal('99.99'), category_id=category.pk)
Ingredient.objects.create(name='Legacy two-decimal stock', quantity=Decimal('12.34'), unit='kg', cost_per_unit=Decimal('60'))
Ingredient.objects.create(name='Legacy maximum stock', quantity=Decimal('99999999.99'), unit='g', cost_per_unit=Decimal('1'))
Ingredient.objects.create(name='Legacy zero stock', quantity=Decimal('0'), unit='pcs', cost_per_unit=Decimal('1'))
sale = OldSale.objects.create(date=date(2020, 2, 29), notes="Synthetic legacy — original owner's note", total_amount=Decimal('123.45'))
Item.objects.create(sale_id=sale.pk, product_id=product.pk, quantity=3, unit_price=Decimal('41.15'), subtotal_amount=Decimal('123.45'))
zero = OldSale.objects.create(date=date(2021, 1, 1), total_amount=Decimal('0'))
Item.objects.create(sale_id=zero.pk, product_id=product.pk, quantity=1, unit_price=Decimal('25.00'), subtotal_amount=Decimal('25.00'))
before = table_snapshot(apps)
baseline_json = json.dumps(canonical(before), sort_keys=True, default=str)
results['legacy_baseline'] = before
results['legacy_baseline_sha256'] = sha256(baseline_json.encode()).hexdigest()

restored = make_alias('restore')
if connection.vendor == 'postgresql':
    dump = docker('pg_dump', '-U', TARGET['user'], '-d', TARGET['name'], '--format=custom')
    (RUNTIME/'synthetic-legacy.dump').write_bytes(dump)
    docker('pg_restore', '-U', TARGET['user'], '-d', restored.settings_dict['NAME'], '--exit-on-error', input=dump)
else:
    with sqlite3.connect(restored.settings_dict['NAME']) as destination:
        connection.connection.backup(destination)
    dump = Path(restored.settings_dict['NAME']).read_bytes()
results['backup_sha256'] = sha256(dump).hexdigest()
results['backup_bytes'] = len(dump)
check(table_snapshot(apps, 'restore') == before, 'disposable backup restores exact historical rows in a second database')
results['backup_restore_exact'] = True
restored.close()

results['upgrade_sequence'] = migrate(latest)
after = table_snapshot(apps)
check(before == after, 'upgrade preserves every original field, ID, date, timestamp, price and quantity')
results['legacy_after_sha256'] = sha256(json.dumps(canonical(after), sort_keys=True, default=str).encode()).hexdigest()
check(results['legacy_baseline_sha256'] == results['legacy_after_sha256'], 'historical baseline hashes agree')
check(all(row.inventory_tracking == 'legacy_unknown' and row.financial_tracking == 'legacy_source' and row.status == 'recorded' and row.revision == 0 and row.current_items is None for row in Sale.objects.all()), 'legacy safeguards default without reconstruction')
check(all(row.ledger_started_at is None and row.ledger_opening_quantity is None and row.stock_revision == 0 for row in __import__('ingredients.models', fromlist=['Ingredient']).Ingredient.objects.all()), 'legacy stock anchors remain unknown')
check(all(model.objects.count() == 0 for model in [InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]), 'upgrade invents no operation, rate, consumption, movement or financial history')
results['upgrade_preserved'] = True
results['no_invented_history'] = True

with connection.cursor() as cursor:
    results['constraints'] = {table: connection.introspection.get_constraints(cursor, table) for table in ['sales_inventoryoperation', 'sales_consumptionbasis', 'sales_saleconsumption', 'sales_stockmovement', 'sales_salefinancialentry', 'sales_sale', 'ingredients_ingredient']}
    if connection.vendor == 'postgresql':
        cursor.execute("SELECT table_name,column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND ((table_name='ingredients_ingredient' AND column_name='quantity') OR (table_name='sales_saleconsumption' AND column_name='applied_quantity') OR (table_name='sales_salefinancialentry' AND column_name='amount')) ORDER BY table_name")
        types = cursor.fetchall()
        check([tuple(row[-2:]) for row in types] == [(20, 9), (20, 9), (10, 2)], 'PostgreSQL numeric stock/snapshot/money precision matches design')
        results['numeric_types'] = types
        cursor.execute("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'sales_%' ORDER BY tablename,indexname")
        results['postgres_indexes'] = cursor.fetchall()
        for name in ['invop_sale_cancel_once', 'sc_active_sale_basis_unique', 'finance_gross_once', 'finance_cancel_once']:
            check(any(row[1] == name and ' WHERE ' in row[2] and 'UNIQUE INDEX' in row[2] for row in results['postgres_indexes']), 'partial unique index exists: ' + name)

OUTPUT.write_text(json.dumps(results, indent=2, default=str), encoding='utf-8')
print('Migration/backup verification complete; only owned disposable databases used.', flush=True)
