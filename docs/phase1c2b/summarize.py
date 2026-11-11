"""Summarize observed outcomes and hash preservation; never import the app."""
import ast
import hashlib
import json
from pathlib import Path
import socket
import subprocess

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
EVIDENCE=HERE/'evidence'
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True).splitlines()

summary={'baseline':'98e29bf','branch':git('branch','--show-current')[0],'production_access':False,'deployment':False,
    'browser':{},'api':{},'preservation':{}}
for scope in ['browser','before','api','preservation']:
    for path in sorted(EVIDENCE.glob('*/'+scope+'.json')):
        data=read(path)
        if 'observations' in data:
            observed=data['observations']
            summary['browser'][path.parent.name]={'baseline':data['baseline'],'checks':len(observed),
                'passed':sum(row['passed'] for row in observed.values()),'failed':sum(not row['passed'] for row in observed.values()),
                'harness_failure':bool(data.get('harness_failure')),'servers_stopped':data['servers_stopped'],'page_errors':data['page_errors']}
        else:
            summary[scope][path.parent.name]={k:v for k,v in data.items() if k!='outcomes'}
            summary[scope][path.parent.name]['passed']=sum(row['status']=='pass' for row in data['outcomes'])
frontend=sorted(EVIDENCE.glob('*-frontend-*'))[-1]
lint=read(frontend/'full-lint.txt')
summary['frontend']={'evidence':str(frontend.relative_to(ROOT)).replace('\\','/'),'results':read(frontend/'summary.json'),
    'unit_total':66,'full_lint':{'errors':sum(row['errorCount'] for row in lint),'warnings':sum(row['warningCount'] for row in lint)}}
summary['historical_hashes']={}
for name,manifest,base in [('phase0','docs/phase1a/evidence/phase0-evidence-sha256.json',ROOT/'docs/audit/evidence'),
        ('phase1c1','docs/phase1c1/manifest.json',ROOT),('phase1c2a','docs/phase1c2a/manifest.json',ROOT)]:
    hashes=read(ROOT/manifest)
    bad=[path for path,digest in hashes.items() if hashlib.sha256((base/path).read_bytes()).hexdigest()!=digest]
    assert not bad,bad
    summary['historical_hashes'][name]={'checked':len(hashes),'mismatches':bad}
paths=git('diff','98e29bf','--name-only','--','backend','frontend/src')+git('ls-files','--others','--exclude-standard','--','backend','frontend/src')
summary['application_files']=sorted(set(paths))
permitted_backend={'backend/backend/catalog_listing.py','backend/products/views.py','backend/ingredients/views.py',
    'backend/recipes/views.py','backend/recipes/serializers.py'}
assert {path for path in paths if path.startswith('backend/')}==permitted_backend
protected=git('diff','98e29bf','--name-only','--','frontend/package.json','frontend/package-lock.json','frontend/src/services/api.ts',
    'frontend/src/hooks/useAuth.ts','frontend/src/lib/csrfTransport.ts','frontend/src/lib/authLifecycle.ts',
    'frontend/src/lib/operationIdentity.ts','frontend/src/hooks/useOperationIdentity.ts','frontend/src/components/ProtectedRoute.tsx')
assert not protected,protected
summary['protected_path_diffs']=protected
for path in [*(ROOT/path for path in permitted_backend),*HERE.glob('*.py')]:
    ast.parse(path.read_text(encoding='utf-8-sig'),filename=str(path))
summary['python_syntax_passed']=True
summary['cleanup']={'remaining_runtime_directories':[p.name for p in (ROOT/'.verification-runtime').iterdir() if p.is_dir()],
    'runs':{path.parent.name:read(path) for path in EVIDENCE.glob('*/cleanup.json')},'ports_available':{}}
assert not summary['cleanup']['remaining_runtime_directories']
for folder,data in summary['cleanup']['runs'].items():
    assert data['runtime_removed'] and not data['production_access']
    environment=EVIDENCE/folder/'environment.json'
    if environment.exists() and read(environment)['backend']=='postgres': assert data['owned_container_removed']
for port in [18841,18842]:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',port))
        summary['cleanup']['ports_available'][str(port)]=True
(HERE/'verification-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
manifest={str(path.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(path.read_bytes()).hexdigest()
    for path in sorted(HERE.rglob('*')) if path.is_file() and path.name!='manifest.json'}
(HERE/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'app_files':len(summary['application_files']),'frontend':summary['frontend']['evidence'],
    'lint':summary['frontend']['full_lint'],'historical_hashes':summary['historical_hashes'],
    'cleanup_runs':len(summary['cleanup']['runs']),'manifest_files':len(manifest)},indent=2))
