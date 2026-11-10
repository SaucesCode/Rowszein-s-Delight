"""Aggregate real outcomes without overwriting a run or prior checkpoint."""
import json
from pathlib import Path
import sqlite3
import subprocess
from migration_approval import verify_migrations
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
PG='20261110-153547-corrected-postgres-all-dbad0066'
SQLITE='20261110-153458-corrected-sqlite-all-b7c06893'
selected={
    **{'postgres_'+group:(PG,group+'.json') for group in ['business','security','concurrency','rbac','schema']},
    **{'sqlite_'+group:(SQLITE,group+'.json') for group in ['business','security','concurrency','rbac','schema']},
    'browser_postgres':('20261110-151057-postgres-browser-a027024d','browser.json'),
    'browser_sqlite':('20261110-154306-corrected-sqlite-browser-347f5033','browser.json'),
}
archive=HERE/'verification-summary-before-sqlite-correction.json'
original_summary=subprocess.check_output(['git','show','b57672a:docs/phase1b3_verification/verification-summary.json'],cwd=ROOT)
if archive.exists() and archive.read_bytes()!=original_summary: raise AssertionError('Historical summary archive changed.')
if not archive.exists(): archive.write_bytes(original_summary)
summary={'approved_candidate':'30a9a61','earlier_corrective_commit':'c94d20f','sqlite_correction_commit':'b9957e0',
    'sqlite_version':sqlite3.sqlite_version,'production_access':False,'deployment':False,
    'migration_hashes':verify_migrations(ROOT),'exact_owner_approved_correction_only':True,
    'package_complete':True,'production_ready':False,'suites':{},'cleanup':[],
    'historical_failure_summary':str(archive.relative_to(ROOT)).replace('\\','/')}
for name,(folder,file) in selected.items():
    path=HERE/'evidence'/folder/file
    data=json.loads(path.read_text())
    if 'outcomes' in data:
        entry={key:data[key] for key in ['tests_run','failures','errors','skipped']}
        entry['passed']=sum(item['status']=='pass' for item in data['outcomes'])
        if entry['failures'] or entry['errors']: raise AssertionError('Selected final suite failed: '+name)
    else:
        entry={'checks_run':len(data.get('checks',{})),'passed':sum(bool(value) for value in data.get('checks',{}).values()),'failure':data.get('failure')}
        if entry['failure'] or entry['passed']!=entry['checks_run']: raise AssertionError('Selected final checks failed: '+name)
    entry['evidence']=str(path.relative_to(ROOT)).replace('\\','/')
    summary['suites'][name]=entry
for path in sorted((HERE/'evidence').glob('*/cleanup.json')):
    data=json.loads(path.read_text())
    if not data['runtime_removed'] or data.get('production_access'): raise AssertionError('Cleanup failed.')
    summary['cleanup'].append({'file':str(path.relative_to(ROOT)).replace('\\','/'),**data})
for folder in {PG,SQLITE,'20261110-154306-corrected-sqlite-browser-347f5033'}:
    metadata=json.loads((HERE/'evidence'/folder/'environment.json').read_text())
    if metadata['new_migration_hashes']!=summary['migration_hashes']: raise AssertionError('Final run used a different migration.')
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
print(json.dumps({'selected_suites':len(selected),'cleanup_records':len(summary['cleanup']),'exact_approved_migration_hashes':True,'package_complete':True}))
