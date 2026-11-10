# Phase 1B.3 static checkpoint tooling

**Do not run a Django database test runner, migrate, cleanup command or application server from this branch before explicit schema/application approval.** The report is [the approval checkpoint](../PHASE1B3_SESSION_SCHEMA_IMPLEMENTATION_CHECKPOINT.md).

Safe, database-free commands from the repository root:

```powershell
backend/.venv/Scripts/python.exe -B docs/phase1b3_static/run_static_checks.py
backend/.venv/Scripts/python.exe -B docs/phase1b3_static/inspect_schema.py
node --experimental-strip-types docs/phase1b3_static/test_auth_lifecycle.mjs
```

Both Python entry points force backend.session_static_settings, use Django's dummy backend and replace BaseDatabaseWrapper.connect/cursor with an exception. No migration executor or SQL server is used. SQL files under evidence are rendered **strings**, not applied or server-validated SQL. They must not be mistaken for database migration evidence.

session_api_contracts.py, session_concurrency.py, business_compatibility.py and security_compatibility.py are **gated future suites/adapters**, not executed by the static runner. Security fixtures use genuine V2 cookies/CSRF; the narrowly scoped business adapter provides the same for existing force_authenticate business fixtures. It never patches production authenticators or relaxes stock/financial assertions. Future profiles must verify disposable ownership and supply isolated keys, databases and evidence directories before permitting schema creation.

Existing RBAC API-inventory, deletion and role-change-read fixtures need explicit versioned updates as described in the checkpoint. Do not edit historical evidence or suppress failures. Real-browser tests and production topology remain deferred.
