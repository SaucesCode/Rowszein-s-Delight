# Package 1A.2 — exact database design for review

Date: 2026-11-09. Status: **FINAL DESIGN PROPOSAL, NOT AUTHORIZATION TO IMPLEMENT MODELS OR MIGRATIONS.** This supersedes the preliminary schema in [PHASE1A_DATABASE_PROPOSAL.md](PHASE1A_DATABASE_PROPOSAL.md). Package 1A.1 is preserved at commit `b87d36d`; Phase 0 remains at `5e6991c`.

The owner conditionally approved design refinement and schema-free implementation but withheld approval of the exact persistence records and migrations. This package adds an unwired arithmetic/fingerprint kernel, desired API contracts, and disposable PostgreSQL experiments. **No production model, field, constraint, index, API mutation path, financial query or migration was changed.**

## Design reductions since the preliminary proposal

- Widen **only Ingredient.quantity**. Keep Ingredient.minimum_stock, RecipeIngredient.quantity and all monetary fields unchanged. Nine-decimal consumption does not require nine-decimal recipe input or reorder thresholds.
- Use existing project convention **BigAutoField** for new primary keys; the caller's UUID is the request identity. A second UUID primary key is unnecessary.
- Store only **completed** InventoryOperation rows. Remove pending status/reservation fields and the operational problem of abandoned pending rows.
- Store a before-snapshot plus the exact successful response, rather than redundant before/after/response JSON blobs. The response contains the after-snapshot. No separate revision/event table.
- Store cancellation attribution through one protected operation reference; its actor, reason and timestamp supply cancellation metadata. No duplicate cancelled-by/time/reason columns.
- Reuse composite unique indexes for FK lookups; no redundant standalone FK indexes where the FK is the leading key. No new date/reporting/performance indexes in this package.

## Exact existing-table changes proposed

Types below are Django types with their PostgreSQL equivalents. Existing columns and relationships not listed remain unchanged. Defaults are application/migration backfill defaults; do not assume permanent database defaults unless the reviewed migration explicitly declares them.

Signed Integer/BigInteger/SmallInteger fields plus explicitly named CHECK constraints are proposed for new counters/status numbers; this avoids duplicating the implicit checks Django PositiveInteger fields would add. PostgreSQL integer types provide the listed upper bounds. Decimal digit/scale validation must reject excess precision before DB writes; database numeric storage alone can round extra fractional input. See [PostgreSQL numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html).

SQLite's type affinity is not equivalent to PostgreSQL numeric(20,9). Keep validation and integer-quanta math portable, but PostgreSQL remains the authority for numeric bounds, FK/unique behavior and concurrent row locking. The current SQLite run does not validate the uncreated numeric columns or new constraints. See [SQLite type affinity](https://sqlite.org/datatype3.html).

### Sale

| Field | Type / null / default | Reason |
| --- | --- | --- |
| `inventory_tracking` | CharField(14), nonnull, default `legacy_unknown`; values `legacy_unknown`, `tracked` | Never infer pre-cutover consumption. New service explicitly creates tracked sales. |
| `status` | CharField(9), nonnull, default `recorded`; values `recorded`, `cancelled` | Preserve cancelled sales and their original items/prices. |
| `revision` | BigIntegerField / bigint, nonnull, default 0, range 0..9223372036854775807 | Expected-revision conflict detection; tracked sales start at 1. |
| `cancellation_operation` | Nullable OneToOneField to InventoryOperation, default null, `on_delete=PROTECT` | One cancellation result per sale. Timestamp/actor/reason are derived from this immutable operation. |

Constraints: `sale_tracking_valid` (enumeration); `sale_status_valid` (enumeration); `sale_revision_valid` (nonnegative and tracked implies revision >=1); `sale_cancel_link_valid` (recorded iff cancellation_operation is null; cancelled iff nonnull). OneToOne creates a unique B-tree index, with multiple nulls permitted. No additional Sale index.

Cross-record checks that **cannot** be ordinary row CHECK constraints: cancellation operation must have action sale_cancel and reference this sale; response snapshot revision must match the transition. Enforce in the service and reconciliation tests. Do not claim a FK alone proves these conditions.

### Ingredient

| Field | Type / null / default | Reason |
| --- | --- | --- |
| `quantity` | Alter Decimal(10,2) → Decimal(20,9) / numeric(20,9), nonnull; retain existing default 0 | On-hand stock precision only. Range 0..99999999999.999999999. Existing values widen exactly. |
| `stock_revision` | BigIntegerField, nonnull, default 0 | Detect stale manual adjustments and order movements for one ingredient. |
| `ledger_opening_quantity` | Decimal(20,9), nullable, default null | Observed balance at the first tracked operation; no fabricated history. |
| `ledger_started_at` | DateTimeField / timestamptz, nullable, default null | Provenance of that observation. |

Constraints: `ing_stock_nonnegative` (quantity >=0); `ing_revision_nonnegative`; `ing_anchor_pair_valid` (both anchor fields null or both nonnull); `ing_anchor_nonnegative` (null or >=0); `ing_untracked_revision_zero` (null anchor implies stock_revision=0). An initialized anchor may have revision 0 if the first operation produces no movement. No new Ingredient index beyond existing PK/name indexes.

**Unchanged:** cost_per_unit Decimal(10,2), minimum_stock Decimal(10,2), declared unit, all recipe columns. This package does not change costing or convert units. The widened quantity capacity is deliberate headroom; overflow rejects an operation rather than truncating it.

## Exact new records proposed

### InventoryOperation — one committed business result per request identity

Table: `sales_inventoryoperation`.

| Field | Type / null / default | Purpose |
| --- | --- | --- |
| `id` | BigAutoField PK, nonnull, generated | Small conventional internal reference. Sequence gaps after rollback are harmless. |
| `actor` | FK accounts.User, nonnull, PROTECT, `db_index=False` | Identity scope and immutable attribution; covered by actor/key unique index. |
| `client_key` | UUIDField, nonnull, **no generated default** | Stable client intent identity. Missing keys are rejected, not replaced server-side. |
| `action` | CharField(16), nonnull, no default | Exactly sale_create, sale_update, sale_cancel, stock_adjust. |
| `sale` | Nullable FK sales.Sale, PROTECT, `db_index=False`, default null | Target/result for sale operations. |
| `ingredient` | Nullable FK ingredients.Ingredient, PROTECT, `db_index=True`, default null | Target for a manual stock adjustment. |
| `request_fingerprint` | CharField(64), nonnull, no default | SHA-256 of normalized action/target/revision/payload. |
| `reason` | TextField, nonnull, default empty string | Required nonblank for cancellation and stock adjustment; optional otherwise. |
| `schema_version` | SmallIntegerField, nonnull, default 1 | Explicit JSON/intent interpretation version, not an application release number. |
| `before_snapshot` | JSONField, nonnull, default empty object | Original sale/items/allocations or stock state. Empty object for sale creation. |
| `response_status` | SmallIntegerField, nonnull, no default | 201 for sale_create; 200 for the other successful actions. |
| `response_body` | JSONField, nonnull, no default | Exact successful API body, including complete after-state and historical submitted prices, for durable replay/audit. |
| `created_at` | DateTimeField, nonnull, default timezone.now | Timestamp of committed operation; cancellation attribution source. |

Constraints/indexes:

- `invop_actor_key_unique`: immediate, nondeferrable UNIQUE(actor_id, client_key). This is the **database-level idempotency boundary**.
- `invop_action_valid`: action in the four values above.
- `invop_target_valid`: stock_adjust has ingredient not null and sale null; each sale action has sale not null and ingredient null.
- `invop_response_valid`: sale_create →201; others →200.
- `invop_fingerprint_valid`: lowercase hexadecimal, exactly 64 characters; `invop_version_valid`: schema_version=1 for this version.
- `invop_reason_valid`: cancellation/stock adjustment require SQL Length(Trim(reason)) > 0 (space trimming). The service additionally rejects all-whitespace reasons, including tabs/Unicode whitespace. Verify both database expressions when migrations are authorized.
- `invop_sale_time_idx`: B-tree(sale_id, created_at, id). It replaces the standalone sale FK index and supports a sale's chronological operation history.
- Normal PK index and explicit ingredient FK index; no JSON GIN, action-only or extra actor index.

JSON types, canonical digest correctness, snapshot-to-row agreement and immutability are service/reconciliation invariants, not falsely advertised as DB CHECK guarantees. Snapshots contain canonical Decimal strings, sale dates/notes, product IDs/names, item quantities and original unit prices/subtotals, sale status/revision and allocation identities. Stock responses include unit, balance, revision and the client operation key; movement IDs need not be embedded before their rows exist. Versioned serializers must define the final JSON shape before API activation.

### ConsumptionBasis — immutable historical rate and cumulative allocation counter

Table: `sales_consumptionbasis`.

| Field | Type / null / default | Purpose |
| --- | --- | --- |
| `id` | BigAutoField PK | Internal identity. |
| `product` | FK products.Product, nonnull, PROTECT, `db_index=False` | Product associated with the original rate; covered by composite unique index. |
| `ingredient` | FK ingredients.Ingredient, nonnull, PROTECT, `db_index=True` | Ingredient consumed and stock lock target. |
| `unit` | CharField(10), nonnull, no default; existing eight unit values | Original ingredient unit; never read a changed recipe to restore it. |
| `batch_quantity` | Decimal(10,2), nonnull, no default | Exact snapshot of current RecipeIngredient.quantity; retaining input precision avoids a recipe migration. |
| `yield_quantity` | IntegerField, nonnull, no default, range 1..2147483647 | Original batch yield. |
| `active_units` | BigIntegerField, nonnull, default 0, range 0..9223372036854775807 | Sum of units currently allocated by recorded sales' current revisions. |

Constraints: `basis_rate_unique` UNIQUE(product_id, ingredient_id, unit, batch_quantity, yield_quantity), immediate/nondeferrable; `basis_unit_valid`; `basis_batch_positive`; `basis_yield_positive`; `basis_units_nonnegative`; `basis_min_quantum` (batch_quantity × 1000000000 >= yield_quantity). The last rule rejects positive per-unit consumption smaller than one stock quantum; otherwise a zero-stock ingredient could appear to fund tiny sales that round to zero. It is a proposed policy requiring approval; preflight must report incompatible recipes without changing them.

Only active_units is mutable. Rates/units/products/ingredients are immutable after insertion. No Recipe/RecipeIngredient FK and no deletion when a recipe is removed. Rate uniqueness intentionally reuses a basis if the same product formulation returns later. Equivalent numerical rates with different batch/yield definitions remain separate immutable bases; each has its own bounded rounding allocation.

No redundant product index; explicit ingredient FK index and normal PK/unique indexes only. Active-unit consistency is a cross-row sum invariant and requires locked updates plus reconciliation, not a row CHECK.

### SaleConsumption — immutable allocation per sale revision

Table: `sales_saleconsumption`.

| Field | Type / null / default | Purpose |
| --- | --- | --- |
| `id` | BigAutoField PK | Conventional row identity. |
| `sale` | FK sales.Sale, nonnull, PROTECT, `db_index=False` | Original transaction, retained on cancellation. |
| `sale_revision` | BigIntegerField, nonnull, no default, >=1 | Revision to which the allocation belongs. |
| `basis` | FK ConsumptionBasis, nonnull, PROTECT, `db_index=True` | Immutable rate/unit reference. |
| `units` | BigIntegerField, nonnull, no default, >=1 | Units allocated to this basis in that revision. |

Constraints: `sc_sale_rev_basis_unique` UNIQUE(sale_id, sale_revision, basis_id), immediate/nondeferrable; `sc_revision_positive`; `sc_units_positive`. Composite uniqueness covers the sale FK lookup. Normal PK and explicit basis FK index; no timestamp (revision/operation provides time), no repeated recipe/product/quantity/cost columns.

Rows are append-only. Current effective allocations are rows matching a recorded tracked sale's current revision. Metadata edits copy allocations to the new revision without touching stock/counters. Historical rows remain unchanged. Cancellation increments the sale revision and has no effective new allocations; previous rows remain historical.

### StockMovement — applied net delta for one ingredient/operation

Table: `sales_stockmovement`.

| Field | Type / null / default | Purpose |
| --- | --- | --- |
| `id` | BigAutoField PK | Internal reference. |
| `operation` | FK InventoryOperation, nonnull, PROTECT, `db_index=False` | Attribution, action, reason, before-state and timestamp. |
| `ingredient` | FK ingredients.Ingredient, nonnull, PROTECT, `db_index=False` | Stock affected. |
| `stock_revision` | BigIntegerField, nonnull, no default, >=1 | Per-ingredient sequence after applying this movement. |
| `unit` | CharField(10), nonnull, no default; existing unit values | Unit of the actual signed delta. |
| `quantity_delta` | Decimal(20,9), nonnull, no default, nonzero | Credit positive, deduction negative. Actual applied quantity, not theoretical unrounded share. |
| `balance_after` | Decimal(20,9), nonnull, no default, >=0 | Resulting materialized stock for reconciliation. |

Constraints: `movement_op_ing_unique` UNIQUE(operation_id, ingredient_id); `movement_ing_rev_unique` UNIQUE(ingredient_id, stock_revision), both immediate/nondeferrable; `movement_unit_valid`; `movement_delta_nonzero`; `movement_balance_nonnegative`; `movement_revision_positive`. These two unique indexes cover both FK lookups; no extra FK/time indexes or duplicate timestamp. Zero-net operations create no movement and do not increment stock_revision.

Reconciliation equations: `quantity = ledger_opening_quantity + sum(quantity_delta)`; consecutive balances differ by each delta; latest movement revision equals Ingredient.stock_revision. A before/after check on unrelated rows is not a CHECK constraint: enforce it in the service and audit procedure. Protect movement/operation history from API/admin edits. DB permissions/triggers, if later required against raw SQL tampering, need separate operational review; Django PROTECT is not a claim of complete immutability.

Index inventory: **14 new B-tree indexes** in total—four new PKs; five composite unique indexes; one cancellation-link unique index; four nonunique lookup/history indexes. Existing indexes remain. No GIN/partial/covering indexes are proposed. Schema delta: **four new tables (32 columns), seven added columns on existing tables, and one altered numeric column**. The extra tables separate immutable request history, immutable rates/mutable pooled counts, per-sale allocations and exact applied stock effects; combining them would lose one of those distinct invariants or repeat rate/history data per sale.

## Transactions and completed-only idempotency

1. Normalize/validate the request first: decimal strings, integer quantities, dates, reason, target, expected revision, action, sorted product IDs. Reject floats/precision loss rather than hashing ambiguous values. Actor/key uniqueness scope is independent of fingerprint content.
2. Replay lookup before business processing: same actor/key/fingerprint returns the stored status/body; different fingerprint returns 409. Missing header gets a clear 400, not a new server-generated key.
3. In one atomic transaction: lock sale if applicable, then product PKs ascending, ingredient PKs ascending, basis PKs ascending. Recipe writers lock their products; stock adjusters lock ingredients. Recheck replay after acquiring locks, **before** expected-revision/stock rejection. Fetch fresh data after locks; prevent unit changes once tracked.
4. Validate all projected changes and bounds, then apply sale/items/allocations/counters/stock. Insert the **completed** InventoryOperation, create its movements, and set the cancellation link if relevant. Construct response/snapshots inside the transaction. There is no persistent pending row.
5. Disjoint conflicting requests can tentatively reach the unique operation insert concurrently. The loser must let the identity uniqueness error escape the **entire outer business transaction**. Only then fetch the winner and replay/409. Do not catch inside a savepoint and accidentally retain speculative stock writes. In final code, identify `invop_actor_key_unique` explicitly; unrelated integrity errors must not be treated as replays.
6. This requires all effects to be transactional DB writes. No external messages/payments/files may be emitted before successful commit; none is in scope here. Same-key retries after rollback may execute; same-key retries after commit must replay, even after a new connection/process. Different keys for identical content mean deliberate distinct sales.

If a deadlock or serialization failure occurs, roll back and return a retryable error; retain the same key. Do not retry only a stock sub-step. No global serializable isolation requirement is proposed. Row locks and immediate uniqueness are required, with true multi-connection PostgreSQL tests.

Expected revision uses the target route's `If-Match: "<revision>"`; missing/invalid revision gets 400 and stale revision 409. Stable operation keys survive uncertain network outcomes. Exact frontend recovery/session-storage behavior remains targeted integration work; no auth tokens in browser storage. Existing clients without keys/revisions cannot be advertised as duplicate-safe and must be upgraded before activation.

### Proposed endpoint compatibility contract (not implemented)

| Endpoint | Proposed change after approval |
| --- | --- |
| POST `/api/sales/` | Keep date/notes/items and existing success envelope; require Idempotency-Key; return status/tracking/revision metadata in sale data. |
| PUT/PATCH `/api/sales/<id>/` | Require key and If-Match. Metadata-only updates copy allocations forward, without stock writes. Legacy item changes return 409. |
| DELETE `/api/sales/<id>/` | Only after financial-policy approval: require key, If-Match and JSON cancellation reason. Retain row/items; return the existing success/message envelope with versioned cancelled-sale data. No physical deletion. This data extension must be reviewed with callers. |
| POST `/api/ingredients/<id>/adjustments/` | New narrowly scoped action: signed canonical delta string, reason, key and If-Match stock revision. Reject insufficient/overflow/stale state; write one movement atomically. |
| Existing ingredient PUT/PATCH | Metadata path must exclude quantity; reject attempts to bypass the adjustment action. Tracked unit changes are rejected. Ingredient creation may accept declared opening stock, later captured as an observed anchor. |

Existing stock modal keeps add/deduct/reason interactions, but must send its actual delta rather than a stale computed absolute balance. Ingredient edit callers must stop resending quantity. Recipe writers must coordinate product locks. These changes require focused backend/client integration tests; none is enabled in this package. Snapshot/history access also requires the separately reviewed authorization policy; AUTH-02 is not fixed by these schemas.

## Precision, numerical evidence and limitations

| Value | Policy |
| --- | --- |
| On-hand stock, movement deltas, balances and anchor | Decimal(20,9), quantum 0.000000001 of the ingredient's declared unit; no floats/conversion |
| Recipe/basis batch input and reorder threshold | Existing Decimal(10,2); no automatic rounding or widening |
| Sale price/subtotal/total | Existing Decimal(10,2), PHP cents; reject additional price fractions rather than round silently. Integer sale quantities mean price × quantity needs no fractional-cent rule. Existing costing formulas are outside this package. |
| Allocation rounding | Positive HALF_UP to stock quantum on **cumulative basis total**, computed through exact integer quotient/remainder |
| Decimal arithmetic | Explicit local precision 50 for bounded boundary conversion; exact integer quanta for divisions/ties. Ambient Decimal context cannot change results. |

For batch B, yield Y and active units N: `R(N)=HALF_UP(B*N/Y, quantum)`. A stock transition is `R(old N)-R(new N)`, summed across all affected bases before checking projected stock. Cumulative consumption may exceed the maximum instantaneous balance over many restocks; keep that calculation as a bounded-input Python integer, not a numeric(20,9) database column. Reject active-count overflow before writing.

For B=0.01 kg, Y=3, opening 1 kg:

| Action | Active units after | Stock delta kg | Stock after kg |
| --- | --- | --- | --- |
| Sell A=1 | 1 | -0.003333333 | 0.996666667 |
| Sell B=1 | 2 | -0.003333334 | 0.993333333 |
| Sell C=1 | 3 | -0.003333333 | 0.990000000 |
| Update B to 2 units | 4 | -0.003333333 | 0.986666667 |
| Cancel A | 3 | +0.003333333 | 0.990000000 |
| Cancel B (2 units) | 1 | +0.006666667 | 0.996666667 |
| Cancel C | 0 | +0.003333333 | **1.000000000** |

Changed recipe example: create one unit from old 0.01/3 basis →0.996666667 kg. Edit it onto a new 0.02/3 basis →0.993333333 kg. Delete/change the current recipe; cancelling the stored new basis still restores **1.000000000 kg**. No current recipe is needed for the reversal.

Concurrent experiment examples, using existing fixture rows only:

- Three independent PostgreSQL connections allocate one unit each from opening 0.010000000 kg: serialized deltas are 0.003333333, 0.003333334, 0.003333333; final stock **0**, active units **3**.
- Two sales compete for opening 0.005000000 kg: one is rejected; final stock **0.001666667 kg**, active units **1**.
- Two distinct cancellations remove allocations of 1 and 2 units from N=3: total credit **0.010000000 kg**; both ordering choices reconcile.
- Duplicate-operation experiment changes stock once, replays on another connection, and a conflicting disjoint-stock uniqueness loser rolls back its tentative write.

Evidence: [generated examples](phase1a2/evidence/allocation-examples.json), [PostgreSQL experiments](phase1a2/evidence/postgres-green.txt), [current API failures](phase1a2/evidence/postgres-pending-api.txt). These are deliberately separate. Existing Ingredient/Category fixture columns stand in for counters/identity in the experiment; **the four proposed tables and exact future constraints have not been created or tested**.

Bounded quantization is not arbitrary-rational physical measurement: each basis differs from exact theoretical consumption by at most half a quantum; distinct bases have separate bounds. The ledger itself reconciles exactly in stored quanta. Reject rates below one quantum so positive sales never obtain zero-quanta consumption. Retain fractional pcs bookkeeping as proposed, subject to owner approval.

Cancellation uses the current cumulative balance, not blind negation of a previous rounding allocation. Cancelling the earlier rounding-up sale may credit one quantum less than its original movement; the new exact applied credit is recorded and the original is untouched. All allocations cancelled restore the opening stock exactly. This remains an explicit business decision, not a hidden “precision fix.”

## Legacy reconciliation procedure (no automatic restoration)

1. Identify the legacy sale and retain its original IDs/items/date/prices. Freeze stock-affecting edit/cancel of that sale; metadata-only edits do not restore anything.
2. Gather independent source evidence, if available: dated batch records, actual ingredient units/yield, purchase/stock records and prior corrections. A current recipe is not historical evidence. Record unknowns explicitly.
3. Obtain a physical count/current balance and an owner-reviewed explanation. A count establishes **current** inventory; it does not prove what that old sale consumed.
4. Propose a specific signed current stock correction per ingredient, with expected stock revision, unit, reason, referenced legacy sale IDs and evidence. Owner approval must state the correction; do not invent it from prices/current recipes.
5. Once the reviewed adjustment service exists, apply it as its own idempotent stock_adjust operation under locks. Preserve before/after balance and reason. The legacy sale remains legacy_unknown; no synthetic historical SaleConsumption or receipt movements are created.
6. Financial cancellation/correction of an unverifiable legacy sale requires a separately approved policy/workflow. A physical stock count does not authorize marking it tracked or automatically reversing it. Until then, return a clear 409 reconciliation-required response for stock-affecting changes.

Observed anchors copy the current stored balance at first tracked use without changing it. They describe that observation only. No anchor is an assertion that historical balances were correct.

## Financial reporting decision — activation gate

**No report/filter/total behavior changes in this package.** Retaining a cancelled sale while reports sum all rows would silently include it; filtering it without agreement would also be a policy change. Soft cancellation must remain disabled until the owner explicitly chooses the report contract and affected queries/exports/status display are reviewed.

Options: **A (recommended for current compatibility):** exclude cancelled revenue from its original sale date, like today's physical deletion, while retaining an audit/history view; **B:** retain original booking and record a reversal on cancellation date, requiring additional financial-event schema and a separate design review. Do not implement B with an invented negative sale or zeroed original price. This exact four-record schema assumes A only **if approved**; B would require design changes before activation. No refunds/tax/closed-period accounting is inferred.

## Migration plan — not generated or executed

Expected future files, subject to approval, are two additive migrations:

1. `ingredients/0004_inventory_precision_and_anchor.py`: depends on `ingredients/0003_ingredient_category_ingredient_image_and_more`; widen quantity; add revision/nullable anchors; add named ingredient checks. No stock-value recomputation.
2. `sales/0003_tracked_inventory.py`: depends on `sales/0002_saleitem_subtotal_amount`, ingredient 0004, `products/0004_category_product_category_fk` and the swappable user-model dependency (currently `accounts/0001_initial`). Add Sale status/tracking/revision; create four tables and their checks/unique indexes; add nullable cancellation operation link after both tables exist; add Sale checks last. Existing rows default recorded/legacy_unknown/revision 0. No historical consumption or movement backfill.

Names are a proposed review plan, **not files present in the repository**. Recipe and product schemas need no migration. The normal existing FK/PK/unique indexes remain. Check actual generated PostgreSQL/SQLite SQL, FK behavior, null semantics, CHECK definitions and index inventory after generation is separately authorized. Avoid combining this with unrelated subtotal backfill or dependency upgrades.

Preflight must be read-only and report invalid stock, out-of-range batch/yield/rates, unit issues and inconsistent sales before enabling new writers. Fail rather than clamp. No existing data audit or correction against production is authorized. Test forward/reverse migrations on disposable DBs only after migration authorization; these migration paths have **not** been executed in 1A.2.

An expand-first release may add unused schema with old behavior only while no tracked writers are active. Before activation: coordinated frontend/backend upgrade, write pause, consistent DB backup and restore rehearsal, row-count/stock-value comparison, approval of financial/legacy policies, and exclusive use of the new service for API/admin stock writes. Do not leave mixed old/new stock writers after activation.

Rollback before tracked writes: confirm new tables empty, no anchors/revisions used, no nonzero extra stock decimal places and original bounds respected before reversing. Never shrink with silent rounding. After tracked writes: preserve history; prefer a forward fix. Restoring an old database/code snapshot needs a write pause, verified backup and an explicit plan for post-backup operations. Reverting only the application to the old writer would corrupt the ledger and is not an acceptable rollback.

FK relationships use Django PROTECT for business retention, with normal database referential constraints. Do not assume this also implements immutable rows or the cross-record invariants identified above. The exact future DDL and migration performance/lock duration require review on realistic nonproduction row counts. Production migration/deployment remains separately unauthorized.

## Outstanding decisions and next checkpoint

1. Approve/revise **every field, constraint, index and retention relationship** above, including the completed-only identity race protocol and reduced precision-change scope.
2. Confirm the fractional policy: nine-decimal stock, two-decimal batch/money inputs, cumulative HALF_UP, minimum one-quantum rate, fractional pcs and one-quantum cancellation allocation differences.
3. Select financial reporting **A or B** before cancellation activation; neither is silently applied.
4. Confirm legacy corrections remain independent approved current-stock adjustments; unverifiable legacy cancellation remains blocked until a separate financial correction policy exists.
5. State the next authorization explicitly: model implementation, migration generation/review, or migration execution in disposable environments. **No new migration generation/application or production action is implied by conditional design approval.**

AUTH-01/02 and dependency issues remain unresolved. Passing arithmetic/locking experiments is not production readiness. Current endpoint requirements remain red. Stop here for owner review before continuing with schema implementation.

Technical references: [Django transaction boundaries](https://docs.djangoproject.com/en/5.1/topics/db/transactions/), [Django row locks](https://docs.djangoproject.com/en/5.1/ref/models/querysets/#select-for-update), [PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html). The tests validate selected primitives; these sources do not substitute for testing the eventual approved schema and integrated service.
