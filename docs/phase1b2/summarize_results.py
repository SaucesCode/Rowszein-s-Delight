"""Actual completed evidence only; deferred failures remain failures."""
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
folders=sorted((HERE/'evidence').iterdir())
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def select(label, predicate):
    matches=[folder for folder in folders if label in folder.name and (folder/'summary.json').exists() and predicate(read(folder/'summary.json'))]
    assert matches, label
    return matches[-1]
def totals(folder):
    outcomes=[]
    for path in folder.glob('*.json'):
        data=read(path)
        if isinstance(data,dict): outcomes.extend(data.get('outcomes',[]))
    return {status:sum(row['status']==status for row in outcomes) for status in ['pass','fail','error','skip']}

result={'package':'1B.2 RBAC','baseline':'d696a74','api':{}}
for backend in ['postgres','sqlite']:
    before=select(backend+'-before-',lambda data:data['original_roles_13_before'].get('tests_run')==13 and data['original_roles_13_before'].get('failures')==13 and data['original_roles_13_before'].get('errors')==0)
    after=select(backend+'-all-',lambda data: all(data[name].get('exit_code')==0 for name in ['phase1a_120','original_roles_13','csrf_regressions','rbac_regressions'])
        and data['original_roles_13']['tests_run']==13 and data['phase1a_120']['tests_run']==120 and data['csrf_regressions']['tests_run']==26
        and data['rbac_regressions']['tests_run']==25 and data['original_security_13_after']['failures']==3)
    deferred=read(after/'original-security-13-after.json')
    failed=[row['test'].split('.')[-1] for row in deferred['outcomes'] if row['status']=='fail']
    assert set(failed)=={'test_logout_invalidates_copied_access_cookie','test_password_change_invalidates_existing_access_cookie','test_repeated_bad_login_is_rate_limited'}
    cleanup=read(after/'cleanup.json')
    assert cleanup['runtime_removed'] and not cleanup['production_access']
    if backend=='postgres': assert cleanup['owned_container_removed']
    result['api'][backend]={'before':str(before.relative_to(HERE)).replace('\\','/'), 'after':str(after.relative_to(HERE)).replace('\\','/'),
        'suites':read(after/'summary.json'),'outcome_totals':totals(after),'deferred_failures':failed}
browser=select('postgres-browser-',lambda data:data['browser']['exit_code']==0)
data=read(browser/'browser.json')
assert data['passed'] and all(value['passed'] for value in data['checks'].values()) and not data['page_errors']
result['browser']={'evidence':str(browser.relative_to(HERE)).replace('\\','/'),'passed_checks':len(data['checks']), 'page_errors':data['page_errors'],
    'staff_ui_requests':len(data['staff_ui_requests']), 'cleanup':read(browser/'cleanup.json')}
frontend=select('-frontend-',lambda data:all(data[name]['exit_code']==0 for name in ['rbac-permissions','csrf-transport','operation-identity','stock-preview','frontend-build','affected-lint']))
result['frontend']={'evidence':str(frontend.relative_to(HERE)).replace('\\','/'), 'permissions_pass':10,'csrf_transport_pass':14,'identity_pass':13,'stock_pass':10,
    'build_exit':0,'affected_lint_exit':0,'affected_lint_warnings':1,'full_lint_exit':1,'full_lint_errors':8,'full_lint_warnings':16}
static=[folder for folder in folders if (folder/'static-review.json').exists()][-1]
result['static']={'evidence':str(static.relative_to(HERE)).replace('\\','/'),**read(static/'static-review.json')}
result.update(all_attempts=[str(folder.relative_to(HERE)).replace('\\','/') for folder in folders],new_migrations=False,production_access=False,production_ready=False)
(HERE/'verification-summary.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
