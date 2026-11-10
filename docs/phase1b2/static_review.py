"""No Django setup/database: verify evidence, schema and assertion provenance."""
import ast
from copy import deepcopy
import hashlib
import json
import re
from pathlib import Path
import subprocess
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
BASE = 'd696a74'
def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
tracked = git('ls-tree','-r','--name-only',BASE).splitlines()
changed = git('diff','--name-only',BASE).splitlines()
living = {'docs/PROJECT_STATUS.md','docs/CHANGELOG.md'}
protected = [path for path in tracked if (path.startswith('docs/') and path not in living)
    or '/migrations/' in path or path.endswith('/models.py') or path in [
        'backend/sales/inventory_math.py','backend/sales/financial_math.py','backend/sales/storage_precision.py',
        'backend/sales/reporting.py','backend/accounts/security.py','backend/accounts/origin_config.py',
        'frontend/src/lib/csrfTransport.ts','frontend/src/lib/operationIdentity.ts','frontend/src/services/api.ts']]
violations = sorted(set(protected)&set(changed))
assert not violations, violations
all_paths = git('ls-files','--cached','--others','--exclude-standard').splitlines()
new_migrations = [path for path in all_paths if '/migrations/' in path and path not in tracked]
assert not new_migrations, new_migrations

fixtures = ['backend/sales/tests.py','backend/sales/test_release_blockers.py','backend/sales/test_verification_extended.py']
for path in fixtures:
    before = ast.parse(git('show', BASE+':'+path))
    after = ast.parse((ROOT/path).read_text(encoding='utf-8'))
    count = 0
    for node in ast.walk(after):
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='create_user':
            additions = [kw for kw in node.keywords if kw.arg=='role' and isinstance(kw.value,ast.Constant) and kw.value.value=='admin']
            count += len(additions)
            node.keywords = [kw for kw in node.keywords if kw not in additions]
    assert count == 1, (path,count)
    assert ast.dump(before) == ast.dump(after), 'Non-fixture/assertion drift: '+path

sources = [path for path in all_paths if path.endswith('.py') and (path in changed or path.startswith('docs/phase1b2/'))]
sources += [path for path in all_paths if path.startswith('backend/accounts/') and path.endswith('.py') and path not in tracked]
for path in set(sources): ast.parse((ROOT/path).read_text(encoding='utf-8'),filename=path)
policy=ast.parse((ROOT/'backend/accounts/permissions.py').read_text())
assignments={node.targets[0].id:node.value for node in policy.body if isinstance(node,ast.Assign)}
staff=set(ast.literal_eval(assignments['STAFF'].args[0]))
owner=staff|set(ast.literal_eval(assignments['OWNER'].right.args[0]))
frontend=(ROOT/'frontend/src/lib/permissions.ts').read_text()
front_staff=set(json.loads(re.search(r'const STAFF = new Set\((\[.*?\])\)',frontend).group(1)))
front_owner=front_staff|set(json.loads(re.search(r'const OWNER = new Set\((\[.*?\])\)',frontend).group(1).replace('...STAFF,','')))
assert (staff,owner)==(front_staff,front_owner), 'Frontend/backend capability drift'
for path,names in [('backend/accounts/views.py',{'set_auth_cookies','PrivateAuthResponseView','CSRFProtectedAuthView','CSRFTokenView','LogoutView'}),
                   ('backend/accounts/authentication.py',{'CookieJWTAuthentication'})]:
    before=ast.parse(git('show',BASE+':'+path))
    after=ast.parse((ROOT/path).read_text())
    extract=lambda tree:{node.name:ast.dump(node) for node in tree.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in names}
    assert extract(before)==extract(after), 'CSRF guard/cookie drift: '+path
result = {'baseline':BASE,'branch':git('branch','--show-current'), 'database_initialized':False,
    'protected_files':len(protected),'protected_changes':violations,'new_migrations':new_migrations,
    'business_test_changes':'Exactly three explicit admin fixture roles; all other AST nodes/assertions unchanged',
    'python_ast_files':len(set(sources)), 'frontend_backend_capabilities_match':True, 'csrf_core_guards_unchanged':True, 'ledger_migration_sha256':{
        path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in [
            'backend/ingredients/migrations/0004_inventory_integrity.py','backend/sales/migrations/0003_inventory_integrity.py']}}
folder=Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-static-'+uuid4().hex[:8])
folder.mkdir(parents=True)
(folder/'static-review.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
print('Evidence: '+str(folder.relative_to(ROOT)))
