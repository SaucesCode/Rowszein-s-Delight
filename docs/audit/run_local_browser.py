"""Windows-aware local audit lifecycle. Refuses to reuse occupied ports."""
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
os.chdir(root)
env = dict(os.environ, AUDIT_PASSWORD=secrets.token_urlsafe(48), PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1")
servers = []
logs = []
try:
    commands = [
        (18732, [sys.executable, "docs/audit/serve_local_audit.py"], "backend-local-server.txt"),
        (18731, [shutil.which("node"), str(root / "frontend/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "18731", "--strictPort"], "frontend-dev-server.txt"),
    ]
    for port, command, log_name in commands:
        with socket.socket() as sock:
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Audit port {port} is occupied; no existing process will be reused.")
        log = (root / "docs/audit/evidence" / log_name).open("w", encoding="utf-8")
        logs.append(log)
        process = subprocess.Popen(command, cwd=root / "frontend" if port == 18731 else root,
                                   env=env, stdout=log, stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        # Vite command runs from root; use absolute CLI path to preserve frontend cwd.
        servers.append(process)
        deadline = time.monotonic() + 30
        while True:
            if process.poll() is not None:
                raise RuntimeError(f"Local server {port} exited; inspect {log_name}.")
            with socket.socket() as sock:
                sock.settimeout(1)
                if sock.connect_ex(("127.0.0.1", port)) == 0:
                    break
            if time.monotonic() > deadline:
                raise RuntimeError(f"Local server {port} startup timeout.")
            time.sleep(0.2)
    sys.exit(subprocess.call([sys.executable, "docs/audit/run_browser_audit.py"], env=env))
finally:
    for process in reversed(servers):
        if process.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                process.terminate()
            process.wait(timeout=10)
    for log in logs:
        log.close()
