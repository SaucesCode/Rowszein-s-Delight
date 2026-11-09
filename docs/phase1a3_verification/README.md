# Disposable Phase 1A.3 verification

These commands require the owner's already-granted disposable migration/testing authorization. They never authorize production operations. Run from the repository root with the existing isolated backend Python environment and cached local PostgreSQL 17 image. Docker Desktop must be locally available; restricted hosts may require approval for local Docker/loopback access.

```powershell
$verificationPython = '.\backend\.venv\Scripts\python.exe'
& $verificationPython -B docs/phase1a3_verification/run_verification.py --backend sqlite --scope all
& $verificationPython -B docs/phase1a3_verification/run_verification.py --backend postgres --scope all
& $verificationPython -B docs/phase1a3_verification/run_verification.py --backend postgres --scope concurrency --repeat 5
& $verificationPython -B docs/phase1a3_verification/run_verification.py --backend postgres --scope browser
& $verificationPython -B docs/phase1a3_verification/summarize_results.py
& $verificationPython -B docs/phase1a3_verification/final_source_review.py
node docs/phase1a3/test_stock_preview.mjs
node docs/phase1a3_verification/test_operation_identity.mjs
# In frontend/: npm run build; npm run lint
```

`--scope all` means the full backend/migration/backup package; browser and repeated concurrency are explicit separate commands. Other focused scopes are baseline, extended, migration, precision and protection. Each invocation creates a new timestamp/UUID evidence directory; do not overwrite old results. The summary selects final successful suites and retains unsuccessful runs, rather than deleting failures or counting skips as passes.

The owner-verified marker settings reject arbitrary targets and disable dotenv discovery. PostgreSQL verifies the local Docker context, fresh ownership label, loopback port, absence of persistent mounts and database/user/version before migrations. SQLite paths must stay inside the newly owned runtime. Invalid legacy fixtures run in a separate default database because an existing historical Product migration assumes the default alias. No applied migration file is rewritten.

The browser runner starts only its own hidden Windows child processes, refuses occupied ports 18841/18842, uses headless Edge, blocks external requests, and exercises real HTTP endpoints through a test-only local Vite proxy. Its ephemeral configuration uses an empty env directory. This custom lifecycle is needed for fixture credentials, exclusive ports, log retention and Windows process-tree cleanup; the webapp-testing helper was inspected after its documented help entry point.

Cleanup verifies resolved runtime paths/UUID names and container ownership, then removes only the created targets. Do not use Docker prune/reset, production credentials or old audit runners. Earlier runners may initialize databases or overwrite previous evidence. Browser screenshots and JSON contain synthetic records only; credentials/auth cookies are excluded.

[Report](../PHASE1A3_DATABASE_VERIFICATION_REPORT.md) · [Selected actual results](verification-summary.json) · [Static provenance](final-source-review.json)
