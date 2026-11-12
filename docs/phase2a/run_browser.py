"""Start guarded, disposable Django and Vite for Phase 2A captures."""
import argparse
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
sys.path.insert(0, str(DOCS / 'phase1c3a'))
from run_checks import accepted  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['before', 'after'])
    parser.add_argument('--backend', choices=['sqlite', 'postgres'], default='sqlite')
    options = parser.parse_args()
    mode = options.mode
    hashes = accepted.approved_hashes()
    folder = HERE / 'evidence' / f'{mode}-{time.strftime("%Y%m%d-%H%M%S")}-{uuid4().hex[:6]}'
    folder.mkdir(parents=True)
    with accepted.harness.disposable(options.backend, folder) as (env, runtime, container):
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
        parents = ['phase1c3a', 'phase1c2b', 'phase1c2a', 'phase1c1', 'phase1b3_verification', 'phase1b3_static', 'phase1b2', 'phase1b1', 'phase1b']
        env = {k: v for k, v in env.items() if not k.startswith(('AUTH_', 'CSRF_', 'CORS_', 'SESSION_'))}
        env.update(
            DJANGO_SETTINGS_MODULE='pagination_settings',
            PYTHONIOENCODING='utf-8',
            PYTHONPATH=os.pathsep.join(map(str, [HERE, *(DOCS / name for name in parents), ROOT / 'backend'])),
            ROWSZEIN_SESSION_TEST_KEY=secrets.token_urlsafe(48),
            ROWSZEIN_RATE_TEST_KEY=secrets.token_urlsafe(48),
            ROWSZEIN_BROWSER_PASSWORD=secrets.token_urlsafe(40),
        )
        result = accepted.child(env, folder, mode, [str(HERE / 'browser.py'), mode])
    (folder / 'summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    return result['exit_code']


if __name__ == '__main__':
    sys.exit(main())
