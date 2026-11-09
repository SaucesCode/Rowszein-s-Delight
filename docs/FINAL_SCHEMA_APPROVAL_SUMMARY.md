# Final schema approval checkpoint — Option B and exact historical reversal

Status: **review summary only. Database implementation, migration creation/application and production actions remain unauthorized.** This document incorporates the owner's latest decisions. It does not implement them or replace earlier test evidence with claims of completion.

The previous four-record design assumed cancellation reporting Option A if approved. The owner has now selected **Option B**, so that design is not sufficient unchanged. Its earlier one-quantum cancellation rule also needs refinement to meet the requirement for exact historical reversal.

## The five exact outstanding decisions from PHASE1A2_FINAL_DATABASE_DESIGN.md

The following are reproduced exactly; the disposition below each reflects the latest owner instruction.

1. Approve/revise **every field, constraint, index and retention relationship** above, including the completed-only identity race protocol and reduced precision-change scope.

   **Disposition:** approval remains pending. The four inventory records are summarized below; Option B requires separately approving the financial extension. No schema implementation is implied.

2. Confirm the fractional policy: nine-decimal stock, two-decimal batch/money inputs, cumulative HALF_UP, minimum one-quantum rate, fractional pcs and one-quantum cancellation allocation differences.

   **Disposition:** nine-decimal cumulative allocation is conditionally approved, but exact historical reversal is now mandatory. The old one-quantum cancellation difference must not be treated as approved. The revised exact-snapshot rule below requires review and new integrated tests.

3. Select financial reporting **A or B** before cancellation activation; neither is silently applied.

   **Disposition:** **resolved: B — cancellation-date reversal.** Do not ask the owner to select A/B again. Gross sales, cancellation reversals and net sales must be separately reported. Cancellation does not prove a cash refund.

4. Confirm legacy corrections remain independent approved current-stock adjustments; unverifiable legacy cancellation remains blocked until a separate financial correction policy exists.

   **Disposition:** safeguard principle approved. Never fabricate consumption/movements or use current recipes as historical evidence. The reconciliation procedure below preserves that boundary; financial-only correction of a legacy sale is not automatically authorized.

5. State the next authorization explicitly: model implementation, migration generation/review, or migration execution in disposable environments. **No new migration generation/application or production action is implied by conditional design approval.**

   **Disposition:** **still pending.** No model/schema implementation, migration generation or migration execution is authorized by the latest message. Stop at this checkpoint.

## The four proposed inventory persistence models

All four use BigAutoField primary keys, protected references and append-only history after commit, except the explicitly mutable pooled counter. No raw SQL immutability guarantee is claimed. Their exact earlier field/index specification remains a proposal, not implemented schema.

| Model | Proposed contents and relationships | Required uniqueness / integrity |
| --- | --- | --- |
| **InventoryOperation** | Actor FK; client UUID; action; nullable target Sale/Ingredient FKs; normalized SHA-256 fingerprint; reason; schema version; before-snapshot; exact successful HTTP status/body; timestamp. Only completed results commit. | Immediate UNIQUE(actor, client_key); valid action/target/status; required cancellation/adjustment reason. A uniqueness-race loser rolls back its entire business transaction before replay/conflict handling. |
| **ConsumptionBasis** | Product and Ingredient FKs; original declared unit; immutable batch quantity Decimal(10,2) and yield; mutable active_units counter. No FK to a mutable recipe definition. | Unique product/ingredient/unit/batch/yield; positive rate/yield, nonnegative bounded count, proposed minimum per-unit stock quantum. Counter must reconcile with active stored allocations. |
| **SaleConsumption** | Sale FK; consumption revision; basis FK; allocated units. **Exact-reversal refinement: add immutable applied_quantity Decimal(20,9)** recording the actual stock quantity assigned to that allocation. | Unique sale/consumption-revision/basis; positive units/applied quantity; never overwrite old snapshots. Current effective allocations determine what may be reversed. |
| **StockMovement** | Operation and Ingredient FKs; stock revision; original unit; signed Decimal(20,9) delta; resulting balance. One net movement per ingredient/operation, with component allocation IDs/amounts retained in the operation snapshot. | Unique operation/ingredient and ingredient/stock-revision; nonzero delta; nonnegative resulting balance. Cancellation credit must equal the sum of the active sale's stored applied quantities for that ingredient, not a recomputed current-recipe estimate. |

Existing-table proposal: retain original Sale/SaleItem IDs and historical prices; add Sale tracking/status/revision/cancellation-operation metadata and **a consumption_revision pointer** so metadata-only edits can keep the same original allocation snapshots without creating reversal aliases. Widen only Ingredient.quantity to Decimal(20,9), add stock revision and observed-balance anchor fields; leave minimum_stock, recipe input quantities and existing money fields at two decimals. All of these remain unimplemented and require approval.

No stock-changing path may bypass the eventual service: sale creation/edit/cancel, direct adjustments and admin operations must validate before writes, use one atomic transaction and deterministic row-lock order, recheck revisions and reject insufficient stock. Historical snapshots remain independent of current recipes. Refunds, suppliers and a redesign are not included.

## Option B requires a separately approved financial persistence record

**Recommendation: a fifth model, SaleFinancialEntry.** The four inventory records alone cannot provide a constrained, independently queryable signed financial timeline. Do not hide financial postings in inventory quantities, repurpose expenses, create negative sales, zero original prices, or rely on unvalidated JSON as the sole reporting ledger. The fifth model is a design proposal, not an assumed extension of four-model approval.

Proposed minimal fields:

| Field | Proposed definition / purpose |
| --- | --- |
| id | BigAutoField primary key |
| sale | Nonnull protected FK to the original Sale |
| operation | Nonnull protected OneToOne to InventoryOperation; at most one financial posting per operation |
| sale_revision | Nonnull positive bigint identifying the version posted |
| kind | gross_sale, sale_adjustment or cancellation |
| effective_date | Business date of the financial posting, separate from original sale date |
| amount | Signed Decimal(10,2), PHP; gross positive, cancellation negative, adjustment nonzero with either sign |

Attribution, reason and recorded timestamp come from InventoryOperation. Proposed constraints: allowed kind; positive revision; appropriate sign; UNIQUE(sale, sale_revision); at most one gross entry and one full-cancellation entry per sale through conditional unique constraints. Proposed reporting index: (effective_date, kind, id). The sale FK needs lookup coverage; the operation OneToOne already supplies its unique lookup index. Exact generated SQL/index inventory still requires review after migration generation is explicitly authorized.

### Posting/reporting contract

- Creation posts positive gross value on the sale's business date. Original sale/items/prices and this posting remain preserved.
- A price/quantity correction posts its signed difference as a separate sale_adjustment on the correction date, rather than rewriting previously posted amounts. Report adjustments explicitly. Backdating or moving an already posted sale date needs a separately approved correction policy.
- Cancellation posts the negative of the sale's outstanding recorded value on the **actual cancellation business date**. Retain original positive posting and prior adjustments. Record cancellation actor/reason/time. No duplicate posting or stock credit on retry.
- For a selected period: **net sales = gross sales + signed sales adjustments − cancellation amounts**, where cancellation amounts are displayed as positive magnitudes of negative cancellation entries. Provide separate gross, adjustment, cancellation and net figures.
- Example: PHP150 gross on Nov 9, PHP30 positive correction on Nov 10, full cancellation on Nov 11. Nov 9: gross150/net150; Nov 10: adjustment+30/net30; Nov 11: cancellation180/net−180. Across all three days: gross150 + adjustments30 − cancellations180 = net0. The original sale was not erased.
- A cancellation posting is **not a cash refund**. No payment/refund evidence exists in the current schema; show refund status as not tracked/unknown, not an inferred payment or automatic expense. Actual refunds require their own approved recorded transaction/workflow.
- Use the shop timezone, Asia/Manila, for effective dates and retain UTC operation timestamps. A retry after midnight replays the original stored result/date; server-derived dates must not change the client intent fingerprint on replay.

### Legacy financial source

Recommendation: add an explicit Sale.financial_tracking marker, default legacy_source for existing rows and ledger for newly posted sales. Historical gross remains sourced from preserved legacy Sale totals/dates, without synthetic financial/inventory backfill or double counting. New gross/adjustment/cancellation amounts come from SaleFinancialEntry. Freeze legacy monetary/date corrections until an explicit financial correction workflow is approved; notes-only changes do not alter posted revenue.

This marker and mixed-source cutover reporting are **additional schema/reporting changes requiring approval**. Verify legacy report equivalence read-only first; do not silently repair existing subtotal inconsistencies or recalculate historical prices. Unverifiable legacy stock cancellation remains blocked. Financial-only legacy cancellation must be separately approved and must never imply an inventory reversal or cash refund.

The former four-table/32-column/14-index totals are therefore **not a complete Option B schema** and must not be approved as though unchanged.

## Exact historical inventory reversal versus cumulative rounding

Original example: B=0.01 kg, yield=3; separate sales consume A=0.003333333, B=0.003333334, C=0.003333333 kg. They total exactly 0.010000000 kg.

If B is cancelled, exact reversal credits **0.003333334 kg**, leaving A+C consumption of **0.006666666 kg**. Re-rounding two active units as a pooled total gives **0.006666667 kg**. Those results differ by one quantum. A single net credit cannot both exactly negate B's historical deduction and force the remaining total to the old pooled-rounding invariant.

**Recommended refinement for approval:** cumulative HALF_UP allocation when assigning new consumption; snapshot each allocation's exact applied quantity; edits/cancellations reverse that exact stored quantity. Never silently rebalance surviving historical allocations or invent a rounding stock adjustment. Track/reconcile surviving applied quantities against their immutable snapshots. Metadata revisions reuse their consumption_revision pointer. An inventory-changing edit records an exact reversal of the old allocation followed by a newly allocated snapshot, all within the same transaction.

Consequences requiring explicit acknowledgement:

- Ledger conservation and exact historical reversals hold in stored quanta: opening balance + all signed movements = current stock; cancelling all relevant allocations restores their exact original deduction total.
- After partial cancellation, surviving actual allocations can differ from the freshly rounded theoretical active-unit total. The earlier “at most half a quantum per basis” claim no longer applies to that surviving set; do not advertise it under this refinement.
- Stock uses explicit declared base units and nine decimal places. No kg/g, l/ml or weight/volume conversions occur automatically. Money remains PHP cents, independently validated.
- The previously passing arithmetic/locking experiments validate the **earlier pooled cancellation rule**. They do **not** validate this exact-snapshot refinement or Option B financial postings. New desired-behavior, conservation, migration and PostgreSQL concurrency tests are required after the design/implementation is authorized.

An alternative is to record an exact reversal plus a separate, visible one-quantum rounding adjustment. That preserves the old pooled total but changes surviving stock allocation policy. It is **not selected or silently authorized**; the recommendation above prioritizes the owner's exact-reversal requirement without hidden adjustments.

## Legacy reconciliation procedure

1. Preserve original transaction IDs, dates, item prices and known source records. Mark inventory consumption unverified; reject automatic stock-affecting edits/reversals without trustworthy snapshots.
2. Gather independent historical batch/unit/yield/movement evidence. A current recipe or present-day stock count is not proof of that sale's consumption.
3. Obtain an owner-reviewed physical count and a precise proposed current-stock correction, with units, reason, evidence and expected stock revision.
4. Apply only that separately approved correction through an idempotent stock_adjust operation under locks once the approved service exists. Record before/after quantities and attribution.
5. Keep the legacy sale unverified; do not manufacture historical consumption rows, opening receipts or refunds. Approve any financial-only correction separately.

## Revised migration, backup and rollback plan — proposal only

1. Obtain final approval of the revised schema, fifth financial record, exact-reversal policy, financial-source marker and posting/reporting contract. Implementation authorization and migration-generation authorization must be explicit; neither is inferred here.
2. With authorization, generate additive migrations for ingredient precision/revisions/anchors, then sales tracking/revisions/four inventory tables/cancellation link and exact applied snapshots, then the financial-entry table/marker/constraints/indexes. The old two-migration plan needs revision for Option B. Do not edit already-applied migrations.
3. Preflight an authorized nonproduction copy read-only: quantities/rates/units/bounds, sale totals and legacy financial source consistency. Halt on invalid data; do not clamp, invent history, backdate reversals or silently reconcile prices.
4. Defaults preserve existing rows as legacy/unverified. Widen quantities exactly. Create empty new ledgers; no fabricated historical inventory or financial backfill. Capture current balance anchors as observations only. Exact field/index SQL and migration dependencies must be reviewed before any new migration is applied.
5. After separate disposable-execution authorization, test forwards/reverse migrations, original-data preservation, ledger/report reconciliation, duplicate/conflicting requests, stale edits, injected failures and real multi-connection PostgreSQL races. Passing fixture experiments is not acceptance of the integrated system.
6. Before any separately approved production cutover: consistent backup, isolated restore rehearsal, recorded schema/code versions, coordinated clients/backend, write pause, legacy/new report reconciliation and exclusive new-writer activation. No production backup/migration/deployment is authorized now.
7. Before new-ledger use, reversal is permissible only if new tables/markers are unused and all quantities fit original bounds/two-decimal precision without rounding. After tracked stock/financial postings, do not drop history, shrink decimals or restore the old writer. Prefer a forward fix; a disaster restore requires a consistent verified backup plus an explicit plan for post-backup operations. Never erase cancellation-date reversals or silently lose a quantum during rollback.

## Release blockers and current authorization

All **10 failing integrated PostgreSQL API requirements remain explicit release blockers**: insufficient stock; successful-request replay; same-key payload conflict; recipe-independent reversal; fractional conservation; retained/replayable cancellation; unverified-legacy guard; competing last-stock sales; concurrent duplicates; stale concurrent edits. Their status has not changed. AUTH-01/02 and dependency issues also remain unresolved.

No tests were rerun for this documentation-only checkpoint. No model, migration, test expectation, arithmetic implementation, financial query, frontend, production data or deployment setting was changed. The new Option B/exact-snapshot refinements have not been implemented or proven.

**Approval requested:** revised schema including the four inventory records, fifth financial-entry record and additional snapshot/source fields; exact stored-quantity reversals; Option B posting/reporting/cutover semantics; and the precise next implementation/migration permission. **STOP here.** Migration creation/application, deployment and production changes remain unauthorized until explicitly approved.
