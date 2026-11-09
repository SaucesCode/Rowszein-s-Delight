"""Own, verify, exercise and remove ONLY uniquely named disposable databases."""
import argparse
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.verification-runtime'
EVIDENCE = ROOT / 'docs/phase1a3_verification/evidence'
DOCKER = [shutil.which('docker') or 'docker', '--context', 'desktop-linux']


def clean_environment():
    env, removed = {}, []
    for key, value in os.environ.items():
        if key.upper().startswith(('DB_', 'DATABASE', 'PG', 'POSTGRES', 'ROWSZEIN_TEST_', 'ROWSZEIN_VERIFY_')) or key in {'SECRET_KEY', 'DJANGO_SETTINGS_MODULE', 'PYTHONPATH'}:
            removed.append(key)
        else:
            env[key] = value
    env.update(PYTHONDONTWRITEBYTECODE='1', PYTHONUNBUFFERED='1',
               DJANGO_SETTINGS_MODULE='backend.disposable_verification_settings',
               PYTHONPATH=str(ROOT/'backend') + os.pathsep + str(Path(__file__).resolve().parent))
    return env, removed


def docker(*args, env=None):
    return subprocess.check_output(DOCKER + list(args), env=env, text=True).strip()


@contextmanager
def disposable(backend, folder):
    identity, token, password = uuid.uuid4().hex, secrets.token_urlsafe(48), secrets.token_urlsafe(48)
    RUNTIME.mkdir(exist_ok=True)
    runtime = RUNTIME / identity
    runtime.mkdir()
    assert runtime.resolve().parent == RUNTIME.resolve() and re.fullmatch('[0-9a-f]{32}', runtime.name)
    env, removed = clean_environment()
    target = {'identity': identity, 'backend': backend, 'authorization': 'Phase 1A.3 disposable verification only',
              'token_hash': sha256(token.encode()).hexdigest(), 'production_connections': False}
    container = None
    try:
        if backend == 'postgres':
            if docker('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}') != 'npipe:////./pipe/dockerDesktopLinuxEngine':
                raise RuntimeError('Refusing nonlocal Docker engine')
            image = docker('image', 'inspect', 'postgres:17-alpine', '--format', '{{.Id}}')
            name, user = 'rowszein_verify_' + identity, 'verify_' + identity
            container = docker('run', '--detach', '--rm', '--pull=never', '--name', 'rowszein-verify-' + identity,
                '--label', 'com.rowszein.purpose=phase1a3-verification', '--label', 'com.rowszein.identity=' + identity,
                '--memory', '768m', '--cpus', '2', '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=384m',
                '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_USER', '--env', 'POSTGRES_DB',
                'postgres:17-alpine', env=dict(env, POSTGRES_PASSWORD=password, POSTGRES_USER=user, POSTGRES_DB=name))
            info = json.loads(docker('inspect', container))[0]  # Never write Env/credentials.
            bindings = info['HostConfig']['PortBindings']['5432/tcp']
            if info['Config']['Labels'].get('com.rowszein.identity') != identity or any(binding['HostIp'] != '127.0.0.1' for binding in bindings):
                raise RuntimeError('Container ownership/network check failed')
            if any(mount['Type'] != 'tmpfs' for mount in info['Mounts']):
                raise RuntimeError('Persistent/bind volume refused')
            binding = docker('port', container, '5432/tcp')
            if not re.fullmatch(r'127\.0\.0\.1:[0-9]+', binding):
                raise RuntimeError('Non-loopback PostgreSQL publication refused')
            port = int(binding.rsplit(':', 1)[1])
            import psycopg2
            deadline = time.monotonic() + 45
            while True:
                try:
                    db = psycopg2.connect(host='127.0.0.1', port=port, dbname=name, user=user, password=password, connect_timeout=2)
                    break
                except psycopg2.OperationalError:
                    if time.monotonic() > deadline:
                        raise RuntimeError('Disposable PostgreSQL startup timed out') from None
                    time.sleep(.25)
            with db:
                with db.cursor() as cursor:
                    cursor.execute('SELECT current_database(), current_user, version()')
                    actual_name, actual_user, version = cursor.fetchone()
                    if (actual_name, actual_user) != (name, user) or not version.startswith('PostgreSQL 17.'):
                        raise RuntimeError('PostgreSQL ownership/version mismatch')
                    cursor.execute('SHOW transaction_isolation')
                    isolation = cursor.fetchone()[0]
                    cursor.execute('SHOW timezone')
                    server_timezone = cursor.fetchone()[0]
            db.close()
            target.update(name=name, user=user, host='127.0.0.1', port=port, docker_verified=True,
                          container_id=container, image=image, version=version, isolation=isolation,
                          server_timezone=server_timezone, mounts=[{'type': m['Type'], 'destination': m['Destination']} for m in info['Mounts']])
            env['ROWSZEIN_VERIFY_PASSWORD'] = password
        else:
            path = runtime / 'isolated.sqlite3'
            path.touch(exist_ok=False)
            target.update(name=str(path.resolve()), ownership='new exclusive runtime file')
        marker = runtime / 'target.json'
        marker.write_text(json.dumps(target), encoding='utf-8')
        env.update(ROWSZEIN_VERIFY_MARKER=str(marker.resolve()), ROWSZEIN_VERIFY_TOKEN=token)
        public = {k: v for k, v in target.items() if k != 'token_hash'}
        public.update(scrubbed_environment_variable_names=removed, project_dotenv_loading=False,
            settings='backend.disposable_verification_settings', python=sys.version,
            migration_sha256={str(path.relative_to(ROOT)).replace('\\', '/'): sha256(path.read_bytes()).hexdigest() for path in [
                ROOT/'backend/ingredients/migrations/0004_inventory_integrity.py', ROOT/'backend/sales/migrations/0003_inventory_integrity.py']})
        (folder/'environment.json').write_text(json.dumps(public, indent=2), encoding='utf-8')
        print(f'Verified disposable {backend} target; ownership recorded, credentials excluded.', flush=True)
        yield env, runtime, container
    finally:
        if container:
            if docker('inspect', container, '--format', '{{index .Config.Labels "com.rowszein.identity"}}') != identity:
                raise RuntimeError('Refusing cleanup: container ownership changed')
            docker('rm', '--force', container)
        resolved = runtime.resolve()
        if resolved.parent != RUNTIME.resolve() or not re.fullmatch('[0-9a-f]{32}', resolved.name):
            raise RuntimeError('Refusing runtime cleanup outside owned target')
        shutil.rmtree(resolved)
        (folder/'cleanup.json').write_text(json.dumps({'runtime_removed': not resolved.exists(), 'owned_container_removed': bool(container), 'production_access': False}), encoding='utf-8')


def run(env, folder, name, labels):
    output = folder/(name + '.json')
    child_env = dict(env, ROWSZEIN_VERIFY_RESULTS=str(output.resolve()))
    command = [sys.executable, '-B', str(ROOT/'backend/manage.py'), 'test', *labels,
        '--settings=backend.disposable_verification_settings', '--testrunner=backend.verification_runner.VerificationRunner', '--verbosity=2', '--noinput']
    result = subprocess.run(command, cwd=ROOT, env=child_env, capture_output=True, text=True)
    log = result.stdout + result.stderr
    for key in ['ROWSZEIN_VERIFY_TOKEN', 'ROWSZEIN_VERIFY_PASSWORD']:
        if child_env.get(key): log = log.replace(child_env[key], '[REDACTED]')
    (folder/(name + '.txt')).write_text(log, encoding='utf-8')
    summary = json.loads(output.read_text()) if output.exists() else {'tests_run': 0, 'runner_error': True}
    small = {k: v for k, v in summary.items() if k != 'outcomes'}
    small.update(exit_code=result.returncode)
    print(name + ': ' + json.dumps(small), flush=True)
    return small


def run_worker(env, folder, name, script):
    child_env = dict(env, ROWSZEIN_VERIFY_RESULTS=str((folder/(name + '.json')).resolve()))
    result = subprocess.run([sys.executable, '-B', str(Path(__file__).resolve().parent/script)], cwd=ROOT, env=child_env, capture_output=True, text=True)
    log = result.stdout + result.stderr
    for key in ['ROWSZEIN_VERIFY_TOKEN', 'ROWSZEIN_VERIFY_PASSWORD']:
        if child_env.get(key): log = log.replace(child_env[key], '[REDACTED]')
    (folder/(name + '.txt')).write_text(log, encoding='utf-8')
    print(name + ': exit ' + str(result.returncode), flush=True)
    return {'exit_code': result.returncode, 'result_file': name + '.json'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend', choices=['sqlite', 'postgres'], required=True)
    parser.add_argument('--scope', choices=['baseline', 'extended', 'migration', 'browser', 'concurrency', 'precision', 'protection', 'all'], default='all')
    parser.add_argument('--repeat', type=int, default=1)
    args = parser.parse_args()
    if args.scope == 'concurrency' and args.backend != 'postgres':
        parser.error('Concurrency evidence requires PostgreSQL')
    if not 1 <= args.repeat <= 10:
        parser.error('Use 1..10 bounded repetitions')
    run_id = time.strftime('%Y%m%d-%H%M%S') + '-' + args.backend + '-' + uuid.uuid4().hex[:8]
    folder = EVIDENCE / run_id
    folder.mkdir(parents=True)
    results = {}
    with disposable(args.backend, folder) as (env, runtime, container):
        if args.scope in ['baseline', 'all']:
            results['release_blockers'] = run(env, folder, 'release-blockers', ['sales.test_release_blockers'])
            results['defined_api_concurrency'] = run(env, folder, 'defined-api-concurrency', ['sales.tests'])
            results['pure_metadata'] = run(env, folder, 'pure-metadata', ['sales.test_inventory_math', 'sales.test_approved_math', 'sales.test_schema_contracts'])
            results['storage_precision'] = run(env, folder, 'storage-precision', ['sales.test_storage_precision'])
        if args.scope in ['extended', 'all']:
            results['phase1a1_compatibility'] = run(env, folder, 'phase1a1-compatibility', ['sales.test_phase1a1_compat'])
            results['extended'] = run(env, folder, 'extended', ['sales.test_verification_extended'])
        if args.scope in ['migration', 'all']:
            results['migration'] = run_worker(env, folder, 'migration-upgrade-backup', 'migration_verification.py')
        if args.scope == 'browser':
            results['browser'] = run_worker(env, folder, 'browser', 'browser_verification.py')
        if args.scope == 'precision':
            results['precision'] = run(env, folder, 'precision', ['sales.test_verification_extended.ExtendedIntegrityTests.test_initial_quantity_is_exact_or_rejected_before_storage', 'sales.test_verification_extended.ExtendedIntegrityTests.test_adjustment_result_is_exact_or_rejected_before_storage'])
        if args.scope == 'protection':
            results['protection'] = run(env, folder, 'protection', ['sales.test_verification_extended.ExtendedIntegrityTests.test_protected_history_and_immutable_quantities'])
        if args.scope == 'concurrency':
            labels = ['sales.tests.SalesConcurrencyTests', 'sales.test_verification_extended.ExtendedConcurrencyTests',
                'sales.test_release_blockers.ReleaseBlockerContracts.test_competing_sales_only_one_can_consume_last_stock',
                'sales.test_release_blockers.ReleaseBlockerContracts.test_concurrent_duplicate_request_creates_only_one_sale',
                'sales.test_release_blockers.ReleaseBlockerContracts.test_concurrent_stale_sale_edits_reject_second_revision']
            for number in range(args.repeat):
                results[f'concurrency_{number+1}'] = run(env, folder, f'concurrency-{number+1}', labels)
    if args.scope in ['migration', 'all']:
        invalid_folder = folder/'invalid-legacy-target'
        invalid_folder.mkdir()
        with disposable(args.backend, invalid_folder) as (env, runtime, container):
            results['invalid_fixture'] = run_worker(env, invalid_folder, 'invalid-fixture', 'invalid_fixture.py')
    (folder/'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    sys.exit(0 if all(result['exit_code'] == 0 for result in results.values()) else 1)
