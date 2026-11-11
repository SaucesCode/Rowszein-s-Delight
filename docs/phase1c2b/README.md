# Phase 1C.2B verification

See [the repair report](../PHASE1C2B_PAGINATION_LOOKUP_REPAIR_REPORT.md) and
[the API contract](API_CONTRACT.md). Run from repository root with the existing
virtualenv, cached local PostgreSQL image and headless Edge/Playwright.

```powershell
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend postgres --scope api
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend sqlite --scope api
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend postgres --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend sqlite --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend postgres --scope browser --count 20
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend postgres --scope browser --count 21
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_checks.py --backend postgres --scope browser --count 25
backend/.venv/Scripts/python.exe -B docs/phase1c2b/run_frontend.py
```

Browser runs share fixed loopback test ports and must run serially. The `before`
scope is only for the unchanged `98e29bf` application and count 25; it records
the three expected failing requirements separately from harness completion.
No wrapper falls back to project database settings. All fixture data is owned,
synthetic and disposable. Only accepted migrations run; no migrations were
created or changed. Raw earlier attempts and output whitespace are retained.
`summarize.py` verifies historical evidence and compacts results after cleanup.
