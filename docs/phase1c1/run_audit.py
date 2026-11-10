"""Fresh owned targets only. Apply accepted migrations; create no migrations."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
OLD = ROOT / 'docs/phase1b3_verification'
sys.path.insert(0, str(OLD))
spec = importlib.util.spec_from_file_location('accepted_checks', OLD / 'run_checks.py')
accepted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accepted)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', choices=['sqlite', 'postgres'], required=True)
    parser.add_argument('--scope', choices=['audit', 'preservation', 'browser'], default='audit')
    args = parser.parse_args()
    hashes = accepted.approved_hashes()
    folder = HERE / 'evidence' / (time.strftime('%Y%m%d-%H%M%S') + '-' + args.backend + '-' + args.scope + '-' + uuid4().hex[:8])
    folder.mkdir(parents=True)
    with accepted.harness.disposable(args.backend, folder) as (env, runtime, container):
        if container:
            info = json.loads(accepted.harness.docker('inspect', container))[0]['HostConfig']
            assert not info.get('Binds') and set(info.get('Tmpfs', {})) == {'/var/lib/postgresql/data'}
            assert {'rw', 'nosuid', 'nodev', 'size=384m'} <= set(info['Tmpfs']['/var/lib/postgresql/data'].split(','))
        marker = runtime / 'target.json'
        target = json.loads(marker.read_text())
        target.update(session_security_authorization='Phase 1B.3 disposable verification of 30a9a61',
            session_migration_hashes=hashes, corrected_migration_owner_approval='2026-11-10 exact SQLite literal fix',
            functional_audit_authorization='Phase 1C.1 synthetic isolated verification of fdd46a3')
        marker.write_text(json.dumps(target), encoding='utf-8')
        env = {k: v for k, v in env.items() if not k.startswith(('AUTH_', 'CSRF_', 'CORS_', 'SESSION_'))}
        env.update(DJANGO_SETTINGS_MODULE='audit_settings', PYTHONIOENCODING='utf-8',
            PYTHONPATH=os.pathsep.join(map(str, [HERE, OLD, ROOT/'docs/phase1b3_static', ROOT/'docs/phase1b2',
                ROOT/'docs/phase1b1', ROOT/'docs/phase1b', ROOT/'backend'])),
            ROWSZEIN_SESSION_TEST_KEY=secrets.token_urlsafe(48), ROWSZEIN_RATE_TEST_KEY=secrets.token_urlsafe(48))
        metadata = json.loads((folder/'environment.json').read_text())
        metadata.update(package='Phase 1C.1 audit', baseline='fdd46a3', accepted_migration_hashes=hashes,
            dotenv_discovery=False, synthetic_only=True, new_migrations=False)
        (folder/'environment.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        if args.scope == 'browser':
            summary = accepted.child(env, folder, 'browser', [str(HERE/'browser_audit.py')])
        else:
            labels = ['audit_cases'] if args.scope == 'audit' else ['sales', 'session_api_contracts', 'security_compatibility',
                'operational_cases', 'rbac_compatibility', 'session_concurrency']
            summary = accepted.child(env, folder, args.scope, [str(ROOT/'backend/manage.py'), 'test', *labels,
                '--settings=audit_settings', '--testrunner=audit_runner.Runner', '--verbosity=2', '--noinput'])
    (folder/'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    sys.exit(summary['exit_code'])
