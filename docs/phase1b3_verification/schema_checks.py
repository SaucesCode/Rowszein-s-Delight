"""Fresh/1B.2-upgrade/no-op/reverse/backup checks on the verified target only."""
from copy import deepcopy
from datetime import date
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4
import django
django.setup()
from django.core.management import call_command
from django.db import connection, connections, transaction, DatabaseError
from django.db.migrations.executor import MigrationExecutor
from accounts.session_database import assert_database_guards, database_time

OUTPUT=Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
RUNTIME=Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
TARGET=json.loads((RUNTIME/'target.json').read_text())
result={'checks':{},'negative_errors':[],'plans':[],'sql':[]}
def check(name,condition):
    result['checks'][name]=bool(condition)
    if not condition: raise AssertionError(name)
    print('PASS '+name,flush=True)

def migrate(targets):
    executor=MigrationExecutor(connection)
    plan=executor.migration_plan(targets)
    result['plans'].append([(m.app_label,m.name,backwards) for m,backwards in plan])
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps

def snapshot(apps,alias='default'):
    labels=['accounts.User','auth.Group','auth.Permission','contenttypes.ContentType','products.Category','products.Product',
        'ingredients.Ingredient','recipes.Recipe','recipes.RecipeIngredient','sales.Sale','sales.SaleItem','sales.InventoryOperation',
        'sales.ConsumptionBasis','sales.SaleConsumption','sales.StockMovement','sales.SaleFinancialEntry']
    data={label:list(apps.get_model(label).objects.using(alias).order_by('pk').values()) for label in labels}
    for row in data['accounts.User']: row.pop('session_epoch',None)
    user=apps.get_model('accounts','User')
    for name in ['groups','user_permissions']:
        model=user._meta.get_field(name).remote_field.through
        data[name]=list(model.objects.using(alias).order_by('pk').values())
    model=apps.get_model('auth','Group')._meta.get_field('permissions').remote_field.through
    data['group_permissions']=list(model.objects.using(alias).order_by('pk').values())
    return json.dumps(data,default=str,sort_keys=True)

def reject(name,action):
    try:
        with transaction.atomic(): action()
    except DatabaseError as error:
        result['negative_errors'].append({'case':name,'class':type(error).__name__,'sql_error':str(error)})
        check(name,True)
    else: check(name,False)

def record(execute,sql,params,many,context):
    if sql.lstrip().upper().startswith(('CREATE ','ALTER ','DROP ')): result['sql'].append(sql)
    return execute(sql,params,many,context)

try:
    executor=MigrationExecutor(connection)
    latest=executor.loader.graph.leaf_nodes()
    baseline=[(app,'0001_initial') if app=='accounts' else (app,name) for app,name in latest]
    with connection.execute_wrapper(record): old=migrate(baseline)
    get=lambda app,name: old.get_model(app,name)
    user=get('accounts','User').objects.create(username='upgrade-owner',password='!',role='admin',is_staff=True)
    group=get('auth','Group').objects.create(name='Synthetic preserved group')
    ct=get('contenttypes','ContentType').objects.create(app_label='synthetic',model='upgrade')
    permission=get('auth','Permission').objects.create(content_type=ct,codename='preserved',name='Synthetic preserved permission')
    user.groups.add(group);user.user_permissions.add(permission);group.permissions.add(permission)
    cat=get('products','Category').objects.create(name='Upgrade category',slug='upgrade')
    product=get('products','Product').objects.create(name='Upgrade product',price='11',category_id=cat.pk)
    now=database_time()
    ingredient=get('ingredients','Ingredient').objects.create(name='Upgrade flour',unit='kg',quantity='9',cost_per_unit='2',
        ledger_opening_quantity='10',ledger_started_at=now,stock_revision=1)
    recipe=get('recipes','Recipe').objects.create(product_id=product.pk,yield_quantity=1)
    get('recipes','RecipeIngredient').objects.create(recipe_id=recipe.pk,ingredient_id=ingredient.pk,quantity='1')
    sale=get('sales','Sale').objects.create(date=date(2020,2,29),total_amount='11',inventory_tracking='tracked',financial_tracking='ledger',revision=1)
    get('sales','SaleItem').objects.create(sale_id=sale.pk,product_id=product.pk,quantity=1,unit_price='11',subtotal_amount='11')
    operation=get('sales','InventoryOperation').objects.create(actor_id=user.pk,client_key=uuid4(),action='sale_create',sale_id=sale.pk,
        request_fingerprint='a'*64,response_status=201,response_body={'preserved':True})
    basis=get('sales','ConsumptionBasis').objects.create(product_id=product.pk,ingredient_id=ingredient.pk,unit='kg',batch_quantity='1',yield_quantity=1,allocated_units=1,active_units=1)
    get('sales','SaleConsumption').objects.create(sale_id=sale.pk,sale_revision=1,basis_id=basis.pk,operation_id=operation.pk,allocation_start=0,units=1,applied_quantity='1')
    get('sales','StockMovement').objects.create(operation_id=operation.pk,ingredient_id=ingredient.pk,stock_revision=1,unit='kg',quantity_delta='-1',balance_after='9')
    get('sales','SaleFinancialEntry').objects.create(sale_id=sale.pk,operation_id=operation.pk,sale_revision=1,kind='gross_sale',effective_date=date(2020,2,29),amount='11')
    before=snapshot(old)
    with connection.execute_wrapper(record): current=migrate(latest)
    check('upgrade_preserves_users_permissions_ids_and_complete_business_ledger',snapshot(current)==before)
    check('guards_installed',assert_database_guards() is None)
    check('reapply_is_noop',not MigrationExecutor(connection).migration_plan(latest))
    for model in ['DeviceSession','AuthThrottleBucket']:
        check('no_fabricated_'+model,not current.get_model('accounts',model).objects.exists())
    result['business_sha256']=hashlib.sha256(before.encode()).hexdigest()
    from accounts.models import User,DeviceSession,AuthThrottleBucket
    from session_api_contracts import bind_fixture
    actor=User.objects.get(pk=user.pk)
    check('initialized_epoch_is_one',actor.session_epoch==1)
    row,tokens=bind_fixture(actor)
    for field,value in [('role','staff'),('is_active',False),('is_active',True),('is_staff',False),('is_superuser',True),('password','!new')]:
        previous=User.objects.get(pk=actor.pk).session_epoch
        User.objects.filter(pk=actor.pk).update(**{field:value})
        check('exact_epoch_increment_'+field+'_'+str(value),User.objects.get(pk=actor.pk).session_epoch==previous+1)
    row.refresh_from_db();check('account_change_revokes_device',row.revoked_at is not None)
    reject('epoch_direct_noop',lambda:User.objects.filter(pk=actor.pk).update(session_epoch=User.objects.get(pk=actor.pk).session_epoch))
    reject('epoch_decrease',lambda:User.objects.filter(pk=actor.pk).update(session_epoch=1))
    reject('terminal_session_resurrection',lambda:DeviceSession.objects.filter(pk=row.pk).update(revoked_at=None,revocation_reason=''))
    for payload in [dict(scope='XX',key_version=1,subject_digest='b'*64,event_times=[]),
            dict(scope='LA',key_version=0,subject_digest='b'*64,event_times=[]),
            dict(scope='LA',key_version=1,subject_digest='bad',event_times=[]),
            dict(scope='LA',key_version=1,subject_digest='b'*64,event_times=[True]),
            dict(scope='LA',key_version=1,subject_digest='b'*64,event_times=[2,1])]:
        reject('malformed_bucket_'+str(len(result['negative_errors'])),lambda payload=payload:AuthThrottleBucket.objects.create(updated_at=database_time(),**payload))
    # Inspect all actual constraints/indexes; trigger names/definitions retained.
    with connection.cursor() as cursor:
        result['constraints']={name:connection.introspection.get_constraints(cursor,name) for name in ['accounts_user','accounts_devicesession','accounts_auththrottlebucket']}
        if connection.vendor=='postgresql':
            cursor.execute("SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'accounts_%' ORDER BY tgname")
            result['triggers']=cursor.fetchall()
            cursor.execute("SELECT proname,pg_get_functiondef(oid) FROM pg_proc WHERE proname LIKE 'accounts_%' ORDER BY proname")
            result['functions']=cursor.fetchall()
        else:
            cursor.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name")
            result['triggers']=cursor.fetchall()
    check('expected_trigger_count',len(result['triggers'])==(5 if connection.vendor=='postgresql' else 7))
    import io
    actor.refresh_from_db()
    start=database_time()-__import__('datetime').timedelta(days=31,hours=8)
    expired=DeviceSession.objects.create(user=actor,user_epoch=actor.session_epoch,created_at=start,last_activity_at=start,
        absolute_expires_at=start+__import__('datetime').timedelta(hours=8),refresh_jti_hash='b'*64)
    preserved=snapshot(current)
    call_command('cleanup_auth_security',execute=True,batch_size=200,stdout=io.StringIO())
    check('cleanup_does_not_cascade_user_or_business',snapshot(current)==preserved and not DeviceSession.objects.filter(pk=expired.pk).exists())
    # Synthetic backup restored into a new independently named copy, never live data.
    config=deepcopy(connection.settings_dict)
    if connection.vendor=='sqlite':
        import sqlite3
        restored=RUNTIME/'restore.sqlite3'
        with sqlite3.connect(restored) as dest: connection.connection.backup(dest)
        config['NAME']=str(restored)
    else:
        import psycopg2.sql
        name=TARGET['name']+'_restore'
        with connection.cursor() as cursor: cursor.execute(psycopg2.sql.SQL('CREATE DATABASE {} OWNER {}').format(psycopg2.sql.Identifier(name),psycopg2.sql.Identifier(TARGET['user'])))
        docker=['docker','--context','desktop-linux','exec','-i',TARGET['container_id']]
        backup=subprocess.check_output([*docker,'pg_dump','-U',TARGET['user'],'-d',TARGET['name'],'--no-owner'])
        subprocess.run([*docker,'psql','-v','ON_ERROR_STOP=1','-U',TARGET['user'],'-d',name],input=backup,check=True,capture_output=True)
        config['NAME']=name
    connections.databases['restore']=config
    restored=connections['restore']
    with restored.cursor() as cursor:
        if connection.vendor=='postgresql':
            cursor.execute('SELECT current_database(),current_user,pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()')
            check('restore_database_identity',cursor.fetchone()==(config['NAME'],TARGET['user'],TARGET['user']))
    check('backup_restore_exact_logical_preservation',snapshot(current,'restore')==snapshot(current))
    restored.close()
    # Reverse only on the unused synthetic copy that is about to be destroyed.
    before_reverse=snapshot(current)
    with connection.execute_wrapper(record): migrate(baseline)
    check('offline_reverse_retains_business_rows',snapshot(old)==before_reverse)
    with connection.execute_wrapper(record): migrate(latest)
    check('reverse_reapply_guards',assert_database_guards() is None)
    check('reverse_reapply_preserves_business',snapshot(current)==snapshot(old))
except Exception as error:
    result['failure']={'type':type(error).__name__,'message':str(error)}
    raise
finally:
    OUTPUT.write_text(json.dumps(result,default=str,indent=2),encoding='utf-8')
