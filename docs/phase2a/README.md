# Phase 2A local verification

Run from the repository root with the existing virtual environment, installed Node dependencies, Edge/Playwright, and the cached local PostgreSQL image.

```powershell
backend/.venv/Scripts/python.exe -B docs/phase2a/run_browser.py after --backend postgres
backend/.venv/Scripts/python.exe -B docs/phase2a/run_static.py
```

The browser runner reuses the approved migration hash checks and the disposable database harness. It binds both web servers to loopback, rejects external browser requests, and removes the fixture database and its servers at exit. The screenshots use synthetic test transactions created through the existing sales API and a fixed owner browser clock. The staff screenshot uses the actual current Manila day. For the baseline, run `run_browser.py before` with the frontend source from `6b30b27`.

See [the Phase 2A report](../PHASE2A_UI_UX_FOUNDATION_REPORT.md) for the selected captures and results.
