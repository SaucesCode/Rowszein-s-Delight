# Phase 1C.3A verification

Run from the repository root with the existing Python virtual environment, Node dependencies, cached local PostgreSQL image, and Playwright with headless Edge. The accepted harness checks the database target and migration hashes before use. Browser runs use loopback ports 18841 and 18842 and run serially.

```powershell
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_checks.py --backend postgres --scope api
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_checks.py --backend sqlite --scope api
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_checks.py --backend postgres --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_checks.py --backend sqlite --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_checks.py --backend postgres --scope browser
backend/.venv/Scripts/python.exe -B docs/phase1c3a/run_frontend.py
```

The `before-api` and `before-browser` scopes were run against the application source at `3934b74` while preparing the desired-behavior tests. The original F03 helper probe is `docs/phase1c1/date_probes.mjs`, run with `TZ=Asia/Manila`. Baseline runs intentionally return a failure status when an assertion reproduces a defect. The browser clock is set per scenario while the API authenticates and reads real disposable data.

See [the report](../PHASE1C3A_MANILA_DATE_REPAIR_REPORT.md) for the exact evidence runs and the API contract.
