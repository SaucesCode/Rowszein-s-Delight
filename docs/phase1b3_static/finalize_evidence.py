"""Read-only Git preservation check and static evidence summary. No Django/DB."""
import ast
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
FOLDER=Path(__file__).parent/'evidence'
def git(*args):
    return subprocess.run(['git',*args],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',check=True).stdout

baseline='f4ee98d'
tracked=git('ls-tree','-r','--name-only',baseline).splitlines()
protected=[]
for path in tracked:
    if (path.startswith(('docs/phase0','docs/phase1a','docs/phase1b/evidence/','docs/phase1b1/','docs/phase1b2/','docs/phase1b3/'))
            or '/migrations/' in path
            or (path.startswith('backend/') and ('/test' in path or path.endswith('/models.py')))
            or path in ('docs/phase1b/security_cases.py','frontend/src/lib/csrfTransport.ts','frontend/src/lib/permissions.ts',
                'frontend/src/lib/operationIdentity.ts','backend/sales/inventory_math.py','backend/sales/financial_math.py',
                'backend/sales/reporting.py','backend/sales/storage_precision.py','backend/requirements.txt',
                'frontend/package.json','frontend/package-lock.json')):
        # User gains only its specifically authorized security metadata.
        if path!='backend/accounts/models.py': protected.append(path)
changed_tracked=set(git('diff','--name-only',baseline).splitlines())
if changed_tracked.intersection(protected): raise AssertionError('Protected historical source/evidence changed.')

old=ast.parse(git('show',baseline+':backend/accounts/security.py'))
new=ast.parse((ROOT/'backend/accounts/security.py').read_text(encoding='utf-8-sig'))
def csrf(tree):
    return ast.dump(next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='enforce_csrf'))
assert csrf(old)==csrf(new),'Existing CSRF enforcement changed.'

FOLDER.mkdir(exist_ok=True)
inventory=FOLDER/'changed-files.txt'
summary_path=FOLDER/'checkpoint-verification.json'
inventory.touch(exist_ok=True)
summary_path.touch(exist_ok=True)
changed=sorted(set(git('diff','--name-only',baseline).splitlines()+git('ls-files','--others','--exclude-standard').splitlines()))
inventory.write_text('\n'.join(changed)+'\n',encoding='utf-8')
backend=json.loads((FOLDER/'static-tests.json').read_text())
assert backend['failures']==backend['errors']==backend['database_access_attempts']==0
summary={'baseline':baseline,'branch':git('branch','--show-current').strip(),'schema_executed':False,
    'database_connections':0,'new_migrations_applied':0,'production_access':False,'deployment':False,
    'protected_tracked_files_unchanged':len(protected),'csrf_enforcement_ast_unchanged':True,
    'backend_static':backend,'frontend_checks':{'csrf_transport':14,'operation_identity':13,'permissions':10,'auth_lifecycle':5,
        'total':42,'failures':0,'real_browser':False},'frontend_build':'PASS (existing CSS/chunk warnings)',
    'focused_frontend_lint':'PASS','django_dummy_backend_check':'PASS','migration_state_drift':'NONE',
    'integration_api_concurrency_admin_browser':'NOT RUN: awaiting migration authorization',
    'release_blockers':{'logout_copied_access':'OPEN','password_change_existing_access':'OPEN','shared_login_throttling':'OPEN'},
    'changed_file_count':len(changed)}
summary_path.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:summary[key] for key in ['branch','schema_executed','protected_tracked_files_unchanged','changed_file_count','release_blockers']}))
