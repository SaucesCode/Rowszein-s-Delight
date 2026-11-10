# Package 1B.2 verification

[Required report](../PHASE1B2_RBAC_IMPLEMENTATION_REPORT.md) · [Selected actual outcomes](verification-summary.json)

Run from the repository root using the existing backend environment and locally cached PostgreSQL 17 image. Commands use the owner's Package 1B.2 disposable testing authorization only; they never authorize production access, new migrations, deployment or 1B.3 implementation.

```powershell
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/run_checks.py --backend postgres --scope all
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/run_checks.py --backend sqlite --scope all
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/run_checks.py --backend postgres --scope browser
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/run_frontend.py
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/static_review.py
.\backend\.venv\Scripts\python.exe -B docs/phase1b2/summarize_results.py
```

`all` returns exit 1 while the three original revocation/throttle requirements remain failing. Role, CSRF, business and new RBAC suites must otherwise pass; SQLite skips the 17 existing and four new PostgreSQL lock/concurrency cases. `before` reproduces the original role requirements and means pre-implementation only when run on baseline source. `security` runs the original security and unchanged 26 CSRF contracts. Full frontend lint still fails on existing findings.

Each invocation creates fresh timestamp/UUID evidence. The existing Phase 1A.3 harness owns/validates/removes its loopback targets; existing migrations are applied only there. Package wrappers set no production credentials and never discover project dotenv. The inherited safety marker retains its original profile label, while metadata records this package separately. New result capture never writes into previous evidence directories.

Browser testing uses the webapp-testing skill's headless Playwright approach and the previously reviewed custom lifecycle for hidden Windows processes, exclusive ports, generated fixture credentials, external blocking and process-tree cleanup. Only minimal synthetic verification fixtures are created; this is not Phase 2 demo generation. Browser traces must never capture login bodies, JWTs or CSRF tokens.

The summarizer selects only completed qualifying runs, preserves deferred failures and lists unsuccessful attempts. Static review confirms protected files, unchanged test assertions except three explicit fixture roles, exact frontend/backend capability agreement and core CSRF preservation. Do not run old evidence-overwriting audit scripts.

Package 1B.2 ends with owner review. Session persistence, revocation and shared rate-limit infrastructure require the next exact design/approval checkpoint.
