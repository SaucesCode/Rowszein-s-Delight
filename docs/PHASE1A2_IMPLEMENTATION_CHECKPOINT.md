# Phase 1A.2 five-model implementation — migration execution checkpoint

Date: 2026-11-09. Branch: `codex/phase-1a2-five-models`. Preserved prior work: Phase 0 `5e6991c`, 1A.1 `b87d36d`, 1A.2 design/evidence `32d2df3`.

**STOPPED BEFORE EXECUTING ANY NEW MIGRATION.** The owner authorized implementation, additive migration generation/static inspection, test definitions and documentation. The owner explicitly withheld execution of migrations, including implicit test-runner migrations in disposable SQLite/PostgreSQL. Neither database integration nor browser/API integration was run for this implementation. No production data/credentials, deployment, dummy-data generation or unrelated redesign/SEO work was performed. Phase 1A is incomplete and is not release-ready. AUTH-01 and AUTH-02 remain unresolved.

This document supersedes the implementation proposals in `PHASE1A2_FINAL_DATABASE_DESIGN.md` and `FINAL_SCHEMA_APPROVAL_SUMMARY.md`; those prior checkpoint documents and their evidence remain historical records. `phase1a3/` is an artifact-folder name for this implementation checkpoint, not authorization for a new phase.

## 1. Exact implemented schema and reasons

The complete field/type/default/nullability/relationship/index/constraint inventory and **ordered migration operations** are in [IMPLEMENTED_SCHEMA.md](phase1a3/IMPLEMENTED_SCHEMA.md), generated from [implemented-models.json](phase1a3/evidence/implemented-models.json) and [migration-operations.json](phase1a3/evidence/migration-operations.json). These are model metadata, not proof that a database accepted the schema.

| New model | Purpose and principal guarantees |
| --- | --- |
| InventoryOperation | Actor + client UUID unique at the database; action, target, canonical SHA-256 request intent, reason, before-state, response/status, schema version and timestamp. A partial unique sale cancellation constraint works independently of UUID/actor. Successful retries return the original result; conflicting payload/target/revision gets 409. Failed commands leave no committed operation. |
| ConsumptionBasis | Retained product + ingredient + declared base unit + batch quantity + yield rate identity. Rate tuple unique; rates immutable through model/service; monotonic lifetime `allocated_units` cursor distinct from `active_units`. Positive rate and minimum one quantum per unit enforced by proposed checks. No Recipe FK or dependency on current recipe definitions. |
| SaleConsumption | Sale/revision/basis/operation, cursor start, units, exact `applied_quantity` and one-time `reversed_by` operation. Unique revision/basis, basis/start, and unreversed sale/basis. Cancellation credits the stored quantity exactly. Original quantity/rate/creating operation are never rewritten. |
| StockMovement | Operation + ingredient + stock revision + unit + signed delta + exact resulting balance. Unique operation/ingredient and ingredient/revision; zero deltas rejected. One net row per affected ingredient; full consumption reversals/allocations remain separately identifiable even if the net stock delta is zero. |
| SaleFinancialEntry | Sale/revision, one-to-one operation, kind, posting date and signed PHP amount. Unique sale/revision; independent partial uniqueness for original gross and cancellation. Strict kind/sign checks. No cash-refund inference. |

All five use BigAutoField PKs and **PROTECT** on new foreign keys. Normal FK indexes, unique/one-to-one indexes and partial unique indexes apply; redundant single-column indexes are suppressed where a composite leading column already serves them. Two explicit extra indexes support sale operation history `(sale, created_at, id)` and posting reports `(effective_date, kind, id)`. Django PROTECT guards the deletion collector; PostgreSQL FK behavior and physical indexes remain to be exercised.

Existing Sale adds `inventory_tracking` (default `legacy_unknown`), `financial_tracking` (`legacy_source`), `status` (`recorded`), `revision` (0), nullable `current_items` JSON and nullable protected one-to-one `cancellation_operation`. Status/tracking/revision/cancellation-link checks are specified. Existing Ingredient widens `quantity` to Decimal(20,9), adds `stock_revision` (0), nullable `ledger_opening_quantity` Decimal(20,9) and `ledger_started_at`, with nonnegative/paired-anchor checks. No new refund table, recipe version table, separate idempotency table or legacy consumption backfill is introduced.

Original SaleItem rows and Sale.total_amount remain the original transaction facts. Edited items are a current JSON projection; the prior projection is retained in the next operation's before-state and the new projection in its response. Original line IDs remain for original products; newly added projected lines have no invented historical SaleItem ID. This preserves the old `(sale, product)` uniqueness without deleting old lines or introducing a sixth persistence model. Relational analytics must use current projections or financial postings, not assume original SaleItems equal an edited sale's current value.

## 2. Generated migrations and operation sequences

1. [ingredients/0004_inventory_integrity.py](../backend/ingredients/migrations/0004_inventory_integrity.py): add nullable opening quantity; add nullable start timestamp; add stock revision default 0; widen quantity to Decimal(20,9); add `ing_stock_revision_valid`; add `ing_anchor_valid`. Depends on ingredients 0003.
2. [sales/0003_inventory_integrity.py](../backend/sales/migrations/0003_inventory_integrity.py): create three scalar-only tables (SaleConsumption, SaleFinancialEntry, StockMovement); add five independent Sale fields; create ConsumptionBasis; create InventoryOperation; add Sale cancellation link and Sale checks; add deferred snapshot/posting/movement relationships; add rate constraints; add operation history index and operation constraints; add consumption constraints; add financial index/constraints; add movement constraints. Exact individual order is reproduced in the schema reference. Dependencies: ingredient 0004, product 0004, sale 0002 and swappable auth user.

There is no RunPython, RunSQL, backfill, deletion, rename, removal, squash or rewrite of an existing migration. Generated state matches current models. Numeric widening preserves all representable old two-decimal balances exactly. Additive DDL can still take table locks or rebuild tables on SQLite; static review does not measure that cost. New nonnegative checks can reject an existing invalid negative balance; future preflight must report such records and STOP, never silently correct them.

## 3. Transaction, identity and compatibility behavior

The command service validates request shape/values first, then uses one `transaction.atomic()` for each sale creation/edit/cancellation or stock adjustment. Transaction-dependent validation and projected balances are checked under locks before business writes. Basis counter persistence, sale/original lines or current projection, operation identity/result, consumption/reversal markers, stock/revisions/movements and financial posting commit together or all roll back. A losing UUID uniqueness race is caught **outside** that entire transaction; it cannot retain stock writes or orphan sales. Successful idempotent replay takes priority over stale-revision rejection. Different successful identities for a stale revision receive 409.

Lock order: existing Sale first, then all involved Products by PK, Ingredients by PK, then ConsumptionBasis rows by PK. Recipe API writes take the same Product lock and reload existing recipes after locking. Recipes cannot be transferred to another product; create a separate recipe. Ingredient metadata/deletion take ingredient locks; quantity replacement is rejected in favor of the command endpoint, and tracked unit changes are rejected. Existing tracked quantities/units are read-only in admin, and history admin views are read-only. Basis creation serializes behind locked ingredients; its unique rate constraint is an additional guard. PostgreSQL lock/concurrency behavior has **not** been verified for these new paths.

API create requires `Idempotency-Key: <UUID>`. Edit/cancel additionally require `If-Match: "<revision>"`; revisions are decimal strings in JSON to avoid JavaScript integer loss. DELETE now means soft cancellation and requires a reason body. Stock uses POST `/api/ingredients/{id}/adjustments/` with exact signed decimal `delta`, reason, identity and expected stock revision. Generic ingredient edit cannot replace stock. A reused UUID with another validated intent/action/target/revision gets 409. Identity uniqueness is actor-scoped; two actors submitting different identities represent different business operations unless cancelling the same sale. Retry callers must preserve the same authenticated actor and identity. Failed validation does not reserve an identity because it committed no operation.

Frontend changes are compatibility changes: persistent per-user/session request UUID/revision, stock decimal-string arithmetic, cancellation reason/status, server financial totals and explicit history labels. Session storage is not the database idempotency mechanism. An uncertain network outcome retains its identity; attempting a different payload with it is refused. Full uncertain-payload recovery across tabs/devices is not implemented; automatic retries must reuse the exact original payload. No UI redesign was undertaken.

**Unapplied-schema compatibility:** this working branch expects the new columns/tables. It must not be run or deployed against an unmigrated application database. No rolling old/new writer compatibility is claimed. Any later release needs coordinated writer shutdown, authorized backup/preflight/migration, new code, smoke checks and readback. This checkpoint authorizes none of that.

## 4. Exact inventory and financial examples

Each ingredient's `unit` is its declared base unit: kg, g, l, ml, pcs, cup, tbsp or tsp. A recipe quantity is expressed in that same ingredient unit. There is no automatic kg/g, volume/mass, or piece conversion; tracked units cannot change. All allowed units currently support fractional quantities, including pcs. Physical whole-piece-only rules would require a separately reviewed restriction.

Stock/snapshots/deltas: Decimal(20,9), quantum `0.000000001`, maximum `99999999999.999999999`. Recipe batch quantities retain Decimal(10,2); integer yield is 1..2147483647. Allocation counters are 0..9223372036854775807. For rate B/y, compute `R(n) = HALF_UP(B * n / y)` to nine decimal places by exact **integer quanta/divmod**, not binary floats or a repeating Decimal division. New applied quantity is `R(cursor + units) - R(cursor)`. The cursor only advances. Decimal arithmetic uses local precision 50; stock additions/subtractions use integer quanta. Inputs with excess fractional places, rates below a quantum per sold unit, counter overflow, snapshot/balance overflow or insufficient projected stock are rejected. Stock is never clamped to zero.

Example rate `0.01 kg / 3 units`, starting balance `1.000000000 kg`:

| Operation | Exact signed stock delta kg | Balance kg | Lifetime cursor | Active units |
| --- | --- | --- | --- | --- |
| Sell A, one unit | -0.003333333 | 0.996666667 | 1 | 1 |
| Sell B, one unit | -0.003333334 | 0.993333333 | 2 | 2 |
| Sell C, one unit | -0.003333333 | 0.990000000 | 3 | 3 |
| Cancel B | +0.003333334 | 0.993333334 | 3 | 2 |
| Sell D, one unit | -0.003333333 | 0.990000001 | 4 | 3 |
| Cancel A, C and D | +0.009999999 | 1.000000000 | 4 | 0 |

No surviving sale's quantity is changed when B is cancelled. Three initial allocations sum exactly to 0.010000000. After cancellation, active snapshots need not equal `R(active_units)`; their **stored applied sum** is authoritative. Telescoping allocation across an uninterrupted cursor is distinct from exact cancellation of previously applied allocations.

Update example with the same rate: after A/B, balance is 0.993333333 and cursor 2. Change B from one to two units: credit B's exact 0.003333334, allocate cursor interval [2,4) = 0.006666666, net delta -0.003333332, resulting balance 0.990000001, cursor 4. Cancel A and replacement B: credit 0.003333333 + 0.006666666, restoring 1.000000000. Old B remains a reversed snapshot. If the rate changes to 0.02/3, replacement allocation uses a separate rate basis while the old snapshot is still reversed exactly. Price-only edits do not reallocate inventory.

Concurrent allocation example: three competing one-unit sales must serialize through ingredient/basis locks and receive distinct [0,1), [1,2), [2,3) intervals, in whichever order obtains the locks. Exactly one gets 0.003333334; total deduction must be 0.010000000. Cancellation races must credit each snapshot once. This is the required expected behavior and is defined in PostgreSQL tests; it is **not yet an observed database result**.

Money is PHP Decimal(10,2), maximum absolute single posting/current sale value 99999999.99. Prices must have cent precision and be positive; fractional cents are rejected rather than silently rounded. Line extensions and posting differences use exact Decimal arithmetic. Report aggregates can exceed a single posting's field capacity. Legacy original totals remain a separate read-only source, including zero/negative historical values with a nonpositive-record count; those values are not turned into new gross postings.

Option B signed convention:

`gross_sales = sum(positive gross postings) + preserved legacy source totals`

`sales_adjustments = sum(signed edit postings)`

`signed_cancellations = sum(negative cancellation postings)`

`cancellation_amount = -signed_cancellations` (positive display magnitude only)

`net_sales = gross_sales + sales_adjustments + signed_cancellations`

Equivalent display formula: `gross_sales + sales_adjustments - cancellation_amount`. Never subtract signed_cancellations or subtract both representations.

Nov 9 original sale 150.00: gross +150.00. Nov 10 price/quantity correction to 180.00: adjustment +30.00. Nov 11 cancellation: -180.00. Across all dates: gross 150.00, adjustments 30.00, signed cancellations -180.00, displayed cancellations 180.00, net 0.00. Nov 9 net remains 150.00; Nov 11 net is -180.00. Cancellation creates no Expense, payment, refund or cash claim. Sale.date is retained; gross uses original date, edits use commit-command local business date, cancellation uses cancellation-command local business date. Edit/cancellation dates use the operation timestamp in the configured Asia/Manila timezone; retry replays preserve that date. Date changes require a separate financial correction workflow and are refused here.

The summary/dashboard read only `financial_tracking=legacy_source` original totals plus SaleFinancialEntry postings filtered to financial_tracking=ledger sales. A tracked sale's original total is **excluded** from the legacy source, preventing transition double counting. Summary reports expose gross, adjustments, signed cancellations, displayed cancellations, net and legacy contribution. History list/CSV/PDF retain transactions, include cancellation status and are explicitly labelled as history rather than posting-date net sales. The dashboard's existing total_sales compatibility key now represents net sales; product mix is separately scoped to current recorded items by original date. Existing expenses/profit labels are not a complete accounting or cash-refund system.

## 5. Preservation, reconciliation, backup and rollback

No existing sale, line, original price, total or date is backfilled, deleted or rewritten by these migrations. Existing records default to legacy_unknown/legacy_source/revision 0; nullable projections/anchors remain NULL. A legacy sale can receive notes-only audited edits. Item/price/date changes and automatic cancellation/reversal are blocked until a separately reviewed reconciliation process exists. Merely consulting today's recipe is never sufficient evidence. No legacy-to-ledger transition endpoint exists in this package.

Reconciliation procedure (documented, not executed on production):

1. Export an immutable inventory of original sale IDs/dates/totals/lines and ingredient balances/units from an authorized environment; retain hashes, timestamp and operator. Identify discrepancies between stored totals and line sums without changing either. Classify unavailable consumption history explicitly.
2. Gather contemporaneous trustworthy records if available; do not substitute current recipes. Keep unverifiable sales immutable for inventory/financial corrections. Obtain separately approved, evidenced resolution for each historical discrepancy; no automatic migration is proposed to do so.
3. Establish a physical stock count in each declared unit. Any approved correction is a **new dated stock adjustment** with observed quantity, reason and actor, not an invented historic sale movement. The first tracked operation's opening anchor is the observed stored balance at that moment; it is not certification that all prior stock was correct.
4. For tracked stock, verify `opening_quantity + SUM(movement.quantity_delta) = current quantity`, consecutive nonzero stock revisions, each ordered `balance_after`, and matching unit. For a sale operation, net movement must equal exact snapshot credits minus new allocations for each ingredient. For each basis, active_units must equal unreversed snapshot units, cursor intervals must never overlap or rewind, and cancellation reversal markers must be unique.
5. For tracked finance, verify one original gross posting, nonzero signed adjustments, at most one cancellation, correct effective dates, and posting sum equal current recorded sale value or zero for a cancelled sale. Verify cancellation operation/link/status/posting/snapshot reversals agree. Legacy totals and ledger totals must be disjoint; do not reclassify a legacy sale before an approved transition protocol atomically changes its report source.
6. Produce a discrepancy report and freeze affected mutations rather than repairing silently. Cross-table invariants require reconciliation; database checks cannot express every cross-table sum.

Before any later authorized real-environment migration: stop writers, take a full logical/schema backup including migration history and media references, encrypt/store it outside the change target, record checksums/row counts and prove restore into a separate authorized environment. Preflight actual negative/invalid stock and sales, retained IDs/prices/totals, original money precision and table sizes. These backups/preflights have **not** been run on production.

Rollback before migration execution is code-only: return to preserved 32d2df3 (or the appropriate reviewed prior code) without deleting current work. Once migrated but still unused, rehearsal may reverse sales 0003 then ingredient 0004 on disposable data; the autogenerated reverse order removes checks/relationships/tables before narrowing quantity. Inspect the migration plan first. Once any tracked transaction exists, reversing would **delete new audit history**, and narrowing nine-decimal stock to two decimals can round/overflow. Do not use that as a business rollback. Preserve schema/audit records and prefer a forward fix or restore the full verified backup with separately approved recovery/replay. No rollback or restore has been executed here.

## 6. Tests and actual results without migrations

| Check | Actual result | Evidence |
| --- | --- | --- |
| Django system check with dummy backend and denied connection/cursor entry points | No issues; zero connection attempts | [review log](phase1a3/evidence/review-without-database.txt) |
| Arithmetic + model metadata unittest suite | **42 pass**, 0 failures/errors; no Django DB test runner | [JSON results](phase1a3/evidence/review-results.json) |
| Pure frontend exact stock preview checks | **10 pass**, no server/database | [preview checks](phase1a3/evidence/stock-preview-tests.txt) |
| Model/migration drift, dependency conflict and additive-operation inspection | Pass statically; no SQL/schema editor/migrate executed | [migration manifest](phase1a3/evidence/migration-operations.json) |
| TypeScript + Vite production build | Pass; existing CSS import-order and chunk-size warnings | [build output](phase1a3/evidence/frontend-build.txt) |
| New identity/quantity helpers ESLint | Pass, exit 0 | [helper lint](phase1a3/evidence/new-frontend-helpers-lint.txt) |
| Read-only source/evidence review | 97 Python sources parse; prior evidence and existing migrations unchanged; ten ported blocker assertions unchanged; 33 new API/concurrency definitions not executed | [static review](phase1a3/evidence/static-source-review.json) |
| API integration/exception injection/database constraints/new-schema PostgreSQL races | **NOT RUN — authorization withheld** | Test definitions in backend/sales/tests.py and test_release_blockers.py |
| Production reconciliation, backup/restore, migration timing, browser E2E | **NOT RUN** | Outside this checkpoint |

Pure tests cover exact middle cancellation, changes/updates/rate independence, 2,000 deterministic allocation/reversal steps, low Decimal context, overflow, insufficiency, signs, cent validation, cancellation-period totals and legacy preservation. Existing earlier arithmetic experiments remain preserved, but their older pooled active-count helper is explicitly not used by the approved command service. Metadata tests inspect the proposed constraints; they do not prove database enforcement. New API definitions include invalid/successful/failed create/edit/cancel, replay/conflict/stale requests, changed/removed recipes, legacy guards, original price/line retention, fractional allocation, failures before/after actual writes and signed financial reporting. PG definitions cover last stock, duplicate/conflicting identities, independent-stock unique-key collision, stale edits, cancellation uniqueness, fractional concurrent conservation and direct adjustment/sale locking.

The following ten prior integrated API requirements remain **explicit release blockers**. Their last observed PostgreSQL result was ten failures, preserved under phase1a2/evidence. None has a passing result for this implementation:

1. Insufficient stock rejects the entire sale.
2. Same successful request identity replays the original sale once.
3. Conflicting payload with the same identity is rejected.
4. Cancellation after recipe change restores original consumption.
5. Three separate fractional sales consume exactly one batch.
6. Cancellation preserves original sale/items and duplicate cancellation cannot repeat restoration.
7. Unverifiable legacy sale is not automatically restored.
8. Competing sales allow only one to consume the final stock.
9. Concurrent duplicate requests create only one sale.
10. Concurrent stale edits reject the second revision.

[test_release_blockers.py](../backend/sales/test_release_blockers.py) versions the same ten tests with unchanged assertions and only the now-required cancellation reason in the request fixture. The old source/evidence is untouched. A future actual passing API run, including PostgreSQL-only cases, is required to close each blocker; 42 pure/metadata passes do not close any of them.

Allowed reproduction now (repository root; no databases):

```powershell
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a3/review_without_database.py
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a3/write_schema_reference.py
node docs/phase1a3/test_stock_preview.mjs
# Frontend build from frontend/: npm run build
```

Do not run old audit/1A/1A.2 DB/browser runners at this checkpoint: they may initialize databases, run migrations or overwrite earlier evidence. The shared test settings reject CLI test/migrate entry points; the review harness additionally uses Django's dummy backend and denies connection/cursor access. This is a workflow guard, not a security boundary for arbitrary Python commands.

## 7. Remaining risks and decisions

- No new migrations have been applied. FK/check/partial-unique behavior, SQL arithmetic, round-tripping, atomic rollback, idempotency races, lock order and actual API responses still require disposable database verification. SQLite numeric storage is not proof of PostgreSQL stock consistency.
- Raw SQL, QuerySet.update/delete and external writers can bypass model immutability/cursor guards and cross-table invariants. Existing SaleItem CASCADE is preserved rather than retroactively rewritten. Dedicated restricted writer privileges/triggers are not implemented; no claim of tamper-proof history. Production use requires reviewed database access policy and reconciliation.
- `current_items` JSON is intentionally not a sixth relational line-version table. Its structure, relation agreement and cross-table balances are service/test/reconciliation invariants. Reporting over large histories currently materializes rows/projections; volume/performance limits are unmeasured.
- The existing unsupported Django/dependency/security findings and AUTH-01/02 remain high priority in separately reviewed work. No secure/production-ready claim is made. Frontend build warnings and historical lint findings remain; no broad dependency/UI cleanup was attempted.
- No cash refunds, financial date corrections, legacy migration/reclassification or automatic physical unit conversion workflow is implemented. Legitimate recipe-free products and units smaller than the supported quantum require an explicit later business policy; current sale commands fail closed. A rate/counter exceeding supported precision is rejected rather than redistributed or reset.
- Concurrent receipts/adjustments can make an exact old cancellation exceed the stock field maximum; the whole cancellation is rejected until an explicit correction is agreed. No silent truncation. Deadlocks/timeouts propagate as failed atomic commands, without automatic blind retries; the same stable identity is required for retry.
- Financial edits are dated on the edit business date, preserving the original gross date. Cancellation is dated on its command business date. Legacy nonpositive totals are preserved and flagged, not legitimized as new postings. Historical discrepancies need owner-led evidence/reconciliation rather than an automatic repair.
- Authorization pending: execute these two migrations and integration/concurrency tests **only in disposable PostgreSQL and SQLite**. No production migration/deploy permission is requested or inferred. No other business decision blocks the authorized implementation; later reconciliation/refund/date-correction workflows remain separate scope.

## 8. Proposed next authorized work package: disposable migration/integration verification

This procedure is proposed, **not executed**, and requires the owner's next explicit approval:

1. Keep current review commit/evidence and record migration file hashes. Remove the execution guard only after that approval; create a new evidence directory rather than rerunning old scripts against old evidence.
2. Start a fresh local disposable PostgreSQL 17 container with random database/password/name, loopback-only random port, local Docker context validation, no host data volume, no production environment/credentials and bounded memory/CPU. Record exact image/version/locale/isolation/timezone, with secrets excluded. Default test isolation should match the intended READ COMMITTED production setting; evaluate other settings separately.
3. In that database, apply **only old migrations** first to create an upgrade fixture using historical model state. Add isolated synthetic legacy sales/items/prices/zero totals and two-decimal stock; retain a baseline export/hash. Take a disposable logical backup and prove restore into a second disposable database. This is fixture data for migration tests, not Phase 2 demo generation.
4. Inspect the migration plan, then apply the generated ingredient 0004 and sale 0003. Verify every old value/ID/price/date survives, legacy defaults/null anchors are correct, no consumption/movement/posting history is invented and a second migrate is a no-op. Inspect SQL constraints/indexes, numeric types and invalid-write rejection. Exercise a negative-stock preflight fixture: migration must fail rather than repair it; never run that fixture on real data.
5. Run the ten versioned release-blocker API tests plus the new API/rollback suite and previously approved 1A.1 behaviors through the updated API contract. Check each blocker separately; preserve actual pass/fail counts and complete failure traces. Test out-of-range decimals, legacy source separation, original pricing, price-only edits, missing/changed recipes, no-refund cancellation and full state snapshots after every injected failure.
6. Run all PG concurrency definitions with independent backend PIDs, bounded statement/lock timeouts and request-start barriers. The disjoint-stock UUID test additionally synchronizes **before identity insertion** to force a genuine unique-key race without a shared-stock-lock barrier. Repeat schedules and add reversed-order multi-product inputs; check movement/snapshot/counter/finance invariants after every run. Observe actual lock contention and capture deadlocks/timeouts as failures, never skipped success. Include cancellation vs edit, recipe change vs sale, stock adjustment vs sale and exact fractional reversals under competing commands.
7. Repeat migration/legacy-preservation and sequential API regression tests on isolated SQLite; report PostgreSQL-only concurrency skips explicitly. SQLite results never replace PostgreSQL validation.
8. Rehearse unused-schema reverse migrations only on disposable copies, and test forward-fix/backup restoration after fractional writes while retaining audit history. Record why destructive schema reversal is not a safe post-use rollback.
9. Run a local browser/API smoke test against the migrated disposable backend and repeat the frontend build. Verify status/reasons/identities/revisions, stock strings, reporting date filters and no duplicate mutation on uncertain retries. Run reconciliation readbacks with exact examples and capture all results in new evidence.
10. Stop for owner review with actual migrations/tests/reconciliation/remaining risks. Do not begin security package, Phase 2, redesign, SEO or deployment automatically. The separately reviewed AUTH-01/02 package remains proposed after stock consistency is verified and reviewed.

## Changed files

The complete path list is the `files_changed` array in [static-source-review.json](phase1a3/evidence/static-source-review.json).

Backend: sales models/services/serializers/views/URLs/admin/inventory_math; new financial_math/reporting/pure/schema/release-blocker tests; revised API/concurrency tests; ingredient models/serializers/views/URLs/admin; recipe views/serializer product immutability; dashboard financial integration; dummy schema-review settings and test-execution guard; the two new migrations.

Frontend: sale and ingredient services/types/hooks; new stable-operation identity and exact stock-quantity helpers; sale/ingredient forms/list stock dialog, cancellation dialog/row status and dashboard metric labels. Changes support the new transaction contract and reporting semantics.

Documentation: this checkpoint, generated exact schema/operation manifest, database-free review/preview scripts and evidence; latest roadmap/test results/changelog/decisions/status/checklist/database-schema links. Prior audit and Phase 1A.1/1A.2 evidence remains intact.
