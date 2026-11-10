"""Aggregate real outcomes without overwriting a run or prior checkpoint."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
selected={
    'postgres_business':('20261110-144155-postgres-business-73cd9250','business.json'),
    'postgres_security':('20261110-150433-postgres-security-bf7a071d','security.json'),
    'postgres_concurrency':('20261110-145954-postgres-concurrency-71e16a88','concurrency.json'),
    'postgres_rbac':('20261110-144556-postgres-rbac-cce877fa','rbac.json'),
    'postgres_schema':('20261110-150447-postgres-schema-2a80069a','schema.json'),
    'browser':('20261110-151057-postgres-browser-a027024d','browser.json'),
    'sqlite_business':('20261110-144607-sqlite-business-27fab103','business.json'),
    'sqlite_security_failed':('20261110-143457-sqlite-security-f88c2ac7','security.json'),
    'sqlite_diagnostic_failed':('20261110-144141-sqlite-diagnostic-b5748ee5','diagnostic.json'),
    'sqlite_schema':('20261110-150819-sqlite-schema-bbfdb7b5','schema.json'),
}
summary={'approved_candidate':'30a9a61','corrective_commit':'c94d20f','sqlite_version':sqlite3.sqlite_version,
    'production_access':False,'deployment':False,'migration_files_unchanged':True,'package_complete':False,
    'pending':'SQLite corrected migration hash approval; no inferred authorization','suites':{},'cleanup':[]}
for name,(folder,file) in selected.items():
    path=HERE/'evidence'/folder/file
    data=json.loads(path.read_text())
    if 'outcomes' in data:
        entry={key:data[key] for key in ['tests_run','failures','errors','skipped']}
        entry['passed']=sum(item['status']=='pass' for item in data['outcomes'])
    else:
        entry={'checks_run':len(data.get('checks',{})),'passed':sum(bool(value) for value in data.get('checks',{}).values()),'failure':data.get('failure')}
    entry['evidence']=str(path.relative_to(ROOT)).replace('\\','/')
    summary['suites'][name]=entry
for path in sorted((HERE/'evidence').glob('*/cleanup.json')):
    data=json.loads(path.read_text())
    if not data['runtime_removed'] or data.get('production_access'): raise AssertionError('Cleanup failed.')
    summary['cleanup'].append({'file':str(path.relative_to(ROOT)).replace('\\','/'),**data})
for file in ['backend/accounts/migrations/0002_auththrottlebucket_devicesession_user_session_epoch_and_more.py',
        'backend/accounts/migrations/0003_session_security_guards.py']:
    original=subprocess.check_output(['git','show','30a9a61:'+file],cwd=ROOT).replace(b'\r\n',b'\n')
    current=(ROOT/file).read_text(encoding='utf-8-sig').encode()
    if hashlib.sha256(original).digest()!=hashlib.sha256(current).digest(): raise AssertionError('Approved migration changed.')
protected=['backend/sales/models.py','backend/ingredients/models.py','backend/products/models.py','backend/recipes/models.py',
    'backend/sales/inventory_math.py','backend/sales/financial_math.py','backend/sales/reporting.py','backend/requirements.txt',
    'frontend/package.json','frontend/package-lock.json','docs/phase1b1','docs/phase1b2','docs/phase1a','docs/phase1a2','docs/phase1a3_verification',
    'docs/phase1b3_static/evidence','backend/sales/tests.py','backend/sales/test_release_blockers.py','backend/sales/test_verification_extended.py']
diff=subprocess.run(['git','diff','--exit-code','30a9a61','--',*protected],cwd=ROOT,capture_output=True)
if diff.returncode: raise AssertionError('Prior tests/evidence/architecture changed.')
summary['prior_evidence_and_business_assertions_preserved']=True
summary['remaining_owned_runtime_directories']=[path.name for path in (ROOT/'.verification-runtime').iterdir() if path.is_dir()]
if summary['remaining_owned_runtime_directories']: raise AssertionError('Owned runtime remains.')
(HERE/'verification-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'selected_suites':len(selected),'cleanup_records':len(summary['cleanup']),'migration_files_unchanged':True,'package_complete':False}))
