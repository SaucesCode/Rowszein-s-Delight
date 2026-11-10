"""Run only database-free unittest suites; NEVER use Django's database runner."""
import ast
import io
import json
import os
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'backend'),str(Path(__file__).parent),str(ROOT/'docs/phase1b'),str(ROOT/'docs/phase1b1')]
os.environ['DJANGO_SETTINGS_MODULE']='backend.session_static_settings'
from django.db.backends.base.base import BaseDatabaseWrapper

attempts=[]
def forbidden(self,*args,**kwargs):
    attempts.append('database access forbidden')
    raise AssertionError('Static checkpoint must never open/cursor a database.')

BaseDatabaseWrapper.connect=forbidden
BaseDatabaseWrapper.cursor=forbidden
import django
django.setup()
from django.conf import settings
assert settings.DATABASES['default']['ENGINE']=='django.db.backends.dummy'

parsed=0
for path in (ROOT/'backend').rglob('*.py'):
    if '.venv' not in path.parts:
        ast.parse(path.read_text(encoding='utf-8-sig'),filename=str(path))
        parsed+=1
for path in Path(__file__).parent.glob('*.py'):
    ast.parse(path.read_text(encoding='utf-8-sig'),filename=str(path))
    parsed+=1

labels=['pure_contracts.PolicyContracts','pure_contracts.CodecContracts','pure_contracts.SchemaContracts',
    'sales.test_approved_math','sales.test_inventory_math','sales.test_schema_contracts','sales.test_storage_precision',
    'csrf_regressions.SecurityTransportUnitTests']
suite=unittest.TestLoader().loadTestsFromNames(labels)
stream=io.StringIO()
result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
print(stream.getvalue())
output=Path(__file__).parent/'evidence'
output.mkdir(exist_ok=True)
(output/'static-tests.txt').write_text(stream.getvalue(),encoding='utf-8')
summary={'schema_executed':False,'database_access_attempts':len(attempts),'python_files_parsed':parsed,
    'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skips':len(result.skipped),
    'labels':labels,'integration_tests_run':False,'release_blockers':'OPEN'}
(output/'static-tests.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary))
sys.exit(0 if result.wasSuccessful() and not attempts else 1)
