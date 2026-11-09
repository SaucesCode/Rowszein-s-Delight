# Phase 1A — mandatory database design checkpoint

Status: **PROPOSAL ONLY; owner approval required. No model/schema changes or new migrations have been implemented.**

The owner approved sales/inventory integrity only and required: “STOP for approval before applying schema changes.” The schema-free validation/rollback package is complete; full Phase 1A is not. [PHASE1A_PROGRESS.md](PHASE1A_PROGRESS.md) records the actual implementation and tests.

## Why persistence changes are necessary

The existing tables cannot tell whether a particular sale consumed inventory, which recipe/unit/yield it used, what was actually deducted, or whether a retried request already committed. More decimal places alone still accumulate per-request rounding error. Transactions alone do not provide idempotency or recover historical facts.

Recommended design: retain current business tables, introduce four narrowly scoped records, and extend sale/ingredient metadata. Do not create suppliers, refunds, finished-product stock, or new accounting features.

## Proposed schema

| Entity | Proposed fields / constraints | Purpose |
| --- | --- | --- |
| **Sale** (existing) | Add `inventory_tracking` (`legacy_unknown` / `tracked`), `status` (`recorded` / `cancelled`), `revision` nonnegative integer, nullable `cancelled_at`. Existing IDs, dates, notes, totals and SaleItems remain. | Distinguish unknowable historical consumption, retain cancelled records, and reject stale concurrent edits. New tracked sales start revision 1; existing rows start revision 0. |
| **Ingredient** (existing) | Widen `quantity` and `minimum_stock` to Decimal(20,9). Add `stock_revision` nonnegative integer and nullable `ledger_opening_quantity` Decimal(20,9), `ledger_started_at`. | Represent small deductions, detect stale stock updates, and anchor future ledger reconciliation to an observed current balance. No historical reconstruction. |
| **RecipeIngredient** (existing) | Widen `quantity` to Decimal(20,9); keep its existing ingredient FK/unit interpretation. | Allow recipe quantities to use the same precision as stock. No unit conversion or automatic cost change. |
| **InventoryOperation** (new) | UUID PK; actor FK protected; client key UUID; action; target sale/ingredient identifiers; SHA-256 normalized request fingerprint; immutable before/after snapshots; HTTP response status/body; timestamp. Unique `(actor, client_key)`. | Durable retry identity, actor/reason trail and historical sale-item/pricing snapshots without a separate generic event framework. Target sale FK is nullable/protected for stock-only operations. No committed “in progress” rows. |
| **ConsumptionBasis** (new) | Product and ingredient FKs protected; original ingredient unit; immutable batch quantity Decimal(20,9) and positive batch yield; mutable nonnegative `active_units` BigInteger. Unique `(product, ingredient, unit, batch_quantity, yield_quantity)`. | Preserve the original consumption rate even if a recipe is changed/deleted. Pool fractional allocation across repeated sales of the same formulation, preventing rounding loss. The count must equal current active SaleConsumption allocations. |
| **SaleConsumption** (new) | Sale FK protected; sale revision; basis FK protected; positive units allocated. Unique `(sale, revision, basis)`. Append-only after creation. | Immutable consumption allocation for each sale revision. Previous revisions remain; only the sale's current revision contributes active units. No FK to mutable Recipe/RecipeIngredient. |
| **StockMovement** (new) | Operation FK protected; ingredient FK protected; signed quantity delta Decimal(20,9); unit snapshot; resulting stock balance; timestamp. Unique `(operation, ingredient)`. | Exactly one net movement per ingredient per operation, enabling retry guards and balance reconciliation. Multiple basis changes are aggregated before a movement is written. |

Database checks: stock/opening quantity/minimum stock and counts nonnegative; basis batch quantity/yield and allocated units positive; valid status/tracking combinations; appropriate FK and uniqueness constraints. Signed movement deltas intentionally allow deductions and credits. Bounds must be validated before arithmetic/database writes; overflow must reject the entire operation. Do not include unrelated costing constraints or historical subtotal backfill in this package.

Snapshots store Decimal amounts as canonical strings and retain original unit prices, totals, item identities and relevant product names. Existing SaleItem unit_price and subtotal fields remain authoritative for their current revision; immutable operation snapshots retain prior revisions. Never recalculate past revenue from today's Product.price.

Immutable records are written only through the transaction service; admin/API mutation of ledger/snapshots is disabled. Database privilege hardening is a separately reviewed deployment step. Protect referenced ingredients/products/users from hard deletion; normal deactivation remains possible. This adds a deliberate retention constraint that must be approved.

## Historical records and the cutover

1. Every pre-existing sale becomes **legacy_unknown**; do not create SaleConsumption or StockMovement rows for it. The existing system has no proof of historical consumption, including sales created while the schema-free patch is in use.
2. Existing numeric stock values are widened exactly: e.g. 10.25 becomes 10.250000000. Do not recompute, normalize units, repair negatives, or infer purchases/consumption. Preflight invalid/overflow values must produce a report and halt affected migration/activation; correction requires separate approval.
3. A ledger anchor records only an **observed current balance**, under an ingredient lock at its first tracked operation. It is not a claim about past receipts or historical correctness. It changes no quantity. Future stock must equal that anchor plus subsequent signed movements.
4. Recommended legacy policy: allow notes/date-only edits that cannot affect stock; reject legacy line-item changes and automatic cancellation/restoration with HTTP 409 and an explicit reconciliation-required message. Do not mark a legacy sale tracked merely because it was edited. No generic “force restore” endpoint.
5. If a legacy correction is necessary, an owner must separately approve a counted/verified stock reconciliation, reason and supporting evidence. Never use a current recipe to fill gaps. Until an approved reconciliation workflow exists, such operations remain blocked.

**Approval needed:** the safe legacy policy deliberately restricts existing item-edit/delete workflows for old records. All existing records/prices remain readable. Alternatives require historical source evidence, not code inference.

## Units, Decimal precision and rounding

Recommended stock quantum: **0.000000001 of the ingredient's existing declared unit**. For kg this is 0.000001 g; for g it is 0.000000001 g. This is bookkeeping precision, not a claim about physical measuring equipment. kg/g, l/ml, cup/tbsp/tsp and pcs are **not converted**. Recipe quantities continue to mean the ingredient's own unit; cost_per_unit remains PHP per that same unit. Money stays Decimal with two decimal places. Quantities in API responses remain decimal strings, now with up to nine fractional places; frontend types/validation need a targeted update.

Use explicit local Decimal contexts (precision 50 for bounded intermediate operations), no floats for stock/money, and documented ROUND_HALF_UP at the stock quantum. Validate all integer/count/digit limits. For cumulative batch allocations, use exact integer quanta plus quotient/remainder to decide rounding ties, so a repeating division does not become an approximate tie decision.

### Avoiding cumulative fractional loss

For one immutable basis with batch quantity B, yield Y and current active allocated units N:

`required_stock(N) = round_half_up(B × N / Y, quantum)`

On an operation, derive the **stock delta** from `required_stock(old N) - required_stock(new N)`. Do not round each individual sale's B/Y independently. Store the actual delta in StockMovement and the sale's original basis/units in SaleConsumption. Recipes with changed rates create/reuse a different basis; old allocations remain attached to the old basis.

Example: B=0.010000000 kg, Y=3, three separate one-unit sales:

| Active units | Cumulative consumed kg | This sale deducts kg | Stock from 1.000000000 kg |
| --- | --- | --- | --- |
| 1 | 0.003333333 | 0.003333333 | 0.996666667 |
| 2 | 0.006666667 | 0.003333334 | 0.993333333 |
| 3 | 0.010000000 | 0.003333333 | 0.990000000 |

Total deduction is exactly 0.010000000 kg; no rounding increment is lost. Splitting the same total units into several requests gives the same final cumulative consumption within the same basis. The maximum representation difference for a basis is half a quantum, instead of accumulating half a quantum per sale. Distinct bases retain distinct bounded rounding allocations.

**Cancellation rounding decision:** removing one of the three allocations changes N from 3 to 2 and credits 0.003333333 kg. If that was the sale that originally received the rounding-up quantum, its credit differs from its original applied movement by 0.000000001 kg. The new movement records that fact; the original movement is never rewritten. This preserves the correct rounded total for the remaining two sales. Cancelling all allocations restores the original stock exactly. Blindly negating every original movement can misallocate the rounding quantum among surviving sales; this proposal explicitly chooses cumulative reconciliation.

This is a business/accounting precision policy requiring approval. A simpler “increase decimal places and round each request” approach is not recommended because it leaves INV-06 unresolved. A full arbitrary-rational stock representation would avoid quantization entirely but adds disproportionate complexity. The proposed basis counter is the smallest additional mechanism recommended to prevent per-sale rounding drift.

Fractional pcs currently exist conceptually when recipes divide whole eggs/packaging across yield. Recommended compatibility policy is to retain fractional bookkeeping for pcs; physical purchasing/counting rules remain separate. Do not invent a conversion between volume and weight.

## Sale lifecycle after approval

### Create

Validate request shape, positive quantities/prices, valid dates and finite digit limits first. Require a stable Idempotency-Key. In one atomic transaction, establish/replay the operation identity, lock relevant product/ingredient/basis rows, snapshot the current recipe rate/unit/yield, compute aggregate projected consumption, and check sufficient stock for **all** ingredients before changing sale/item/stock data. Reject missing/invalid recipes unless an explicit noninventory-product policy is approved. No zero-clamping or partial deduction. Save sale/items, consumption allocations, basis counts, movements, stock revisions and successful operation response together. Any exception rolls all of them back, including a provisional idempotency reservation.

### Edit

Require expected sale revision and a new key for this logical edit. Replay checks precede stale-revision checks so a retry can return its original committed response. Under locks, remove the current revision's allocated units from the **stored old bases**, add the proposed revision's new allocations, and calculate the net movement per ingredient. Validate all projected stock before business writes. Append the new consumption/operation snapshots, replace current SaleItems using submitted historical prices, increment revision and commit atomically. Do not persist a temporary restored balance between reversal and rededuction. Notes/date-only edits copy forward the tracked allocation references into the new revision without changing basis counts, stock or movements; legacy metadata edits remain untracked. Reject stale edits with 409.

### Cancel / delete

Recommended: retain DELETE URL as a **logical cancellation**, with the existing success envelope, while retaining Sale/SaleItem data. Mark cancelled, timestamp and increment revision; append movements reversing allocations according to the approved cumulative rounding policy. Same operation key replays the original response without another credit. A different request against an already-cancelled sale returns a conflict without stock changes. No hard deletion and no refund/payment feature.

Cancelled rows remain visible in transaction history with status. Their stored totals/prices are retained, not zeroed. For compatibility with today's physical DELETE behavior, recommend excluding cancelled sales from operational revenue/bestseller totals for the original sale date. Sales lists/exports must distinguish status and exclude cancelled rows from revenue sums. These minimal query/status adaptations are necessary integration work in existing reports, not a dashboard redesign. If accounting-period refunds/reversal-date reporting is desired instead, that is a separate business decision and scope.

### Existing ingredient stock adjustments and recipe changes

A ledger cannot promise reconciliation if current ingredient PUT/PATCH overwrites quantity outside it. Route existing restock/adjustment actions through the same operation/movement service; require an expected stock revision and delta/reason, then lock and validate before applying. Stale full-form quantities must not overwrite more recent sales. Ingredient edits not changing stock must avoid rewriting stock. Keep the present UI workflow, with targeted service/payload adjustments. Admin stock editing must also use that service or be read-only; ORM/admin bypasses cannot be advertised as ledger-safe. Block unit changes after tracking begins; any unit conversion needs a separate reviewed operation.

Recipe edits/removal may proceed, but must coordinate through product-row locks while sale creation captures its basis. They never rewrite old bases or snapshots. These are necessary inventory integration changes, and their exact files/tests will be reviewed in the next package.

## Durable request identity

- Frontend generates one random UUID per logical submit/edit/cancel/stock adjustment, retaining it through timeouts and retries. The same successful intent must not acquire a fresh key on retry. A deliberate new sale receives a new key even if content is identical.
- Unique `(actor, client_key)` plus normalized action/target/payload fingerprint: same key + same intent returns stored status/body; same key + different intent returns 409. Include expected revision in the intent. Protect operation lookup/replay with actor authorization.
- Syntactic validation occurs before reservation. A provisional operation reservation may be inserted inside the transaction to serialize duplicate keys; business rejection/exception must roll it back, with no committed failed/pending row. Handle uniqueness races inside a savepoint so the surrounding transaction stays usable.
- Return a replay header so the UI can distinguish recovered success. Stored responses are historical responses; clients can GET the sale for current state. A scoped operation lookup can resolve an uncertain timeout before a user starts a different intent.
- Persist only the pending operation's key/target/digest/revision in session storage if reload recovery is supported; never put tokens there. Keep it user-scoped and clear on logout. A changed payload is not retried under the old key; first resolve the earlier operation's outcome.
- Old clients without stable keys/revisions fail clearly after cutover. Backend/frontend must be released together; an optional-key transition must not be described as duplicate-safe. Database rows are required; process memory/cache/button disabling are insufficient.

## PostgreSQL locking and concurrency

Use `transaction.atomic()` around the entire domain operation. Deterministic order for participating paths: operation identity → target sale (if any) → product PKs ascending → ingredient PKs ascending → basis PKs ascending. Lock rows through `select_for_update()` **inside** the transaction; use fresh rows after lock acquisition. Newly needed bases are created under their ingredient/product locks and protected by uniqueness constraints. Stock-adjustment and recipe-write paths must participate in the relevant portion of the same protocol.

Expected revisions prevent silent last-writer-wins corrections. Validate aggregated demand after locks, not on stale serializer model instances. Duplicate-key requests serialize at the operation uniqueness boundary. Different-key concurrent sales sharing ingredients must compete against the updated balance; only those with sufficient stock commit. PostgreSQL deadlock/serialization failures must roll back fully and be retryable with the same operation key; deterministic order reduces but does not magically eliminate all deadlocks.

Required tests: two independent connections/threads with barriers and timeouts, real PostgreSQL, TransactionTestCase (not just TestCase), and explicit invariant checks. SQLite cannot verify row locking. The completed schema-free tests passed PostgreSQL 17.11, but these concurrency guarantees are **not implemented or verified yet**.

Official API references: [Django transactions](https://docs.djangoproject.com/en/5.1/topics/db/transactions/) and [select_for_update](https://docs.djangoproject.com/en/5.1/ref/models/querysets/#select-for-update). Framework security upgrades are separate work; these references do not make Django 5.1 safe to deploy.

## Migration, backup, rollback and compatibility

1. Implement/review proposed models, constraints and **new** migrations only after this design is approved. Never edit applied migrations. Use an additive/expand-first rollout with explicit write cutover; do not run an old writer against the new ledger after activation.
2. Run a read-only preflight on an authorized nonproduction dataset: numeric bounds/invalid stock, recipe validity, existing sale/item consistency and unit data. Report issues; do not silently repair historical data. This proposal does not include DATA-01 revenue backfill.
3. Widen numeric fields losslessly; add status/tracking/revision defaults as documented; create empty new tables. Do not populate historical consumption or synthetic movement histories. The first observed anchor is initialized under lock at activation/use.
4. Test forward/reverse migrations on disposable PostgreSQL and a permitted sanitized copy. Assess table locks/index build time and maintenance window using actual row counts. No production migration is authorized by design approval alone.
5. Before any authorized production cutover, make a consistent database backup including media/config references as needed, verify restore into an isolated database, record release/schema versions, pause writes and verify counts/stock totals before/after. No backup of production has been taken in this package.
6. Before tracked writes, schema reversal may be possible after verifying no new records and no precision loss. **After tracked writes, do not blindly shrink decimals, drop history, or roll back to the old writer.** More-than-two-decimal stock cannot be safely squeezed into the old fields. Prefer a forward fix; disaster recovery requires a consistent approved restore and reconciliation of post-backup operations. Code rollback alone would break integrity.
7. API compatibility: preserve existing routes/envelopes and historical pricing, add read-only metadata/status/revision, require operation/revision headers for mutations, update decimal-string types and targeted frontend callers. Soft cancellation requires minimal sales/dashboard/export filtering and status display. External API consumers must be identified before enforcement.

## Proposed reviewable packages after this checkpoint

| Package | Scope | Gate / evidence |
| --- | --- | --- |
| **1A.1 (done)** | Validation-before-restore and HTTP transaction rollback; no schema change | 18/18 SQLite and PostgreSQL tests; before-fix 13 failures |
| **1A.2** | Approved schema/migrations, precision/allocation arithmetic, immutable snapshots and legacy guards | Migration/reversal tests on disposable PostgreSQL; arithmetic property tests and historical-data preservation |
| **1A.3** | Atomic stock service, insufficiency, operation identity, edit/cancel, existing stock/recipe integrations and minimal client/report compatibility | API failure/retry/cancel tests; ledger/basis/stock invariants |
| **1A.4** | PostgreSQL concurrency, browser integration, reconciliation examples and complete Phase 1A review | True simultaneous requests, exception injection, full affected regression/build checks; stop for owner review |

Security AUTH-01/02 are still unresolved and remain a separately reviewed work package. Nothing here authorizes Phase 2, redesign, SEO, deployment or production data changes.

## Decisions requested

Approve or revise the following defaults before 1A.2:

1. **Legacy:** block stock-affecting edit/cancel of legacy_unknown sales; allow only metadata edits, with separately approved manual reconciliation when necessary.
2. **Cancellation:** soft cancellation rather than hard deletion, with historical prices retained and cancelled revenue excluded as today's deletion effectively does; approve the minimal report/status compatibility changes.
3. **Precision:** retain declared units, nine-decimal quantities and cumulative per-basis HALF_UP allocation, including the possible one-quantum cancellation allocation difference and fractional pcs bookkeeping.
4. **Identity/conflicts:** mandatory stable operation UUIDs and expected revisions; clear conflicts for changed-key reuse/stale writes; coordinated frontend/backend cutover.
5. **Scope integrations:** route existing stock adjustments through the ledger with observed balance anchors, block tracked-unit changes, coordinate recipe writes, and reject new stock-consuming sales with missing recipes.
6. **Retention/schema:** approve the four new records and listed field/constraint changes, protected history references and rollback restrictions. Actual production migration still requires separate explicit approval.

**STOP: awaiting owner approval of this proposal.**
