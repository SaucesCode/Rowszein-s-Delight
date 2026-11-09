"""Read-only provenance checks. Does not initialize Django or any database."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
BASELINE = 'd88f8c7'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

tracked = git('ls-tree', '-r', '--name-only', BASELINE).splitlines()
living_docs = {'docs/PROJECT_STATUS.md', 'docs/CHANGELOG.md'}
protected = [path for path in tracked if (path.startswith('docs/') and path not in living_docs) or path.startswith((
    'backend/sales/', 'backend/ingredients/', 'backend/recipes/', 'backend/products/', 'backend/expenses/'))
    or path == 'backend/accounts/models.py' or '/migrations/' in path]
changed = [path for path in git('diff', '--name-only', BASELINE).splitlines() if path in protected]
assert not changed, changed
all_paths = git('ls-files', '--cached', '--others', '--exclude-standard').splitlines()
new_migrations = [path for path in all_paths if '/migrations/' in path and path not in tracked]
assert not new_migrations, new_migrations
python_files = ['backend/accounts/authentication.py', 'backend/accounts/views.py', 'backend/accounts/urls.py',
    'backend/accounts/origin_config.py', 'backend/accounts/security.py', 'backend/backend/settings.py']
python_files += [str(path.relative_to(ROOT)).replace('\\', '/') for path in (ROOT/'docs/phase1b1').glob('*.py')]
for path in python_files:
    ast.parse((ROOT/path).read_text(encoding='utf-8'), filename=path)
result = {'baseline':BASELINE, 'branch':git('branch', '--show-current'), 'protected_files_compared':len(protected),
    'authorized_living_document_updates':sorted(living_docs),
    'protected_changes':changed, 'new_migrations':new_migrations, 'python_ast_files':len(python_files),
    'database_initialized':False, 'schema_changed':False,
    'ledger_migration_sha256':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in [
        'backend/ingredients/migrations/0004_inventory_integrity.py', 'backend/sales/migrations/0003_inventory_integrity.py']}}
folder = Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-static-'+uuid4().hex[:8])
folder.mkdir(parents=True)
(folder/'static-review.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
print('Evidence: '+str(folder.relative_to(ROOT)))
