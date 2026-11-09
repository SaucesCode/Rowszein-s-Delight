"""Run GREEN design experiments and RED current-API requirements separately.

Existing migrations only, on isolated databases. This does not implement or
apply proposed schema changes. --postgres uses a disposable local container.
"""
import argparse
from contextlib import contextmanager
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

root = Path(__file__).resolve().parents[2]
evidence = root / "docs/phase1a2/evidence"
evidence.mkdir(exist_ok=True)


@contextmanager
def database(postgres):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH=str(root / "docs/phase1a2"))
    for key in list(env):
        if key.startswith("ROWSZEIN_TEST_"):
            del env[key]
    if not postgres:
        yield env
        return
    import psycopg2

    docker = [shutil.which("docker") or "docker", "--context", "desktop-linux"]

    def command(*args, **kwargs):
        return subprocess.check_output(docker + list(args), text=True, **kwargs).strip()

    if command("context", "inspect", "desktop-linux", "--format", "{{.Endpoints.docker.Host}}") != "npipe:////./pipe/dockerDesktopLinuxEngine":
        raise RuntimeError("Refusing nonlocal Docker context")
    identity = uuid.uuid4().hex
    db_name = "rowszein_phase1a_" + identity
    password = secrets.token_urlsafe(48)
    container = None
    try:
        image_id = command("image", "inspect", "postgres:17-alpine", "--format", "{{.Id}}")
        container = command("run", "--detach", "--rm", "--pull=never", "--name", "rowszein-phase1a2-" + identity,
                            "--label", "com.rowszein.purpose=phase1a2-tests", "--memory", "512m", "--cpus", "2",
                            "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,size=256m", "--publish", "127.0.0.1::5432",
                            "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB", "postgres:17-alpine",
                            env=dict(env, POSTGRES_PASSWORD=password, POSTGRES_DB=db_name))
        binding = command("port", container, "5432/tcp")
        if not re.fullmatch(r"127\.0\.0\.1:[0-9]+", binding):
            raise RuntimeError("Unexpected container port binding")
        port = binding.rsplit(":", 1)[1]
        deadline = time.monotonic() + 30
        while True:
            try:
                db = psycopg2.connect(host="127.0.0.1", port=port, dbname=db_name, user="postgres", password=password, connect_timeout=2)
                try:
                    with db.cursor() as cursor:
                        cursor.execute("SELECT version()")
                        version = cursor.fetchone()[0]
                finally:
                    db.close()
                break
            except psycopg2.OperationalError:
                if time.monotonic() > deadline:
                    raise RuntimeError("Test PostgreSQL startup timed out") from None
                time.sleep(0.25)
        (evidence / "postgres-environment.json").write_text(json.dumps({"version": version, "image_id": image_id,
            "existing_migrations_only": True, "new_schema_ddl": False, "production_connections": False,
            "experiment_adapter": "Existing Ingredient/Category fixture fields; no proposed model implementation"}, indent=2), encoding="utf-8")
        env.update(ROWSZEIN_TEST_POSTGRES="1", ROWSZEIN_TEST_DB_NAME=db_name, ROWSZEIN_TEST_DB_PORT=port, ROWSZEIN_TEST_DB_PASSWORD=password)
        yield env
    finally:
        if container:
            subprocess.run(docker + ["rm", "--force", container], check=True, stdout=subprocess.DEVNULL)
            print("Removed only the disposable Phase 1A.2 PostgreSQL container.", flush=True)


def run(env, name, labels):
    command = [sys.executable, "-B", "backend/manage.py", "test", *labels, "--settings=backend.test_settings", "--verbosity=2", "--noinput"]
    completed = subprocess.run(command, cwd=root, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    output = completed.stdout
    (evidence / f"{name}.txt").write_text(output, encoding="utf-8")
    count = re.search(r"Ran (\d+) tests? in", output)
    failures = re.search(r"failures=(\d+)", output)
    errors = re.search(r"errors=(\d+)", output)
    skipped = re.search(r"skipped=(\d+)", output)
    return {"exit_code": completed.returncode, "tests": int(count.group(1)) if count else 0,
            "failures": int(failures.group(1)) if failures else 0, "errors": int(errors.group(1)) if errors else 0,
            "skipped": int(skipped.group(1)) if skipped else 0, "log": f"{name}.txt"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--postgres", action="store_true")
    args = parser.parse_args()
    backend = "postgres" if args.postgres else "sqlite"
    with database(args.postgres) as test_env:
        green = run(test_env, backend + "-green", ["sales", "locking_contracts"])
        pending = run(test_env, backend + "-pending-api", ["pending_api_contracts"])
    result = {"backend": backend, "green_regressions_and_experiments": green, "red_current_api_requirements": pending,
              "current_api_inventory_release_ready": False, "new_migrations_created_or_applied": 0}
    (evidence / f"{backend}-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    # Unmet requirements remain failing, including the overall exit code.
    # Expected at this approval gate does not mean successful implementation.
    sys.exit(0 if green["exit_code"] == 0 and pending["exit_code"] == 0 else 1)
