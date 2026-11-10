# Phase 1B.3 disposable verification

Approved starting candidate: 30a9a61. See [verification report](../PHASE1B3_DATABASE_VERIFICATION_REPORT.md).

The harness preserves the original ownership/token/Docker-context/loopback/mount guards and adds an explicit 1B.3 authorization plus committed/static migration hashes and reviewed generated SQL. Every scope creates and removes new targets. No project `.env` is loaded. Do not point a runner at an existing database.

Entry point: run_checks.py --backend postgres|sqlite --scope preflight|schema|security|business|concurrency|rbac|browser. PostgreSQL needs the existing local Docker Desktop engine and postgres:17-alpine image; no pull occurs. The evidence root is separate from prior phases. Management-command preflights write text, not per-test JSON; early missing_result markers for those commands mean no JSON was expected, with actual exit status/SQL retained.

**SQLite is not passing.** The original 0003 remains unchanged. PROPOSED_SQLITE_MIGRATION_FIX.diff and proposed-migration-hash.json are an unapplied review artifact. The mandatory approved-hash guard intentionally rejects an edited migration. A separately approved revised hash must be added as an explicit review decision before executing that correction on new targets; do not remove or bypass the guard and do not patch an old target in place.

Historical tests remain intact. The business adapter binds real V2 cookies. RBAC fixture changes are versioned and recorded in rbac-fixture-changes.diff; there is no production auth bypass. Tests and failure logs retain actual statuses and bounded lock failures. Browser code uses actual React services, separate Edge tabs and native Web Locks, with external requests blocked. Synthetic HTTP availability responses are distinguished from the separate actual PostgreSQL permission-denial test.

run_frontend.py captures new utility/build/lint evidence with an empty envDir. summarize_results.py aggregates selected real runs and verifies cleanup and prior-evidence preservation without rewriting any run. It deliberately reports package_complete=false while the SQLite correction is pending.
