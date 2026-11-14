"""Run the backend tests against a throwaway PostgreSQL in Docker.

    python scripts/test_postgres.py            # the whole suite
    python scripts/test_postgres.py sales      # only some apps or tests

The script creates the database itself (random name, password and loopback port), so the guard in
backend/test_settings.py can trust it is disposable, and it always removes the container afterwards.
Nothing here reads backend/.env or connects to any other database.
"""
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable

IMAGE = "postgres:17-alpine"
BACKEND = Path(__file__).resolve().parents[1] / "backend"
NO_DOCKER = "Docker isn't running. Start Docker Desktop, then try again."

# Called as a program so "test" never appears in sys.argv: test_settings refuses `manage.py test` on PostgreSQL.
RUN_TESTS = """
import sys, django
from django.conf import settings
django.setup()
from django.test.utils import get_runner
sys.exit(bool(get_runner(settings)(verbosity=2).run_tests(sys.argv[1:])))
"""


def new_identity() -> tuple[str, str]:
    """A database name the test settings accept, and a password for it."""
    return f"rowszein_phase1a_{secrets.token_hex(16)}", secrets.token_urlsafe(24)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_environment(db_name: str, port: int, password: str) -> dict[str, str]:
    return {
        **os.environ,
        "ROWSZEIN_TEST_POSTGRES": "1",
        "ROWSZEIN_TEST_DB_NAME": db_name,
        "ROWSZEIN_TEST_DB_PORT": str(port),
        "ROWSZEIN_TEST_DB_PASSWORD": password,
        "DJANGO_SETTINGS_MODULE": "backend.test_settings",
    }


def wait_until_ready(probe: Callable[[], bool], timeout: float = 60, interval: float = 1) -> None:
    deadline = time.monotonic() + timeout
    while not probe():
        if time.monotonic() >= deadline:
            raise RuntimeError(f"PostgreSQL didn't start within {timeout:g} seconds.")
        time.sleep(interval)


def backend_python() -> Path:
    """The backend virtualenv's Python on a developer PC; the current Python in CI."""
    for candidate in (BACKEND / ".venv" / "Scripts" / "python.exe", BACKEND / ".venv" / "bin" / "python"):
        if candidate.exists():
            return candidate
    return Path(sys.executable)


def docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    return subprocess.run(["docker", "info"], capture_output=True, text=True).returncode == 0


def database_ready(container: str, db_name: str, port: int) -> bool:
    check = subprocess.run(["docker", "exec", container, "pg_isready", "-U", "postgres", "-d", db_name],
                           capture_output=True, text=True)
    if check.returncode != 0:
        return False
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def run_tests(labels: list[str], env: dict[str, str]) -> int:
    return subprocess.run([str(backend_python()), "-c", RUN_TESTS, *labels], cwd=BACKEND, env=env).returncode


def main(argv: list[str]) -> int:
    if not docker_available():
        print(NO_DOCKER)
        return 2
    db_name, password = new_identity()
    port = free_port()
    container = f"rowszein-test-{db_name.rsplit('_', 1)[1]}"
    started = subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", container,
         "-e", f"POSTGRES_PASSWORD={password}", "-e", f"POSTGRES_DB={db_name}",
         "-p", f"127.0.0.1:{port}:5432", IMAGE],
        capture_output=True, text=True,
    )
    if started.returncode != 0:
        print(f"Couldn't start the test database: {started.stderr.strip()}")
        return 2
    try:
        print(f"Throwaway PostgreSQL {container} on 127.0.0.1:{port}")
        wait_until_ready(lambda: database_ready(container, db_name, port))
        return run_tests(argv, test_environment(db_name, port, password))
    finally:
        subprocess.run(["docker", "stop", container], capture_output=True, text=True)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
