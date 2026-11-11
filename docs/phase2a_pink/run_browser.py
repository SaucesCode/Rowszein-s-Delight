"""Verify UI on a disposable PostgreSQL schema copy, without running migrations."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from uuid import uuid4


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / 'docs'
sys.path.insert(0, str(DOCS / 'phase1c3a'))
from run_checks import accepted  # noqa: E402

DOCKER = ['docker', '--context', 'desktop-linux']
SOURCE = 'rowszein-playground'
SOURCE_DB = 'rowszein_dev'
SOURCE_ROLE = 'rowszein_dev_app'


def local_docker(*args, input_bytes=None):
    result = subprocess.run(DOCKER + list(args), input=input_bytes, capture_output=True)
    if result.returncode:
        # The commands below contain neither passwords nor business-row data.
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.stdout


def copy_schema(container, target):
    assert local_docker('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}').strip() == (
        b'npipe:////./pipe/dockerDesktopLinuxEngine'
    )
    source = json.loads(local_docker('inspect', SOURCE))[0]
    assert source['Name'] == '/' + SOURCE and source['State']['Running']
    assert source['HostConfig']['PortBindings'] == {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '55433'}]}
    assert [mount['Name'] for mount in source['Mounts']] == [
        'f98386e3600d68234f9e7fc85af0bf5ed417e72bc3427ac249f9267e6f753327'
    ]
    assert container != source['Id']
    identity = local_docker('exec', SOURCE, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', SOURCE_ROLE, '-d', SOURCE_DB,
                            '-c', "SELECT current_database(), current_user, count(*) FROM django_migrations")
    assert identity.strip() == b'rowszein_dev|rowszein_dev_app|35'
    base = ['exec', SOURCE, 'pg_dump', '-U', SOURCE_ROLE, '-d', SOURCE_DB, '--no-owner', '--no-privileges']
    schema = local_docker(*base, '--schema-only', '--schema=public')
    metadata = local_docker(*base, '--data-only', '--table=public.django_migrations',
                            '--table=public.django_content_type', '--table=public.auth_permission')
    assert b'COPY public.accounts_user' not in schema + metadata
    assert b'COPY public.sales_sale' not in schema + metadata
    assert b'CREATE TRIGGER accounts_device_guard' in schema
    # A fresh PostgreSQL database already has its empty public schema.
    schema = schema.replace(b'CREATE SCHEMA public;', b'CREATE SCHEMA IF NOT EXISTS public;', 1)
    restore = ['exec', '-i', container, 'psql', '-Xq', '-v', 'ON_ERROR_STOP=1', '-U', target['user'], '-d', target['name']]
    local_docker(*restore, input_bytes=schema)
    local_docker(*restore, input_bytes=metadata)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['before', 'after'])
    mode = parser.parse_args().mode
    hashes = accepted.approved_hashes()
    folder = HERE / 'evidence' / f'{mode}-{time.strftime("%Y%m%d-%H%M%S")}-{uuid4().hex[:6]}'
    folder.mkdir(parents=True)
    with accepted.harness.disposable('postgres', folder) as (env, runtime, container):
        marker = runtime / 'target.json'
        target = json.loads(marker.read_text())
        assert container and target['container_id'] == container and target['port'] != 55433
        host_config = json.loads(local_docker('inspect', container))[0]['HostConfig']
        assert not host_config.get('Binds') and set(host_config.get('Tmpfs', {})) == {'/var/lib/postgresql/data'}
        copy_schema(container, target)
        target.update(
            session_security_authorization='Phase 1B.3 disposable verification of 30a9a61',
            session_migration_hashes=hashes,
            corrected_migration_owner_approval='2026-11-10 exact SQLite literal fix',
            functional_audit_authorization='Phase 1C.1 synthetic isolated verification of fdd46a3',
            cache_repair_authorization='Phase 1C.2A verification based on b990398',
            pagination_authorization='Phase 1C.2B based on 98e29bf',
            pink_schema_copy=True,
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
        (folder / 'schema-copy.json').write_text(json.dumps({
            'source': SOURCE_DB, 'source_scope': 'schema and three framework metadata tables',
            'application_rows_copied': 0, 'migrations_executed': 0, 'test_target': target['name'],
        }, indent=2), encoding='utf-8')
        result = accepted.child(env, folder, mode, [str(HERE / 'browser.py'), mode])
    (folder / 'summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    return result['exit_code']


if __name__ == '__main__':
    sys.exit(main())
