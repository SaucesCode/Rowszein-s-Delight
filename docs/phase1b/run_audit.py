"""Audit/design only; existing schema on owned disposable targets; no app edits."""
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
spec = importlib.util.spec_from_file_location('owned_target_harness', ROOT/'docs/phase1a3_verification/run_verification.py')
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


def run(env, folder, name, labels):
    env = dict(env, PYTHONPATH=str(HERE)+os.pathsep+str(ROOT/'backend'), ROWSZEIN_VERIFY_RESULTS=str((folder/(name+'.json')).resolve()))
    command = [sys.executable, '-B', str(ROOT/'backend/manage.py'), 'test', *labels,
        '--settings=backend.disposable_verification_settings', '--testrunner=audit_runner.AuditRunner', '--verbosity=2', '--noinput']
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
    log = result.stdout+result.stderr
    for key in ['ROWSZEIN_VERIFY_TOKEN', 'ROWSZEIN_VERIFY_PASSWORD']:
        if env.get(key): log = log.replace(env[key], '[REDACTED]')
    (folder/(name+'.txt')).write_text(log, encoding='utf-8')
    path = folder/(name+'.json')
    data = json.loads(path.read_text()) if path.exists() else {'tests_run': 0, 'errors': 1}
    small = {key:value for key,value in data.items() if key != 'outcomes'}
    small['exit_code'] = result.returncode
    print(name+': '+json.dumps(small), flush=True)
    return small


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', choices=['sqlite', 'postgres'], required=True)
    args = parser.parse_args()
    folder = HERE/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-'+args.backend+'-'+uuid4().hex[:8])
    folder.mkdir(parents=True)
    results = {}
    with harness.disposable(args.backend, folder) as (env, runtime, container):
        # The existing ownership/migration safety profile is retained verbatim;
        # audit purpose is recorded separately rather than weakening its gates.
        metadata = json.loads((folder/'environment.json').read_text())
        metadata.update(audit_scope='Phase 1B audit/design only', application_baseline='dcf2500',
                        authentication_permissions_replaced=False, schema_changes=False)
        (folder/'environment.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        (runtime/'static').mkdir(exist_ok=True)
        results['current_behavior_controls'] = run(env, folder, 'current-behavior-controls', ['security_cases.CurrentBehaviorControls'])
        results['desired_security_red'] = run(env, folder, 'desired-security-red', ['security_cases.DesiredSecurityContracts'])
        results['proposed_roles_red'] = run(env, folder, 'proposed-roles-red', ['security_cases.ProposedRoleContracts'])
        results['phase1a_regressions'] = run(env, folder, 'phase1a-regressions', ['sales'])
    (folder/'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Evidence: '+str(folder.relative_to(ROOT)), flush=True)
    # Red requirements are deliberate audit findings, never green/expectedFailure.
    sys.exit(0 if all(value['exit_code']==0 for value in results.values()) else 1)
