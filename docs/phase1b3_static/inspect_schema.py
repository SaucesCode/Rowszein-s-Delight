"""Render model/migration metadata and SQL strings without a database backend."""
import hashlib
from importlib import import_module
import json
import os
from pathlib import Path
import sys
from django.db.backends.base.base import BaseDatabaseWrapper

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
os.environ['DJANGO_SETTINGS_MODULE']='backend.session_static_settings'
attempts=[]
def forbidden(self,*args,**kwargs):
    attempts.append(True)
    raise AssertionError('No database cursor or connection is authorized.')
BaseDatabaseWrapper.connect=forbidden
BaseDatabaseWrapper.cursor=forbidden
import django
django.setup()
from django.db.migrations.loader import MigrationLoader
from django.db.models.fields import NOT_PROVIDED
from accounts.models import User,DeviceSession,AuthThrottleBucket


def value(item):
    if item is NOT_PROVIDED: return None
    if callable(item): return item.__module__+'.'+item.__qualname__
    return str(item)


models=[]
for model in (User,DeviceSession,AuthThrottleBucket):
    fields=model._meta.fields if model!=User else [model._meta.get_field('session_epoch')]
    models.append({'model':model.__name__,'table':model._meta.db_table,'fields':[
        {'name':field.name,'column':field.column,'type':field.get_internal_type(),'null':field.null,'primary_key':field.primary_key,
         'max_length':field.max_length,'editable':field.editable,'default':value(field.default),'db_default':value(field.db_default),
         'relation':field.remote_field.model._meta.label if field.is_relation else None,
         'on_delete':value(field.remote_field.on_delete) if field.is_relation else None,'choices':field.choices}
        for field in fields], 'constraints':[repr(c) for c in model._meta.constraints],'indexes':[repr(i) for i in model._meta.indexes]})

loader=MigrationLoader(None)
names=['0002_auththrottlebucket_devicesession_user_session_epoch_and_more','0003_session_security_guards']
migrations=[]
for name in names:
    migration=loader.disk_migrations[('accounts',name)]
    path=ROOT/'backend/accounts/migrations'/(name+'.py')
    migrations.append({'file':str(path.relative_to(ROOT)).replace('\\','/'),'dependencies':migration.dependencies,
        'sha256_utf8_lf':hashlib.sha256(path.read_text(encoding='utf-8-sig').encode('utf-8')).hexdigest(),'atomic':migration.atomic,
        'operations':[{'number':index,'type':type(op).__name__,'description':op.describe()} for index,op in enumerate(migration.operations,1)]})
mod=import_module('accounts.migrations.0003_session_security_guards')
folder=Path(__file__).parent/'evidence'
folder.mkdir(exist_ok=True)
pg='-- REVIEW ONLY. NOT EXECUTED. Requires the separately approved schema/migration checkpoint.\n'
pg+='\n'.join(sql.replace('LANGUAGE plpgsql AS','LANGUAGE plpgsql SET search_path = public, pg_temp AS') for sql in mod.PG_FUNCTIONS.values())
pg+='\n'+'\n'.join(f'CREATE TRIGGER {name} {event} ON public.{table} FOR EACH {level} EXECUTE FUNCTION public.{function}();' for name,table,event,function,level in mod.PG_TRIGGERS)+'\n'
(folder/'postgresql-guards.sql').write_text(pg,encoding='utf-8')
(folder/'sqlite-guards.sql').write_text('-- REVIEW ONLY. NOT EXECUTED. SQLite also requires the connection authorizer.\n'+';\n'.join(sql.strip() for sql in mod.SQLITE_TRIGGERS.values())+';\n',encoding='utf-8')
manifest={'schema_executed':False,'database_access_attempts':len(attempts),'models':models,'migrations':migrations,
    'postgresql_triggers':mod.PG_TRIGGERS,'sqlite_triggers':list(mod.SQLITE_TRIGGERS),'sql_server_validated':False}
(folder/'schema-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'new_migrations':len(migrations),'model_changes':len(models),'database_access_attempts':len(attempts),'schema_executed':False}))
