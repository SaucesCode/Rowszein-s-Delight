"""Compact actual evidence and verify baseline preservation; no app execution."""
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import socket
import subprocess

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
EVIDENCE=HERE/'evidence'
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def changed(*paths):
    return subprocess.check_output(['git','diff','b990398','--name-only','--',*paths],cwd=ROOT,text=True).splitlines()

summary={'baseline':'b990398','branch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),
    'production_access':False,'deployment':False,'preservation':{},'browser_runs':{}}
for file in sorted(EVIDENCE.glob('*/preservation.json')):
    data=read(file)
    summary['preservation'][file.parent.name]={k:v for k,v in data.items() if k!='outcomes'}
    summary['preservation'][file.parent.name].update(passed=sum(row['status']=='pass' for row in data['outcomes']),
        passed_by_group=dict(Counter(row['test'].split('.')[0] for row in data['outcomes'] if row['status']=='pass')))
for file in sorted([*EVIDENCE.glob('*/before.json'),*EVIDENCE.glob('*/browser.json')]):
    data=read(file)
    observations=data['observations']
    summary['browser_runs'][file.parent.name]={'checks':len(observations),'passed':sum(row['passed'] for row in observations.values()),
        'failed':sum(not row['passed'] for row in observations.values()),'baseline':data['baseline'],
        'incomplete_harness_run':bool(data.get('harness_failure')),'servers_stopped':data['servers_stopped'],
        'page_errors':data['page_errors']}
    if not data.get('harness_failure') and not data['baseline']:
        summary['final_browser']={'evidence':str(file.relative_to(ROOT)).replace('\\','/'),'checks':observations,
            'fault_injections':data.get('fault_injections',[])}
frontend=sorted(EVIDENCE.glob('*-frontend-*'))[-1]
summary['frontend']={'evidence':str(frontend.relative_to(ROOT)).replace('\\','/'),'results':read(frontend/'summary.json'),
    'new_tests':9,'accepted_tests':52}
lint=read(frontend/'full-lint.txt')
summary['frontend']['full_lint']={'errors':sum(row['errorCount'] for row in lint),'warnings':sum(row['warningCount'] for row in lint)}
summary['immutable_path_diffs']={'backend':changed('backend'),'dependencies':changed('frontend/package.json','frontend/package-lock.json'),
    'auth_and_idempotency':changed('frontend/src/hooks/useAuth.ts','frontend/src/components/ProtectedRoute.tsx',
        'frontend/src/lib/csrfTransport.ts','frontend/src/lib/authLifecycle.ts','frontend/src/lib/operationIdentity.ts','frontend/src/hooks/useOperationIdentity.ts')}
assert not any(summary['immutable_path_diffs'].values())
summary['historical_hashes']={}
for name,manifest,base in [('phase0',ROOT/'docs/phase1a/evidence/phase0-evidence-sha256.json',ROOT/'docs/audit/evidence'),
        ('phase1c1',ROOT/'docs/phase1c1/manifest.json',ROOT)]:
    hashes=read(manifest)
    mismatches=[path for path,digest in hashes.items() if hashlib.sha256((base/path).read_bytes()).hexdigest()!=digest]
    summary['historical_hashes'][name]={'checked':len(hashes),'mismatches':mismatches}
    assert not mismatches
summary['new_python_syntax']={'parsed':0,'errors':0}
for file in HERE.glob('*.py'):
    ast.parse(file.read_text(encoding='utf-8-sig'),filename=str(file))
    summary['new_python_syntax']['parsed']+=1
summary['cleanup']={'remaining_runtime_directories':[p.name for p in (ROOT/'.verification-runtime').iterdir() if p.is_dir()],
    'runs':{file.parent.name:read(file) for file in EVIDENCE.glob('*/cleanup.json')},'ports_available':{}}
for port in [18841,18842]:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',port))
        summary['cleanup']['ports_available'][str(port)]=True
assert not summary['cleanup']['remaining_runtime_directories']
(HERE/'verification-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
files=[file for file in HERE.rglob('*') if file.is_file() and file.name!='manifest.json']
(HERE/'manifest.json').write_text(json.dumps({str(file.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(file.read_bytes()).hexdigest()
    for file in sorted(files)},indent=2),encoding='utf-8')
print(json.dumps({'preservation':summary['preservation'],'frontend_lint':summary['frontend']['full_lint'],
    'historical_hashes':summary['historical_hashes'],'runtime_directories':summary['cleanup']['remaining_runtime_directories'],
    'ports_available':summary['cleanup']['ports_available'],'manifest_files':len(files)},indent=2))
