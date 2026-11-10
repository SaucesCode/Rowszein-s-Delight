# Reproduced verification defects

## V1 — business fixture adapter fails before tests start

Evidence: first SQLite security run, `20261110-143220-sqlite-security-fab386f4/security.txt` (and initial PostgreSQL run). Both new migrations applied successfully; test setup then raised AttributeError because sales.test_phase1a1_compat has no APIClient binding. Its SalesFixture already uses sales.tests.APIClient. Removed only the nonexistent patch target; production authentication/permissions and all business assertions are unchanged. Regression: rerun the affected complete security and business suites with the adapter active. Initial failures are retained, not counted as passing tests.

## V2 — SQLite trigger DDL placeholder conversion (awaiting revised-hash approval)

The original 0003 uses schema_editor.execute(sql), whose default empty parameter tuple makes Django's SQLite adapter rewrite literal `%s` to `?`, even within SQL strings. Stored accounts_throttle_insert/update SQL therefore uses strftime('?', timestamp), invalidating valid epoch-microsecond events. Confirmed by real stored-trigger inspection and direct debit regression in `20261110-144141-sqlite-diagnostic-b5748ee5`. The HTTP layer correctly fails closed with 503; authentication is unavailable, never unthrottled. Proposed correction is params=None for the SQLite trigger execution only; no role, precision, quota, model or revocation policy change. Exact patch and proposed SHA are recorded. Original migration remains unchanged pending the owner's explicit revised-hash decision; no guard or hash check is disabled.

## V3 — 401 transport compatibility

The new session exceptions exposed code=access_expired, breaking the existing CSRF regression's stable authentication_required code. Retained the historical public code for all session-ended 401s and added the precise internal reason in a separate reason field. No status, session check, permission or business assertion is weakened. Regression: original 26 CSRF tests, including the unchanged error-code assertion.

## Fixture changes (not production defects)

Two new admitted-operation/logout race probes reused a transaction-cached pg_stat_activity snapshot, so the second newly connected backend was invisible. The tests failed rather than treating an unobserved wait as success. Added pg_stat_clear_snapshot() on every observation and retained bounded timeouts, observed-lock assertions and exact outcomes. Removed duplicate collection of the imported API test class from the concurrency module; all API cases remain in the complete security suite. Added explicit refresh/logout, password/refresh and measured admin contention cases.

The synthetic pre-upgrade tracked sale must explicitly specify revision=1, as required by the already accepted Phase 1A constraint; the first schema rehearsal rejected the invalid fixture before security upgrade. RBAC fixture changes are generated with an explicit diff: real V2/transactional fixtures, protected-unused-user deletion cleanup, actual middleware for an unmapped private callback, 26-route inventory including refresh, and fresh authentication after a role change before testing stored-response authorization. The original historical files and stock/financial assertions remain unchanged.
