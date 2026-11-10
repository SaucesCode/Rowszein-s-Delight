"""Static final review; does not execute a migration or contact a database."""
import ast
from hashlib import sha256
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/phase1a3_verification'
sys.path.insert(0, str(ROOT/'backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.schema_review_settings'
import decouple
from decouple import Config, RepositoryEmpty
decouple.config = Config(RepositoryEmpty())
from django.db.backends.base.base import BaseDatabaseWrapper
attempts = []


def deny(*args, **kwargs):
    attempts.append(True)
    raise AssertionError('Final static review forbids database access')


BaseDatabaseWrapper.ensure_connection = deny
BaseDatabaseWrapper.cursor = deny
import django
django.setup()
from django.apps import apps
from django.core.management import call_command
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.questioner import NonInteractiveMigrationQuestioner
from django.db.migrations.state import ProjectState
call_command('check')
loader = MigrationLoader(None)
assert not loader.detect_conflicts()
assert not MigrationAutodetector(loader.project_state(), ProjectState.from_apps(apps), NonInteractiveMigrationQuestioner()).changes(graph=loader.graph)


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).splitlines()


preserved = ['docs/audit', 'docs/phase1a', 'docs/phase1a2', 'docs/phase1a3/evidence']
assert not git('diff', '--name-only', '570e227', '--', *preserved)
assert not git('diff', '--name-only', '570e227', '--', 'backend/ingredients/migrations', 'backend/sales/migrations')
sources = sorted(set(git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'backend', 'docs/phase1a3_verification')))
python_files = [path for path in sources if path.endswith('.py')]
for path in python_files:
    ast.parse((ROOT/path).read_text(encoding='utf-8-sig'), filename=path)
old = ast.parse((ROOT/'docs/phase1a2/pending_api_contracts.py').read_text())
new = ast.parse((ROOT/'backend/sales/test_release_blockers.py').read_text())


def assertions(tree):
    return {node.name: [ast.dump(child) for child in ast.walk(node) if isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute) and child.func.attr.startswith('assert')]
        for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name.startswith('test_')}


assert len(assertions(old)) == 10 and assertions(old) == assertions(new)
migration_hashes = {str(path.relative_to(ROOT)).replace('\\', '/'): sha256(path.read_bytes()).hexdigest() for path in [
    ROOT/'backend/ingredients/migrations/0004_inventory_integrity.py', ROOT/'backend/sales/migrations/0003_inventory_integrity.py']}
environment_count = 0
for path in (OUT/'evidence').rglob('environment.json'):
    target = json.loads(path.read_text())
    assert target['production_connections'] is False and target['project_dotenv_loading'] is False
    assert target['migration_sha256'] == migration_hashes, path
    environment_count += 1
assert not attempts
summary = {'branch': git('branch', '--show-current')[0], 'implementation_checkpoint': '570e227',
    'python_sources_parsed': len(python_files), 'django_version': django.get_version(), 'sqlite_version': sqlite3.sqlite_version,
    'migration_model_drift': False, 'database_connections_in_static_review': 0,
    'prior_evidence_unchanged': preserved, 'ten_blocker_assertions_unchanged': True,
    'migration_files_unchanged_since_first_execution': True, 'migration_sha256': migration_hashes,
    'verified_environment_records': environment_count,
    'changed_tracked_files': git('diff', '--name-only', '570e227'),
    'new_files': git('ls-files', '--others', '--exclude-standard')}
(OUT/'final-source-review.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in summary.items() if key not in ['new_files', 'changed_tracked_files']}, indent=2))
