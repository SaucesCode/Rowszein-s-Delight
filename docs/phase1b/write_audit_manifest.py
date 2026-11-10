"""Read-only source/evidence preservation and selected audit results."""
import ast
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).splitlines()


assert not git('diff', '--name-only', 'dcf2500', '--', 'backend', 'frontend', '.gitignore')
preserved = ['docs/audit', 'docs/phase1a', 'docs/phase1a2', 'docs/phase1a3', 'docs/phase1a3_verification']
assert not git('diff', '--name-only', 'dcf2500', '--', *preserved)
for path in HERE.glob('*.py'):
    ast.parse(path.read_text(), filename=str(path))
summary = {'branch': git('branch', '--show-current')[0], 'application_baseline': 'dcf2500',
           'application_files_changed': [], 'prior_evidence_changed': [], 'new_migrations': [], 'backends': {}}
for backend in ['postgres', 'sqlite']:
    runs = [path for path in sorted((HERE/'evidence').iterdir()) if backend in path.name and (path/'summary.json').exists()]
    path = runs[-1]
    groups = {}
    for name in ['current-behavior-controls', 'desired-security-red', 'proposed-roles-red', 'phase1a-regressions']:
        data = json.loads((path/(name+'.json')).read_text())
        statuses = Counter(row['status'] for row in data['outcomes'])
        groups[name] = {'tests': data['tests_run'], 'pass': statuses['pass'], 'fail': data['failures'], 'error': data['errors'], 'skip': data['skipped'],
                        'evidence': str((path/(name+'.json')).relative_to(ROOT)).replace('\\', '/')}
    environment = json.loads((path/'environment.json').read_text())
    assert environment['schema_changes'] is False and environment['authentication_permissions_replaced'] is False
    assert json.loads((path/'cleanup.json').read_text())['runtime_removed']
    summary['backends'][backend] = groups
    summary.setdefault('environments', {})[backend] = str((path/'environment.json').relative_to(ROOT)).replace('\\', '/')
summary['source_sha256'] = {str(path.relative_to(ROOT)).replace('\\', '/'): sha256(path.read_bytes()).hexdigest() for path in [
    ROOT/'backend/accounts/authentication.py', ROOT/'backend/accounts/views.py', ROOT/'backend/backend/settings.py',
    ROOT/'frontend/src/services/api.ts', ROOT/'frontend/src/hooks/useAuth.ts']}
assert not any((ROOT/'.verification-runtime').iterdir())
summary['all_owned_runtime_targets_removed'] = True
(HERE/'audit-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary['backends'], indent=2))
