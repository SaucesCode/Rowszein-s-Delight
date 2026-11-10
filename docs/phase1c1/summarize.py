"""Recompute compact audit facts from retained raw evidence; no app execution."""
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
def read(name): return json.loads((EVIDENCE/name).read_text(encoding='utf-8'))

summary={'baseline':'fdd46a3','branch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),
    'production_access':False,'deployment':False,'new_migrations':False,'application_changes':False}
summary['suites']={}
for path in sorted(EVIDENCE.glob('*/preservation.json')):
    data=json.loads(path.read_text())
    summary['suites'][path.parent.name]={'tests':data['tests_run'],'passed':sum(x['status']=='pass' for x in data['outcomes']),
        'failures':data['failures'],'errors':data['errors'],'skipped':data['skipped'],
        'by_group':dict(Counter(x['test'].split('.')[0] for x in data['outcomes'] if x['status']=='pass'))}
summary['audit_probes']={}
for path in sorted(EVIDENCE.glob('*/audit.json')):
    data=json.loads(path.read_text())
    summary['audit_probes'][path.parent.name]={k:v for k,v in data.items() if k!='outcomes'}
static=next(EVIDENCE.glob('*-static-*'))
lint=json.loads((static/'full-lint.json').read_text())
summary['lint']={'errors':sum(row['errorCount'] for row in lint),'warnings':sum(row['warningCount'] for row in lint)}
deps=next(EVIDENCE.glob('*-dependencies-*'))
pip=json.loads((deps/'pip-audit.json').read_text())
vulnerable=[row for row in pip['dependencies'] if row['vulns']]
summary['python_advisories']={'reported_records':sum(len(row['vulns']) for row in vulnerable),'packages':[
    {'package':row['name'],'version':row['version'],'unique_cves':len({next((a for a in v.get('aliases',[]) if a.startswith('CVE-')),v['id']) for v in row['vulns']})} for row in vulnerable]}
npm=json.loads((deps/'npm-audit.json').read_text())
summary['npm_advisories']=npm['metadata']['vulnerabilities']
summary['npm_direct_affected']=[name for name,row in npm['vulnerabilities'].items() if row['isDirect']]
phase0=json.loads((ROOT/'docs/phase1a/evidence/phase0-evidence-sha256.json').read_text())
summary['phase0_evidence']={'checked':len(phase0),'mismatches':[name for name,digest in phase0.items()
    if hashlib.sha256((ROOT/'docs/audit/evidence'/name).read_bytes()).hexdigest()!=digest]}
summary['accepted_tracked_files_changed']=subprocess.check_output(['git','diff','--name-only','fdd46a3','--','backend','frontend','docs'],cwd=ROOT,text=True).splitlines()
syntax=[]
for folder in [ROOT/'backend',HERE]:
    for path in folder.rglob('*.py'):
        if any(part in ['.venv','__pycache__'] for part in path.parts): continue
        ast.parse(path.read_text(encoding='utf-8-sig'),filename=str(path))
        syntax.append(str(path.relative_to(ROOT)))
summary['python_syntax']={'parsed':len(syntax),'errors':0}
summary['runtime_directories_remaining']=[p.name for p in (ROOT/'.verification-runtime').iterdir() if p.is_dir()]
summary['browser_ports_closed']={}
for port in [18841,18842]:
    with socket.socket() as sock:
        summary['browser_ports_closed'][str(port)]=sock.connect_ex(('127.0.0.1',port))!=0
for path in sorted(EVIDENCE.glob('*/browser.json')):
    data=json.loads(path.read_text())
    if not data.get('harness_failure'):
        summary['latest_completed_browser']={'evidence':str(path.relative_to(ROOT)),
            'checks':{name:value for name,value in data['observations'].items() if isinstance(value,dict) and 'desired_behavior_passed' in value},
            'page_errors':data['page_errors'],'servers_stopped':data['servers_stopped']}
(HERE/'verification-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['latest_completed_browser','accepted_tracked_files_changed']},indent=2))
