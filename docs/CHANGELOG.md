# Revival changelog

## 2026-11-09 — Package 1B.1 CSRF protection; review checkpoint

Created `codex/phase-1b1-csrf` from audit commit `d88f8c7`. Added Django masked-token bootstrap, explicit cookie-JWT/login/logout CSRF enforcement, exact configured Origin/HTTPS Referer validation, auth CSRF rotation and expired-cookie-safe logout. Axios sends the token, permits one proven pre-write CSRF recovery using the same intent, and retains pending UUIDs across 401/403/429. Auth response/cache/error handling is consistent; existing business error messages are preserved.

Actual original security checks: before 13 failures, after 10 passes/3 deferred failures, on both engines. New CSRF checks: 26 pass per engine. PostgreSQL business suite: 120 pass; SQLite: 103 pass/17 skip. Real PostgreSQL browser: 44 pass. Frontend: 14 transport +13 identity +10 stock checks pass; build/affected lint pass; full lint retains 12 errors/16 warnings. All 13 role contracts remain red. Earlier evidence and ledger/migration files are preserved; no schema, role, persistent-session, lifetime, rate-limit or dependency changes. Only fresh owned disposable databases were migrated/tested and removed.

[Implementation report and evidence](PHASE1B1_CSRF_IMPLEMENTATION_REPORT.md). AUTH-02, copied-token/password-change revocation, login throttling, unsupported dependencies and deployment topology remain open. No production access/deployment/later-phase work. STOPPED for review before Package 1B.2.

## 2026-11-09 — Phase 1B security audit and permission design only

Created `codex/phase-1b-security-audit` from `dcf2500`. Inspected cookie JWT authentication, login/logout, Axios/route guards, endpoint permissions, expiry/refresh/revocation and throttling. Added isolated real-cookie CSRF/role/lifecycle audit tests and proposed CSRF transport, role matrix, session options, risk treatment and implementation/test packages. Fifteen current-behavior controls pass on PostgreSQL/SQLite; 13 desired security checks and 13 draft role contracts fail on each. Phase 1A remains green: PostgreSQL 120 passes, SQLite 103 passes/17 skips; frontend utility checks 10+12 pass. Both owned targets cleaned up, prior evidence intact.

[Approval document](PHASE1B_SECURITY_AUDIT_AND_DESIGN.md). No application/backend/frontend/permission behavior, dependency or schema/migration changed; no production access or deployment. AUTH-01/AUTH-02 remain unresolved. Stopped for business-role, CSRF/topology and session/throttle decisions before implementation.

## 2026-11-09 — Phase 1A.3 disposable database verification

Preserved the implementation checkpoint in `570e227`; verified only fresh owned PostgreSQL 17.11/SQLite targets. All ten prior API blockers now pass on PostgreSQL; all 33 defined API/concurrency tests and 18 adapted 1A.1 regressions pass. Selected totals: PostgreSQL 120 pass/0 fail/0 error/0 skip; SQLite 103 pass/0 fail/0 error/17 skip. Repeated PostgreSQL concurrency: 80 passes across five 16-case runs. Browser: 28 passing real HTTP checks. Fresh/legacy upgrade, idempotence, unused reverse migrations and backup/restore verified; invalid stock fixture safely rejected without repair. Migration files/hashes unchanged; no new migration created.

Fixed pending request UUID loss after a later validation error (a browser reproduced a duplicate sale before the fix), unsafe SQLite precision acceptance with pre-write storage validation, hidden cancellation/stock dialog roles, stock-modal reset lifecycle lint, and uncaught protected-product deletion. Preserved the failing reproductions and corrected migration-harness issues without editing historical migrations. Build/affected lint pass; full lint remains 12 errors/16 warnings. [Required report and evidence](PHASE1A3_DATABASE_VERIFICATION_REPORT.md). No production/later-phase work; AUTH-01/02 remain open. Stopped after verification for owner review.

## 2026-11-09 — Five-model implementation; migrations generated, UNAPPLIED

On `codex/phase-1a2-five-models`, implemented InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement and SaleFinancialEntry with exact applied-quantity reversals, monotonic allocation, stable database identities/revisions, cancellation uniqueness and cancellation-date signed financial reports. Original sale facts remain retained; legacy inventory changes/cancellation fail closed. Added coordinated stock/recipe paths and frontend contract support. Generated ingredient 0004 and sale 0003; statically inspected only. **No new migration executed**, including in disposable environments.

42 database-free arithmetic/metadata tests and 10 frontend stock-utility checks pass; TypeScript/Vite build passes with existing warnings. API/rollback/concurrency definitions remain unexecuted; the ten prior failing API requirements remain release blockers. [Full checkpoint, exact schema, preservation/rollback and proposed disposable verification](PHASE1A2_IMPLEMENTATION_CHECKPOINT.md). Prior evidence preserved. Stopped awaiting explicit disposable PostgreSQL/SQLite migration/testing authorization; no production/later-phase work.

## 2026-11-09 — Package 1A.2 conditional design/test refinement

Preserved 1A.1 in commit `b87d36d`; created `codex/phase-1a2-design-contracts`. Added an unwired Decimal/integer-quanta allocation/fingerprint kernel, 19 math/identity tests, eight PostgreSQL primitive experiments and ten desired current-API contracts. PostgreSQL passing suite: 45 pass; current-API requirements: 10 failures. SQLite passing suite: 37 pass/8 skips; current requirements: 7 failures/3 skips. Frontend build passes with existing warnings. The overall checks retain a failing exit code while requirements remain unmet.

Added [exact field/constraint/index/migration/rollback design](PHASE1A2_FINAL_DATABASE_DESIGN.md), [numerical/test evidence and review checkpoint](PHASE1A2_REVIEW.md), and separate artifacts under `docs/phase1a2/`. Simplified schema proposal; no new models, fields, indexes, constraints or migrations implemented. Existing endpoints/reporting and earlier evidence remain unchanged. No production data, deployment or later-phase work. Stopped for exact schema, fractional/legacy and financial-reporting decisions; migrations remain unauthorized.

## 2026-11-09 — Phase 1A package 1A.1; database approval checkpoint

Preserved reviewed Phase 0 documents/evidence in commit `5e6991c`; created `codex/phase-1a-sales-inventory`. Added desired-behavior sales regressions first (18 tests, 13 failures against original code), then moved edit validation before restoration and wrapped HTTP create/update/delete in atomic transactions. All 18 tests pass on SQLite and disposable PostgreSQL 17.11; frontend production build passes with existing warnings. No model/schema changes or migrations were created.

Added isolated regression settings, disposable PostgreSQL runner/evidence, [progress report](PHASE1A_PROGRESS.md) and [database design proposal](PHASE1A_DATABASE_PROPOSAL.md). Full Phase 1A remains incomplete: insufficient-stock handling, historical consumption, successful-request idempotency, fractional allocation and concurrency await the approved schema/service package. AUTH-01/02 remain unresolved. No deployment, production changes or later-phase work occurred. Stopped for the mandatory schema/business-policy approval.

## 2026-11-09 — Phase 0 audit

Created `PROJECT_REVIVAL_AUDIT.md`, `REVIVAL_ROADMAP.md`, `SECURITY_REVIEW.md`, `SEO_AUDIT.md`, `QUALITY_CHECKLIST.md`, `TEST_RESULTS.md`, this changelog, and reproducible scripts/evidence under `docs/audit/`.

Audited existing architecture, business calculations, inventory/sales integrity, auth/permissions, API integration, public SEO, accessibility, build/lint/dependencies and performance. Captured 10 local desktop/mobile screenshots. Executed 22 backend evidence probes and frontend date/import probes. Preserved actual build/lint/migration/security outputs, including failures and limitations.

No business defects were fixed in this phase. No application implementation, deployment configuration, existing migration, requirements or lockfile was changed. No production data/credentials were used or modified; no deployment took place. Local dependencies were installed for audit execution. Work is isolated on `codex/phase-0-revival-audit` from baseline `78ee4a0`.

Phase 1 is awaiting explicit owner approval. A demo-data guide will be created with Phase 2 implementation rather than as an empty placeholder now.
