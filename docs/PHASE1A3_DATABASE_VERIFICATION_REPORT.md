# Phase 1A.3 — disposable database verification

Date: 2026-11-09 (Asia/Shanghai). Branch: `codex/phase-1a2-five-models`. Implementation checkpoint preserved in local commit `570e227`. This report records verification of the approved five-model architecture and focused corrections discovered during testing.

**Verification work package complete; STOPPED for owner review.** PostgreSQL has **120 passing checks, zero failures/errors/skips**. SQLite has **103 passes, zero failures/errors, 17 explicit skips**. All ten previously failing release-blocker API tests pass on PostgreSQL without weakened assertions. The 33 defined API/concurrency tests pass on PostgreSQL. This does **not** authorize production migrations/deployment or establish whole-application production readiness. AUTH-01/AUTH-02 remain unresolved.

[Machine-readable evidence index](phase1a3_verification/verification-summary.json) selects the final passing runs, retains earlier failures, and distinguishes test methods from repeated executions. [Final source review](phase1a3_verification/final-source-review.json) records preserved evidence, unchanged migration hashes and unchanged blocker assertions.

## 1. Environment safety and migration execution

Only newly created, locally owned disposable targets were used. PostgreSQL 17.11 ran in uniquely named Docker containers, with generated database/role/password identities, host publication restricted to `127.0.0.1`, no persistent/bind business-data volumes and PostgreSQL data on a requested tmpfs mount. Before connecting, the runner verified the local Docker named-pipe context, container ownership label, port binding, absence of persistent mounts, current database/user and PostgreSQL major version. SQLite used exclusively created files under ignored, UUID-named `.verification-runtime/` directories. Ownership tokens and target manifests gated the dedicated settings module.

The runner strips inherited DATABASE/DB_/PG/POSTGRES variables and replaces application configuration with test-only values. The dedicated settings use an empty decouple repository, preventing project `.env` discovery. Browser Vite used an empty environment directory and a loopback proxy to the owned backend. Passwords, ownership tokens, auth cookies and browser credentials are excluded from evidence; generated database/role identifiers are target metadata. Previous generic test/migrate safeguards remain enabled; the new verified settings provide the authorized route rather than removing those safeguards.

Recorded environment: Python 3.12.14, Django 5.1.4, SQLite 3.53.1, PostgreSQL 17.11, Node 24.21.0, npm 12.0.2, TypeScript 6.0.3 and Vite 8.0.16. PostgreSQL isolation was **READ COMMITTED**, server timezone UTC; Django business timezone remained **Asia/Manila**. The PostgreSQL image digest is `sha256:f02121de6f74d30d8a94cd1d9584125e2178d7e6c377d8130112d4e52d867995`.

Every run records its exact host/port/database or SQLite filename, versions, migration hashes, results and cleanup. Examples: [final PostgreSQL environment](phase1a3_verification/evidence/20261109-211115-postgres-1d467673/environment.json), [SQLite environment](phase1a3_verification/evidence/20261109-211110-sqlite-789b9de4/environment.json). All recorded owned runtime targets were removed and owned container removal commands succeeded; no verification server or test database remains. Docker Desktop itself was left available rather than stopping unrelated runtime services.

**No production database, production data, deployment, Phase 2 seed generator, SEO work, redesign or authentication-security implementation was accessed or undertaken.** Synthetic records were minimal migration/browser fixtures and isolated automated-test data, not persistent demonstration data.

## 2. Fresh installation, upgrade, reversal and backup evidence

| Verification | PostgreSQL | SQLite |
| --- | --- | --- |
| Fresh installation through both approved migrations | Pass | Pass |
| Second migration application | No-op, empty plan | No-op, empty plan |
| Reverse the new migrations on an unused schema | Pass | Pass |
| Historical migrations + fixtures through historical model states, then upgrade | Pass | Pass |
| Original IDs, dates, timestamps, quantities, submitted prices, subtotals, original totals | Exact value equality; canonical hashes equal | Exact value equality; canonical hashes equal |
| Legacy marker defaults and NULL consumption/stock anchors | Pass | Pass |
| Invented legacy operations, bases, snapshots, stock movements or financial postings | None | None |
| Backup/restore into a second disposable database | Exact baseline equality using pg_dump/pg_restore | Exact baseline equality using SQLite backup API |
| Invalid negative legacy stock in a separate target | Expected IntegrityError; unchanged data; migration unrecorded; fixture stopped | Expected IntegrityError; unchanged data; migration unrecorded; fixture stopped |

Fixtures included two historical sales (one intentionally retaining an existing zero-total/line-total mismatch), original item prices, a leap-day sale date, Unicode notes, zero stock and a maximum old two-decimal balance. The migration did not silently repair the mismatch. Hash normalization removes only insignificant Decimal trailing zeros; **exact field-value equality is also asserted before hashing**, so widening scale does not conceal changed numeric values.

Exact upgrade order on both engines: `ingredients/0004_inventory_integrity`, then `sales/0003_inventory_integrity`. Unused-schema reverse order: sales 0003, then ingredient 0004. No tracked transaction existed during that reversal. This does not make schema reversal safe after real tracked activity: it would remove new audit history and narrow fractional stock. The existing forward-fix/verified-full-backup policy remains appropriate after use.

PostgreSQL physical introspection confirmed stock/snapshot numeric(20,9), monetary numeric(10,2), foreign keys, check/unique constraints and the four partial unique indexes `invop_sale_cancel_once`, `sc_active_sale_basis_unique`, `finance_gross_once`, `finance_cancel_once`. Actual invalid-write tests exercised foreign keys, request UUID uniqueness, cancellation uniqueness, nonnegative stock, paired anchors, minimum rate quantum, counters and movement checks. SQLite exercised applicable constraints and sequential behavior; it does not prove PostgreSQL locking or full numeric capacity.

Full evidence: [PostgreSQL migration/backup results](phase1a3_verification/evidence/20261109-211115-postgres-1d467673/migration-upgrade-backup.json), [SQLite migration/backup results](phase1a3_verification/evidence/20261109-211110-sqlite-789b9de4/migration-upgrade-backup.json), [PostgreSQL invalid fixture](phase1a3_verification/evidence/20261109-211115-postgres-1d467673/invalid-legacy-target/invalid-fixture.json), [SQLite invalid fixture](phase1a3_verification/evidence/20261109-211110-sqlite-789b9de4/invalid-legacy-target/invalid-fixture.json).

## 3. All ten release blockers — actual API results

The original Phase 1A.2 sources/evidence remain untouched. The versioned test fixtures add the approved cancellation reason; their ten method names and all assertions are unchanged. [Actual PostgreSQL per-test results](phase1a3_verification/evidence/20261109-211115-postgres-1d467673/release-blockers.json) close the prior ten red requirements **for this tested implementation/environment**.

| Requirement | PostgreSQL | SQLite |
| --- | --- | --- |
| Insufficient stock rejects the entire sale | Pass | Pass |
| Same successful identity replays the original sale once | Pass | Pass |
| Same identity with conflicting payload is rejected | Pass | Pass |
| Cancellation after recipe change restores original consumption | Pass | Pass |
| Three separate fractional sales consume exactly one batch | Pass | Pass |
| Soft cancellation retains sale/items and cannot restore twice | Pass | Pass |
| Unverifiable legacy sale is not automatically restored | Pass | Pass |
| Competing sales cannot both consume final stock | Pass | Skipped: PostgreSQL required |
| Concurrent duplicate requests create only one sale | Pass | Skipped: PostgreSQL required |
| Concurrent stale edits reject the second revision | Pass | Skipped: PostgreSQL required |

These outcomes come from the real API, not arithmetic experiments, expected-failure decorators or substituted service results.

## 4. All backend results and transaction coverage

| Suite | PostgreSQL pass/fail/error/skip | SQLite pass/fail/error/skip |
| --- | --- | --- |
| Ten release blockers | 10 / 0 / 0 / 0 | 7 / 0 / 0 / 3 |
| Original 33 defined API/concurrency tests | 33 / 0 / 0 / 0 | 25 / 0 / 0 / 8 |
| Arithmetic and metadata checks | 42 / 0 / 0 / 0 | 42 / 0 / 0 / 0 |
| New storage-precision unit checks | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 |
| Adapted Phase 1A.1 regressions | 18 / 0 / 0 / 0 | 18 / 0 / 0 / 0 |
| Additional constraints/reconciliation/API/race checks | 13 / 0 / 0 / 0 | 7 / 0 / 0 / 6 |
| **Total unique test methods** | **120 / 0 / 0 / 0** | **103 / 0 / 0 / 17** |

The 17 SQLite skips are 16 PostgreSQL concurrency cases and the PostgreSQL maximum-capacity numeric round-trip case. No skipped case is counted as a pass. Migration rehearsals, browser checks and repeated race executions are separate evidence, not added to this unique-method total. The index names the selected run for each group; the final extended runs include the last protected-deletion correction.

The 18 Phase 1A.1 behaviors were ported to required UUID/revision headers and the approved retention architecture. Successful edit assertions now check current projection plus unchanged original lines; hard-delete expectations now check cancellation plus retained history. Fault injection follows current service boundaries instead of removed serializer/deduction methods. Original Phase 1A.1 tests/results remain preserved in Git `b87d36d` and `docs/phase1a/`; the ten release-blocker assertions were not weakened.

Fault-injection checks cover original line insertion, first/last actual ingredient writes, operation creation, basis persistence, consumption creation, stock movement insertion, financial posting, response construction, current projection persistence and cancellation status persistence. Failure comparisons include all sale/item/ingredient/operation/basis/consumption/movement/posting rows and relevant timestamps. Failed create can retry the same identity; successful create/edit/cancellation replay has no repeated stock effect. Price-only edits preserve allocation snapshots/cursors. Changed/removed recipes cannot redefine reversal quantities. Protected product/ingredient/user history remains retained; unused product deletion still succeeds.

Final extended results: [PostgreSQL](phase1a3_verification/evidence/20261109-212021-postgres-c80ba0e8/extended.json), [SQLite](phase1a3_verification/evidence/20261109-212017-sqlite-fddbe6c5/extended.json).

## 5. PostgreSQL concurrency

The 16-case concurrency set ran **five times: 80 passes, zero failures/errors/skips** after the storage-precision correction, separately from the unique-method totals. The subsequent protected-product DELETE correction was separately verified on both engines; these 16 races do not exercise product deletion. Workers used independent PostgreSQL connections and recorded distinct backend PIDs. Lock/statement timeouts were bounded; no deadlock, timeout or swallowed exception was counted as success. [All five run logs/results](phase1a3_verification/evidence/20261109-211522-postgres-c2b4fa91/summary.json) retain actual PIDs/statuses.

Coverage includes different operators competing for final stock; identical/conflicting UUID submissions; a forced unique-key collision with disjoint stock; stale concurrent edits; cancellation versus edit; two cancellation identities; recipe changes versus sales; stock adjustment versus sale; fractional sales/cancellations; and multi-product/multi-ingredient requests in opposite orders. A dedicated test holds an actual ingredient row lock, observes the contender in `pg_stat_activity` with `wait_event_type=Lock` and the holder in `pg_blocking_pids()`, then releases it and verifies a complete successful transaction. Barriers do not park contenders behind locks held by another participant waiting at that barrier.

Reconciliation after competing workflows verifies anchors/movement balances, revisions, distinct cursor intervals, active units, exact consumption credits/deductions, signed posting sums and retained cancellations. Passing these schedules is evidence of the tested behavior, not proof against every possible production schedule or external writer.

## 6. Inventory and financial reconciliation examples

All stock quantities use their ingredient's declared base unit; no physical-unit conversion was added. Stock remains Decimal(20,9), money Decimal(10,2); cumulative allocation uses exact integer quanta and a monotonic lifetime cursor. Cancellation credits stored applied quantities, never recomputes current recipes or redistributes rounding.

Actual API fractional example: with flour opening 20.000000000 kg and recipe 0.01 kg / 3 units, three separate sales allocate 0.003333333, 0.003333334 and 0.003333333 kg. Cancelling the middle sale credits exactly 0.003333334, leaving 19.993333334 and cursor 3. A later sale advances to cursor 4; cancelling the remaining active snapshots restores the opening stock exactly. Both engine suites passed this sequential case; PostgreSQL also passed concurrent allocation/cancellation.

Actual browser ledger:

| Flour operation | Signed kg movement | Balance kg |
| --- | --- | --- |
| Observed opening anchor | — | 20.000000000 |
| Create one-unit sale | -0.003333333 | 19.996666667 |
| Edit to two units, reversing old exact snapshot and allocating [1,3) | -0.003333334 net | 19.993333333 |
| Notes-only concurrent edit | No movement | 19.993333333 |
| Cancel exact active snapshot | +0.006666667 | 20.000000000 |
| Explicit observed-count adjustment | +0.000000001 | 20.000000001 |

Thus `opening + SUM(signed movements) = current stock` exactly. Milk independently reconciled from 10.000000000 back to 10.000000000. Cursors remained 3 after cancellation and active units became zero. Original sale item quantity 1 and unit price 50.00 remained intact after editing/cancelling. The 60-operation deterministic database lifecycle additionally checks these invariants after every command, including immutable historical quantities and contiguous, never-rewound allocation intervals.

Actual date-filter API example: Nov 9 gross +50.00; Nov 10 edit adjustment +130.00; Nov 11 cancellation -180.00. Daily nets are 50.00, 130.00 and -180.00; combined net is 0.00. Browser example: gross 50.00 + adjustment 40.50 + signed cancellation -90.50 = net 0.00. Display cancellation magnitude is 90.50, **not an additional subtraction**. Neither workflow creates a cash refund or Expense.

Legacy original totals are selected only from `financial_tracking=legacy_source`; postings are selected only for `financial_tracking=ledger` sales. Actual tests prevent overlap, preserve zero/negative legacy totals, block automatic legacy reversal and retain original prices. A stored anchor is an observed pre-command balance, not proof that pre-ledger stock was physically correct. **Production reconciliation and legacy reclassification remain unperformed and separately reviewable.**

## 7. Browser, TypeScript, build and lint

[Final browser results](phase1a3_verification/evidence/20261109-213908-postgres-abe5837b/browser.json): **28 checks pass**, no uncaught page errors, headless Microsoft Edge at 1440×1000 against real React/Vite HTTP proxy/Django/PostgreSQL. External requests were blocked. Screenshots include [retained cancellation/reporting](phase1a3_verification/evidence/20261109-213908-postgres-abe5837b/browser-cancelled-history.png), [inventory](phase1a3_verification/evidence/20261109-213908-postgres-abe5837b/browser-inventory-after-adjustment.png) and [dashboard](phase1a3_verification/evidence/20261109-213908-postgres-abe5837b/browser-dashboard-reconciled.png).

The browser committed a sale and deliberately lost its response, reloaded, rejected both a conflicting valid payload and an invalid fractional-cent payload, then replayed the exact original payload with the same identity and no duplicate sale/deduction. It also checked revision conflicts/refetch, successful edit, cancellation, exact stock adjustment, dialog reopening/reset, insufficient-stock refusal, identity retention/clearing and dashboard/financial agreement. Expected network-reset/HTTP 400/409 console messages from these injected failures are recorded; they are not uncaught JavaScript errors. The test proxy changes only local ports; production proxy/deployment/cookie behavior was not verified.

TypeScript + production Vite build: **pass** ([final log](phase1a3_verification/frontend-build-retry-fix.txt)). Exact frontend stock utility tests: **10 pass** ([results](phase1a3_verification/stock-preview-tests.txt)). Lint of the affected dialogs/identity/quantity helpers: **pass, exit 0** ([log](phase1a3_verification/affected-frontend-lint-retry-fix.txt)). Full-project lint remains **failed: 12 existing errors and 16 warnings**, versus the earlier 13/16 ([final log](phase1a3_verification/frontend-lint-retry-fix.txt)). Remaining errors concern existing explicit-any typing and component/helper exports; warnings include existing hook dependencies/compiler compatibility. Existing CSS import-order and large-chunk build warnings remain. No lint suppression or broad unrelated cleanup was added. Twelve additional pure frontend identity tests pass ([results](phase1a3_verification/operation-identity-tests.txt)), covering initial rejection, retries/reloads, later validation/auth/stale failures, old pending identities, storage failure and corrupt-state fail-closed behavior.

## 8. Bugs discovered and focused corrections

| Finding and reproduction | Root cause | Correction and final verification |
| --- | --- | --- |
| A real browser retry produced **two sales** after a lost response followed by a later validation error | The frontend treated any later 4xx as proof that the earlier attempt had not committed, discarded its UUID, then generated a new identity | Shared identity storage records prior attempts before dispatch. Only a known first-attempt rejection may clear a UUID; later errors retain its identity/revision. Create/edit/cancel/stock hooks share this rule. The browser now retains one sale/deduction through reload, 409 and 400; 12 pure identity regressions pass. |
| SQLite accepted unsafe initial quantity/one-quantum adjustment at a large balance; two desired rejection tests failed | Django's SQLite Decimal converter uses 15 significant digits; numeric(20,9) metadata does not provide PostgreSQL precision there | Validate representability before initial stock, snapshots, opening/result balances and signed movement/delta writes. SQLite rejects unsafe quantities with 400 and no persistent changes; PostgreSQL retains the full approved range. Both new API tests and four unit checks pass. No schema or rounding policy changed. |
| Browser could not discover cancellation controls by accessible role; stock dialog had the same ancestor attribute | `aria-hidden=true` on the backdrop hid the entire dialog subtree; child aria-hidden=false could not undo that | Removed the two ancestor attributes. Actual role-based cancellation/stock workflows now pass; no visual redesign. |
| Affected-file lint failed on stock modal reset effect | Synchronous state reset in an effect tied reset to prop-object changes | Keyed the inner dialog by ingredient and unmounted on close. State initializes on opening; reopening fields and lint now pass. |
| Historical-product DELETE raised an uncaught ProtectedError | Existing Product view did not translate retained-history protection into an API response | Transactional Product row lock and 409 response; state remains unchanged. Both engines verify protection and successful deletion of an unused product. |

Failure evidence remains: [duplicate-sale retry](phase1a3_verification/evidence/20261109-213645-postgres-219612fd/browser.json), [unsafe SQLite precision](phase1a3_verification/evidence/20261109-210923-sqlite-6cbc88fe/precision.json), [hidden-dialog browser failure](phase1a3_verification/evidence/20261109-205911-postgres-df5e9eea/browser.json), [protected-product error](phase1a3_verification/evidence/20261109-211945-sqlite-d58693f2/protection.json). The initial affected-file lint failure is also retained.

Two initial migration **harness** failures were corrected: Decimal scale needed canonical hash formatting after exact value comparison; and historical products 0004 assumes the default alias, so the invalid fixture must run in its own default database rather than an alternate alias. No historical migration was edited. Their failed run logs remain indexed. The expected invalid-stock IntegrityErrors are separate from these resolved harness failures and are not presented as successful invalid-data migrations.

## 9. Files and migrations

Application changes: `backend/sales/storage_precision.py`, `backend/sales/services.py`, `backend/ingredients/serializers.py`, `backend/products/views.py`, `frontend/src/components/ConfirmDialog.tsx`, `frontend/src/components/ingredients/UpdateStockModal.tsx`, `frontend/src/lib/operationIdentity.ts` and the sale/ingredient/operation-identity hooks. New tests: `backend/sales/test_storage_precision.py`, `test_phase1a1_compat.py`, `test_verification_extended.py`; existing concurrency helper now records PIDs/statuses. Added dedicated verified settings/result runner, disposable lifecycle/migration/invalid-fixture/browser/static/index scripts, `.verification-runtime/` ignore rule, evidence and project documentation. Exact path lists are in [final-source-review.json](phase1a3_verification/final-source-review.json).

**No new migration was created; neither applied migration file was modified.** The five-model schema and operation sequences remain those in [IMPLEMENTED_SCHEMA.md](phase1a3/IMPLEMENTED_SCHEMA.md). Both approved migrations were applied only to the authorized disposable databases.

| Migration | SHA-256, unchanged throughout execution |
| --- | --- |
| ingredients/0004_inventory_integrity.py | `6b16f329b58d1dd2385c053f8bda98466f77f2483eafa275a6d66f810ef4843c` |
| sales/0003_inventory_integrity.py | `56b12876f54896011f31b8c089bf0553e6f5c047481eaddba7eb25d6502cff14` |

Static final review reports no model/migration drift, no changed prior evidence, unchanged blocker assertions and no database connection during static checks. Phase 0, 1A.1, 1A.2 and the earlier implementation-checkpoint evidence are intact.

## 10. Remaining issues and readiness limits

- **AUTH-01/AUTH-02 remain unresolved.** Role/method enforcement and cookie/CSRF security were not fixed or certified by owner-login/business tests. Existing dependency/security findings remain for separate review.
- Full-project lint and existing build warnings remain as reported. No mobile/browser matrix, full accessibility audit, deployment proxy/cookie validation, capacity/load benchmark or complete accounting/refund system was tested.
- Synthetic upgrade/restore success is not evidence that production data is valid or safely migratable. No production preflight, physical stock count, reconciliation, backup, migration or restore occurred. Invalid historical stock must be reported/stopped, never repaired silently.
- SQLite is restricted to safely representable quantities; it is not a full numeric(20,9) deployment alternative. PostgreSQL remains the approved primary architecture. Unsupported quantities are rejected rather than rounded, reallocated or clamped.
- Raw SQL/QuerySet writes can bypass model immutability/cursor guards and cross-table invariants. Database privilege hardening/triggers were not introduced. Restricted writer access and reconciliation remain required operational safeguards.
- Legacy consumption remains unknown unless separately evidenced. Legacy sale inventory edits/cancellations stay blocked; notes-only changes do not invent stock history. No legacy-to-ledger transition, financial-date correction or cash-refund workflow was added.
- Pending UUIDs are scoped to the authenticated actor/session. Exact request payloads are not automatically restored across devices; the reload test re-enters the original intent. Once an outcome is uncertain, later errors retain the identity and may require explicit reconciliation rather than silently generating a new UUID.
- Successful tested races do not prove every possible schedule. Transaction aborts/timeouts outside tested cases still require stable-identity retries; no production availability/retry policy is claimed.

The ten former API blockers are now **passed in disposable PostgreSQL**, rather than left open based on primitive experiments. Whole-application security, production readiness and rollout approval remain unresolved.

## 11. Recommended next work package and stop

Review this report and its evidence first. The next proposed, separately approved package is **Phase 1 authentication/authorization design and regression coverage for AUTH-01/AUTH-02**, including the owner/staff method matrix and cookie/CSRF policy. Production data preflight/reconciliation and backup/restore planning must also be reviewed before any future rollout. Neither package, production migration/deployment nor Phase 2/SEO/redesign has begun automatically.

Reproduction instructions and safeguards: [verification README](phase1a3_verification/README.md). **STOPPED after Phase 1A.3 for owner review.**
