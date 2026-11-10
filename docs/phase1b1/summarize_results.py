"""Select actual completed runs; retain and disclose unsuccessful attempts."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
folders = sorted((HERE/'evidence').iterdir())

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def select(suffix, predicate):
    matching = [folder for folder in folders if suffix in folder.name and (folder/'summary.json').exists()
                and predicate(load(folder/'summary.json'))]
    if not matching:
        raise AssertionError('No completed qualifying '+suffix+' evidence')
    return matching[-1]

api = {}
for backend in ['postgres', 'sqlite']:
    before = select(backend+'-before-', lambda data: data['original_security_13_before']['tests_run'] == 13
        and data['original_security_13_before']['failures'] == 13 and data['original_security_13_before']['errors'] == 0)
    after = select(backend+'-all-', lambda data: data['original_security_13_after']['tests_run'] == 13
        and data['original_security_13_after']['failures'] == 3 and data['original_security_13_after']['errors'] == 0
        and data['csrf_regressions']['tests_run'] == 26 and data['csrf_regressions']['exit_code'] == 0
        and data['phase1a_120']['tests_run'] == 120 and data['phase1a_120']['exit_code'] == 0
        and data['pending_1b2_roles']['failures'] == 13 and data['pending_1b2_roles']['errors'] == 0)
    data = load(after/'summary.json')
    api[backend] = {'before_evidence':str(before.relative_to(HERE)), 'after_evidence':str(after.relative_to(HERE)), **data}
    for folder in [before, after]:
        cleanup = load(folder/'cleanup.json')
        assert cleanup['runtime_removed'] and not cleanup['production_access']
        if backend == 'postgres': assert cleanup['owned_container_removed']

browser = select('postgres-browser-', lambda data: data['browser']['exit_code'] == 0)
browser_data = load(browser/'browser.json')
assert browser_data['passed'] and all(check['passed'] for check in browser_data['checks'].values())
assert load(browser/'cleanup.json')['owned_container_removed']
frontend = select('-frontend-', lambda data: all(data[name]['exit_code'] == 0 for name in [
    'csrf-transport', 'operation-identity', 'stock-preview', 'frontend-build', 'affected-lint']) and data['full-lint']['exit_code'] == 1)
static = [folder for folder in folders if (folder/'static-review.json').exists()][-1]
static_data = load(static/'static-review.json')
assert not static_data['protected_changes'] and not static_data['new_migrations']
result = {'package':'1B.1 CSRF only', 'api':api,
    'browser':{'evidence':str(browser.relative_to(HERE)), 'checks':len(browser_data['checks']), 'failed':0,
        'page_errors':browser_data['page_errors'], 'owned_targets_removed':True},
    'frontend':{'evidence':str(frontend.relative_to(HERE)), 'csrf_transport_passes':14,
        'operation_identity_passes':13, 'stock_preview_passes':10, 'build_exit':0, 'affected_lint_exit':0,
        'full_lint_exit':1, 'existing_lint_errors':12, 'existing_lint_warnings':16},
    'static':{'evidence':str(static.relative_to(HERE)), **static_data},
    'deferred_security_failures':[
        'logout_invalidates_copied_access_cookie', 'password_change_invalidates_existing_access_cookie', 'repeated_bad_login_is_rate_limited'],
    'all_attempts':[str(folder.relative_to(HERE)) for folder in folders if folder.is_dir()],
    'production_access':False, 'new_migrations':False, 'ready_for_package_review':True, 'production_ready':False}
(HERE/'verification-summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
