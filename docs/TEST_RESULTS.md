# Phase 0 verification results

Subsequent work: [Phase 1A package 1A.1 results](PHASE1A_PROGRESS.md) reports **18/18 correctness regressions on SQLite and PostgreSQL 17.11**, a passing frontend build, and the schema approval checkpoint. The Phase 0 results below and `docs/audit/evidence/` remain the original baseline; the original defect probes are not the current correctness suite.

Run date: 2026-11-09. Baseline commit `78ee4a0`; no application fixes applied. OS Windows; Node 24.21.0; npm 12.0.2; Python 3.12.14. Declared application dependencies were installed without changing requirements or lockfile. Python audit tooling additionally includes pip-audit and Playwright; it is isolated from application requirements.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Existing Django tests | No executable tests; 0 ran | [existing-tests.txt](audit/evidence/existing-tests.txt) |
| Backend audit probes | 22/22 assertions passed; 0.812s test-body time | [backend-probes.txt](audit/evidence/backend-probes.txt) |
| Frontend date probes | Both existing local-date defects reproduced | [frontend-probes.json](audit/evidence/frontend-probes.json) |
| Model/migration drift | No changes detected | [migration-drift.txt](audit/evidence/migration-drift.txt) |
| Deployment configuration check | 2 warnings: W004 missing HSTS, W008 no HTTPS redirect | [django-deploy-check.txt](audit/evidence/django-deploy-check.txt) |
| Frontend production build | Pass; CSS import-order and >500kB chunk warnings | [frontend-build.txt](audit/evidence/frontend-build.txt) |
| Frontend lint | Fail: 13 errors, 16 warnings | [frontend-lint.txt](audit/evidence/frontend-lint.txt) |
| Browser local smoke/audit | Completed, 10 screenshots, no uncaught JS errors; expected anonymous auth/me 401 | [browser-results.json](audit/evidence/browser-results.json), [browser-run.txt](audit/evidence/browser-run.txt) |
| Runtime configuration | Plain StaticFilesStorage; no atomic requests or throttle classes | [configuration-probes.txt](audit/evidence/configuration-probes.txt) |
| Contrast calculations | White/brand pink 2.58:1; white/primary endpoint 3.53:1; muted/card 2.45:1 | [contrast-probes.txt](audit/evidence/contrast-probes.txt) |
| npm security/version metadata | 37 vulnerable package entries; 29 outdated direct packages | [npm-audit.json](audit/evidence/npm-audit.json), [npm-outdated.json](audit/evidence/npm-outdated.json) |
| Python pinned-direct advisory scan | 112 advisory entries across 7 packages; excludes transitive packages | [pip-audit.json](audit/evidence/pip-audit.json), [scan status](audit/evidence/pip-audit-status.txt) |
| Python outdated environment | 14 declared application packages outdated; JSON also includes audit tooling | [pip-outdated-environment.json](audit/evidence/pip-outdated-environment.json) |

**Interpretation:** the backend probes intentionally assert *current defective behavior*. Their green result establishes reproduction, not stability or readiness. Four baseline probes verify normal sale math/deduction, recipe batch/yield cost, API negative-cost rejection and anonymous denial. Seventeen defect probes cover validation-order stock inflation, overselling/restoration, changed/deleted recipes, duplicate operations, missing transaction rollback, ORM negative costs, missing CSRF for PATCH and form POST, staff permissions, protected deletion, missing-recipe/unavailable sales, ignored public filtering, multi-year charts, fractional stock loss and historical subtotal migration. One query probe measures margin query growth (4→9).

## Reproduce safely

From the repository root in PowerShell, using an isolated Python 3.12 environment. The audit-created environment is retained locally under ignored `backend/.venv` for convenience. If recreating it, install `backend/requirements.txt` and audit-only `pip-audit playwright` there. Do not use production credentials or a production database.

```powershell
$auditPython = '.\backend\.venv\Scripts\python.exe'
& $auditPython docs/audit/run_backend_audit.py
node docs/audit/run_frontend_probes.mjs

$env:PYTHONPATH = Join-Path (Get-Location) 'docs/audit'
$env:DJANGO_SETTINGS_MODULE = 'audit_settings'
& $auditPython backend/manage.py makemigrations --check --dry-run
& $auditPython backend/manage.py check --deploy
& $auditPython backend/manage.py test
```

`audit_settings.py` overrides environment values with a dummy key and an in-memory SQLite database before importing project settings. The audit settings never select a real database. The MD5 password hasher is restricted to the local audit settings for test speed; never use this settings module for normal development or deployment.

Frontend commands (from `frontend/`):

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run lint
npm audit --json
npm outdated --json
```

Security metadata requires network access; audit/outdated commands can exit nonzero when findings exist. `--ignore-scripts` was used for dependency installation; the actual TypeScript/Vite build passed afterward. No `npm audit fix`, dependency update, deployment or production migration was run.

Optional browser rerun from root:

```powershell
& $auditPython docs/audit/run_local_browser.py
```

Requires installed Microsoft Edge (headless `channel="msedge"`) and permission to use loopback/processes. The runner refuses occupied audit ports 18731/18732, creates a random per-run in-memory local account, starts Vite and the fixture Django server, and terminates its own process trees afterward. Browser `/api` requests are forwarded to the real local backend on 18732 through Playwright route.fetch, **not mocked**; this tests app/API behavior but not the repository's Vite/Vercel proxy settings. External browser requests are blocked. Fixtures disappear on process exit. The runner overwrites evidence on rerun.

The generic skill server helper was attempted first, but sandbox loopback restrictions and Windows child-process/occupied-port behavior required this dedicated runner. Those initial attempts are not application failures; final evidence is from the successful dedicated-port run.

## Screenshots reviewed

1440×1000 desktop and 390×844 mobile, full-page captures. No sales/expenses were seeded for the browser, so the zero dashboard is an empty-state baseline. The 25-record catalog exposes data-access failures without requiring production data.

- [Storefront desktop](audit/evidence/storefront-desktop.png) and [mobile](audit/evidence/storefront-mobile.png)
- [Dashboard desktop](audit/evidence/dashboard-desktop.png) and [mobile](audit/evidence/dashboard-mobile.png)
- [Recipe form desktop](audit/evidence/recipe-form-desktop.png) and [mobile](audit/evidence/recipe-form-mobile.png)
- [Sale form mobile](audit/evidence/sale-form-mobile.png)
- [Inventory desktop](audit/evidence/ingredients-desktop.png) and [search missing item 25](audit/evidence/ingredients-page-search.png)
- [Login mobile](audit/evidence/login-mobile.png)

Measured browser outcomes: product 25 absent from storefront; recipe product/ingredient selectors each 21 options including placeholder; ingredient 25 absent in page-1 search; login inputs unlabelled; sale product selector 42px at 390px viewport; no page-level overflow in sampled storefront/sale pages; local login 200. One cold dev navigation ~3000ms is not a production performance metric.

## Limits and outstanding checks

No PostgreSQL concurrency/locking test, production dataset reconciliation, real deployment verification, authenticated production browser session, exhaustive CRUD E2E, export rendering/CSV execution, automated axe/screen-reader audit, tablet/zoom matrix, Lighthouse/Core Web Vitals, load test, backup/restore rehearsal or Git-history secret scan. Do not interpret fresh SQLite migration success as proof that all PostgreSQL or historical upgrade paths are safe. No before/after improvement claims apply because fixes are awaiting approval.
