# Revival changelog

## 2026-11-10 — Phase 1B.3 approved SQLite correction; final verification

Owner explicitly approved the prepared one-line params=None correction and revised 0003 SHA `3b8156d1eee07b1e73affde5898d47888b237e579913c785e99a6652eabe9e2c`. Commit `b9957e0` records that exact migration change, explicit approval and strict original-plus-correction hash checks. Original 0002 and all historical evidence remain intact; no old target was patched in place. Five guard tests reject any unapproved migration/approval edits. Fresh full PostgreSQL suites pass (120 business; 93 security plus one SQLite-only skip; 28 concurrency; 21 RBAC; 28 schema checks). Fresh SQLite suites pass (103 business/17 skips; 91 security/3 skips; 21 RBAC; 27 schema checks; PostgreSQL-only concurrency group explicitly skipped). Each engine has 33 real-browser passes, including native multi-tab Web Locks and uncertain sale/stock retry identities. All three original release blockers now have passing real API evidence on both engines.

Retained original failures and archived the pre-correction report/summary. Test browser response observation replaces an unreliable fixed delay; sandbox-only setup failures remain recorded. Frontend's unchanged 52 utility checks/build/focused lint evidence remains valid. Twenty-eight disposable database cleanup records are verified; no production access, deployment, dependency upgrade or later-phase work. [Final report](PHASE1B3_DATABASE_VERIFICATION_REPORT.md). STOPPED for owner review; production readiness is not claimed.

## 2026-11-10 — Phase 1B.3 disposable execution; SQLite correction review

Executed only the two approved, hash-matched migrations on fresh independently owned PostgreSQL 17/SQLite targets. Added an extra approval/hash/SQL-review gate over the preserved isolation harness. PostgreSQL final results: business 120 pass; security/operations 93 pass/1 SQLite-only skip; prior RBAC 21 pass; concurrency 28 pass/0 skips/timeouts; schema/upgrade/backup/reverse/cleanup 28 pass; real Edge/React/Web Locks browser 33 pass. Frontend 52 utility assertions plus build/affected lint pass. SQLite business 103 pass/17 PostgreSQL skips and schema/preservation 27 pass, but security records 67 pass/17 fail; focused reproduction records one failure/one error. Initial failures and prior evidence remain intact.

Commit `c94d20f` preserves the historical public 401 code and corrects V2 fixtures/statistics observation. Confirmed SQLite DDL parameter formatting replaces literal strftime('%s') with '?', rejecting valid counter events and returning honest 503s. Prepared, but did not apply, a one-line params=None migration correction (proposed SHA 3b8156d1…). Mandatory approved-hash matching remains enforced; owner approval is pending. [Verification report](PHASE1B3_DATABASE_VERIFICATION_REPORT.md) includes exact results, reproduction, SQL errors, user-facing session consequences and revised-hash checkpoint. All owned targets are removed; no production, deployment, Redis, dependency upgrades or later-phase work. Package remains incomplete due to SQLite.

## 2026-11-10 — Phase 1B.3 static implementation; migrations UNAPPLIED

Conditional architecture approval reconciled D7–D16 before code changes. On `codex/phase-1b3-static-implementation`, added DeviceSession, AuthThrottleBucket and trigger-controlled User.session_epoch; generated accounts/0002 additive model operations and accounts/0003 vendor guard installation. Added bound V2 JWTs, strict refresh rotation/reuse, database-checked admission/activity/revocation, shared atomic login quotas, verified ingress policy, protected admin sessions/password changes, cleanup tooling and explicit cross-tab-coordinated frontend renewal. Preserved ledger models/math/history and original test/evidence files. [Exact checkpoint](PHASE1B3_SESSION_SCHEMA_IMPLEMENTATION_CHECKPOINT.md) records schema, triggers, ordered operations, compatibility gaps, cutover/restore risks and the future disposable test plan.

Actually executed without a database: 76 backend pure/metadata tests, 42 frontend checks, TypeScript/Vite build, focused lint and dummy-backend system/migration-state checks pass. Zero connection/cursor attempts in guarded static runners. API/concurrency/security/admin/compatibility tests were written but **not run**. No new migration was executed, no database accessed, and no deployment/service/dependency/later-phase work performed. The three release blockers remain OPEN. STOPPED for exact-schema approval and separate disposable migration/test authorization.

## 2026-11-10 — Phase 1B.3 session/rate-limiting design only

Accepted 1B.2 at `8d8fe47`; created `codex/phase-1b3-session-design`. Added [exact session/revocation/login-limiting design](PHASE1B3_SESSION_SECURITY_DESIGN.md): two proposed security models, User epoch/database guards, 15m/30m/8h policy, strict refresh reuse, cookie/admin recovery, PostgreSQL rolling counters and Redis alternative, proxy trust, outages, retention, migration/backup/rollback and race tests. Explicit D7–D16 owner decisions precede implementation. Calls out hash-upgrade revocation, same-session serialization, and stronger reauthentication expectations after role changes without relaxing existing assertions.

Documentation only. No application/test/dependency changes, database access, new migration generation/execution, service provisioning or deployment. Prior results/evidence are inherited and unchanged; the three revocation/throttling release blockers remain open. STOPPED for design approval.

## 2026-11-10 — Package 1B.2 RBAC; review checkpoint

Created `codex/phase-1b2-rbac` from approved `d696a74`. Added centralized capabilities and explicit action mappings, default-deny private APIs, staff own-tracked-sale query/object scoping, operational field projections, public-safe catalog reads and cache privacy. Staff sale commands require current catalog prices and the current Manila date after successful replay checks. PostgreSQL shared actor locks serialize ledger authorization with role changes without serializing parallel commands by the same actor. Django admin requires business-owner and existing technical permissions; history remains read-only. Frontend navigation/routes, readonly staff screens, price/date controls and authority-cache refresh reflect backend permissions.

Original role checks: 13 failures before, 13 passes after on each engine. Final PostgreSQL suites: 194 passes/3 deferred failures/0 errors; SQLite: 173 passes/3 deferred failures/21 skips/0 errors. All 120 PostgreSQL business checks and 26 CSRF regressions remain passing. New RBAC suite includes four real-cookie PostgreSQL concurrency checks. Browser: 68 passes. Frontend: 47 utility passes; build and affected lint pass; full lint retains 8 errors/16 warnings. Only three business fixture role keywords changed; AST comparison confirms all other test code/assertions unchanged. No models, migrations, dependencies, token lifetimes or ledger math/reporting changed. Prior evidence preserved; all databases were owned disposable targets.

[Required implementation report](PHASE1B2_RBAC_IMPLEMENTATION_REPORT.md). Logout/password-change revocation and login throttling still fail their requirements. No production access, deployment, session implementation or later-phase work. STOPPED after 1B.2 for owner review before 1B.3 design/schema approval.

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
