import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('owned_harness', ROOT/'docs/phase1a3_verification/run_verification.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


def run(env, folder, name, labels):
    env = dict(env, PYTHONIOENCODING='utf-8', PYTHONPATH=os.pathsep.join([str(HERE), str(ROOT/'docs/phase1b'), str(ROOT/'backend')]),
               ROWSZEIN_VERIFY_RESULTS=str((folder/(name+'.json')).resolve()), DJANGO_SETTINGS_MODULE='verification_settings')
    command = [sys.executable, '-B', str(ROOT/'backend/manage.py'), 'test', *labels,
        '--settings=verification_settings', '--testrunner=result_runner.PackageRunner', '--verbosity=2', '--noinput']
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8')
    log = result.stdout+result.stderr
    for key in ['ROWSZEIN_VERIFY_TOKEN', 'ROWSZEIN_VERIFY_PASSWORD']:
        if env.get(key): log = log.replace(env[key], '[REDACTED]')
    (folder/(name+'.txt')).write_text(log, encoding='utf-8')
    path = folder/(name+'.json')
    data = json.loads(path.read_text()) if path.exists() else {'tests_run': 0, 'errors': 1}
    summary = {key:value for key,value in data.items() if key != 'outcomes'}
    summary['exit_code'] = result.returncode
    print(name+': '+json.dumps(summary), flush=True)
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', choices=['sqlite', 'postgres'], required=True)
    parser.add_argument('--scope', choices=['before', 'all', 'security', 'browser'], default='all')
    args = parser.parse_args()
    folder = HERE/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-'+args.backend+'-'+args.scope+'-'+uuid4().hex[:8])
    folder.mkdir(parents=True)
    results = {}
    with harness.disposable(args.backend, folder) as (env, runtime, container):
        (runtime/'static').mkdir(exist_ok=True)
        metadata = json.loads((folder/'environment.json').read_text())
        metadata.update(package='1B.1 CSRF only', scope=args.scope, application_baseline='d88f8c7', new_migrations=False,
                        local_http_test_cookie_override=True, csrf_checks_disabled=False)
        (folder/'environment.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        if args.scope == 'before':
            results['original_security_13_before'] = run(env, folder, 'original-security-13-before', ['security_cases.DesiredSecurityContracts'])
        if args.scope in ['all', 'security']:
            results['original_security_13_after'] = run(env, folder, 'original-security-13-after', ['security_cases.DesiredSecurityContracts'])
            results['csrf_regressions'] = run(env, folder, 'csrf-regressions', ['csrf_regressions'])
        if args.scope == 'all':
            results['phase1a_120'] = run(env, folder, 'phase1a-120', ['sales'])
            results['pending_1b2_roles'] = run(env, folder, 'pending-1b2-roles', ['security_cases.ProposedRoleContracts'])
        if args.scope == 'browser':
            child_env = dict(env, PYTHONIOENCODING='utf-8', PYTHONPATH=os.pathsep.join([str(HERE), str(ROOT/'backend')]),
                DJANGO_SETTINGS_MODULE='verification_settings', ROWSZEIN_VERIFY_RESULTS=str((folder/'browser.json').resolve()))
            result = subprocess.run([sys.executable, '-B', str(HERE/'browser_checks.py')], cwd=ROOT, env=child_env, capture_output=True, text=True, encoding='utf-8')
            (folder/'browser.txt').write_text(result.stdout+result.stderr, encoding='utf-8')
            results['browser'] = {'exit_code': result.returncode}
    (folder/'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Evidence: '+str(folder.relative_to(ROOT)), flush=True)
    sys.exit(0 if all(value['exit_code']==0 for value in results.values()) else 1)
