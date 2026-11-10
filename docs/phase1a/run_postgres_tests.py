"""Run current-schema regressions in a disposable local PostgreSQL container.

No production settings, existing database, host data mount or persistent volume.
Requires the existing postgres:17-alpine image and Docker Desktop's local pipe.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time
import uuid

import psycopg2

root = Path(__file__).resolve().parents[2]
docker = shutil.which("docker")
if not docker:
    raise SystemExit("Docker is required for isolated PostgreSQL verification")
docker_args = [docker, "--context", "desktop-linux"]


def command(*args, **kwargs):
    return subprocess.check_output(docker_args + list(args), text=True, **kwargs).strip()


endpoint = command("context", "inspect", "desktop-linux", "--format", "{{.Endpoints.docker.Host}}")
if endpoint != "npipe:////./pipe/dockerDesktopLinuxEngine":
    raise SystemExit("Refusing a Docker context other than the expected local Docker Desktop pipe")

identity = uuid.uuid4().hex
db_name = "rowszein_phase1a_" + identity
container_name = "rowszein-phase1a-" + identity
password = secrets.token_urlsafe(48)
env = dict(os.environ, POSTGRES_PASSWORD=password, POSTGRES_DB=db_name)
container_id = None
try:
    image_id = command("image", "inspect", "postgres:17-alpine", "--format", "{{.Id}}")
    container_id = command(
        "run", "--detach", "--rm", "--pull=never", "--name", container_name,
        "--label", "com.rowszein.purpose=phase1a-tests", "--memory", "512m", "--cpus", "1",
        "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,size=256m",
        "--publish", "127.0.0.1::5432", "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB",
        "postgres:17-alpine", env=env,
    )
    port_mapping = command("port", container_id, "5432/tcp")
    if not port_mapping.startswith("127.0.0.1:") or "\n" in port_mapping:
        raise RuntimeError("Unexpected test container port binding")
    port = int(port_mapping.rsplit(":", 1)[1])
    deadline = time.monotonic() + 30
    while True:
        try:
            connection = psycopg2.connect(host="127.0.0.1", port=port, dbname=db_name, user="postgres", password=password, connect_timeout=2)
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT version()")
                    version = cursor.fetchone()[0]
            finally:
                connection.close()
            break
        except psycopg2.OperationalError:
            if time.monotonic() > deadline:
                raise RuntimeError("Disposable PostgreSQL startup timed out") from None
            time.sleep(0.25)
    metadata = {
        "version": version, "image_id": image_id, "host": "127.0.0.1",
        "persistent_volumes": False, "production_connections": False,
        "scope": "Current-schema validation and transaction rollback tests; concurrency not yet verified",
    }
    (root / "docs/phase1a/evidence/postgres-environment.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2), flush=True)
    test_env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", ROWSZEIN_TEST_POSTGRES="1",
                    ROWSZEIN_TEST_DB_NAME=db_name, ROWSZEIN_TEST_DB_PORT=str(port),
                    ROWSZEIN_TEST_DB_PASSWORD=password)
    result = subprocess.run(
        [sys.executable, "-B", "backend/manage.py", "test", "sales", "--settings=backend.test_settings", "--verbosity=2", "--noinput"],
        cwd=root, env=test_env,
    )
    sys.exit(result.returncode)
finally:
    if container_id:
        subprocess.run(docker_args + ["rm", "--force", container_id], check=True, stdout=subprocess.DEVNULL)
        print("Removed only the disposable Phase 1A test container and its in-memory database.", flush=True)
