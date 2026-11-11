"""Run date and preservation tests on fresh, owned targets."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import sys
import time
from uuid import uuid4

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / 'docs'
SECURITY = DOCS / 'phase1b3_verification'
sys.path.insert(0, str(SECURITY))
spec = importlib.util.spec_from_file_location('accepted_checks', SECURITY / 'run_checks.py')
accepted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accepted)

PRESERVATION = [
    'sales', 'session_api_contracts', 'security_compatibility', 'operational_cases',
    'rbac_compatibility', 'session_concurrency', 'pagination_tests',
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', choices=['postgres', 'sqlite'], required=True)
    parser.add_argument('--scope', choices=['before-api', 'api', 'preservation', 'before-browser', 'browser'], required=True)
    args = parser.parse_args()
    hashes = accepted.approved_hashes()
    folder = HERE / 'evidence' / f'{time.strftime("%Y%m%d-%H%M%S")}-{args.backend}-{args.scope}-{uuid4().hex[:8]}'
    folder.mkdir(parents=True)
    with accepted.harness.disposable(args.backend, folder) as (env, runtime, container):
        if container:
            config = json.loads(accepted.harness.docker('inspect', container))[0]['HostConfig']
            assert not config.get('Binds') and set(config.get('Tmpfs', {})) == {'/var/lib/postgresql/data'}
            assert {'rw', 'nosuid', 'nodev', 'size=384m'} <= set(config['Tmpfs']['/var/lib/postgresql/data'].split(','))
        marker = runtime / 'target.json'
        target = json.loads(marker.read_text())
        target.update(
            session_security_authorization='Phase 1B.3 disposable verification of 30a9a61',
            session_migration_hashes=hashes,
            corrected_migration_owner_approval='2026-11-10 exact SQLite literal fix',
            functional_audit_authorization='Phase 1C.1 synthetic isolated verification of fdd46a3',
            cache_repair_authorization='Phase 1C.2A verification based on b990398',
            pagination_authorization='Phase 1C.2B based on 98e29bf',
        )
        marker.write_text(json.dumps(target), encoding='utf-8')
        parents = ['phase1c2b', 'phase1c2a', 'phase1c1', 'phase1b3_verification', 'phase1b3_static', 'phase1b2', 'phase1b1', 'phase1b']
        env = {k: v for k, v in env.items() if not k.startswith(('AUTH_', 'CSRF_', 'CORS_', 'SESSION_'))}
        env.update(
            DJANGO_SETTINGS_MODULE='pagination_settings',
            PYTHONIOENCODING='utf-8',
            PYTHONPATH=os.pathsep.join(map(str, [HERE, *(DOCS / name for name in parents), ROOT / 'backend'])),
            ROWSZEIN_SESSION_TEST_KEY=secrets.token_urlsafe(48),
            ROWSZEIN_RATE_TEST_KEY=secrets.token_urlsafe(48),
            ROWSZEIN_DATE_BEFORE=str(int(args.scope.startswith('before'))),
            ROWSZEIN_BROWSER_PASSWORD=secrets.token_urlsafe(40),
        )
        metadata_file = folder / 'environment.json'
        metadata = json.loads(metadata_file.read_text())
        metadata.update(package='Phase 1C.3A', baseline='3934b74', scope=args.scope, new_migrations=False,
                        accepted_migration_hashes=hashes, dotenv_discovery=False)
        metadata_file.write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        if args.scope.endswith('browser'):
            command = [str(HERE / 'browser_dates.py')]
        else:
            labels = PRESERVATION if args.scope == 'preservation' else ['date_filter_tests']
            if args.scope == 'before-api':
                labels = ['date_filter_tests.DateFilterTests.test_invalid_filters_fail_closed']
            command = [str(ROOT / 'backend/manage.py'), 'test', *labels, '--settings=pagination_settings',
                       '--testrunner=date_result_runner.Runner', '--verbosity=2', '--noinput']
        result = accepted.child(env, folder, args.scope, command)
    (folder / 'summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    return result['exit_code']


if __name__ == '__main__':
    sys.exit(main())
