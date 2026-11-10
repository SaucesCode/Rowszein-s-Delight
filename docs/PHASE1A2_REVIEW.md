# Package 1A.2 — design refinement review checkpoint

Date: 2026-11-09 (Asia/Shanghai). Branch: `codex/phase-1a2-design-contracts`. Package 1A.1 baseline: `b87d36d`; Phase 0 baseline: `5e6991c`.

**Design/test refinement is complete for this checkpoint. Exact persistence design and migrations remain unapproved. Phase 1A is not complete.** No model, migration, production record, financial report or existing mutation endpoint was changed. The arithmetic library below is deliberately unwired.

Review [the exact final database design](PHASE1A2_FINAL_DATABASE_DESIGN.md), which specifies every proposed field/default/null rule, relationship, named constraint, index, cross-row invariant, compatibility impact, migration dependency and rollback restriction. The preliminary schema is superseded, not silently implemented.

## Implemented without schema changes

- `backend/sales/inventory_math.py`: immutable rate inputs, exact cumulative integer-quanta allocation, Decimal boundaries with explicit precision, aggregate stock projection, overflow/insufficiency/unit checks, and canonical JSON fingerprints. No model imports or persistence. Nothing calls it from current API mutations.
- `backend/sales/test_inventory_math.py`: 19 desired-behavior tests covering split sales, updates, all cancellation orders, changed/removed recipes via original immutable inputs, exact ties, bounds, precision policies, global Decimal context independence, 5,000 deterministic lifecycle transitions, and identity fingerprints.
- `docs/phase1a2/pending_api_contracts.py`: ten **genuinely failing desired API requirements**, including real PostgreSQL competing sales, duplicate requests and stale edits. They are not expectedFailure tests and do not assert that corruption is correct. The concurrency barrier aligns request starts only, so it will not deadlock a future correct row-lock service.
- `docs/phase1a2/locking_contracts.py`: eight PostgreSQL-only transaction/row-lock/uniqueness experiments using existing fixture tables; multiple independent backend PIDs, barriers and bounded timeouts. Tests cover fractional allocation, competing stock, stale revision, concurrent distinct cancellations, injected rollback, duplicates, disjoint conflicting identity races and replay on a new connection.
- `docs/phase1a2/run_checks.py`: isolated SQLite and disposable local PostgreSQL runners, separate passing/RED logs, no new schema DDL. The overall command returns **exit 1 while API requirements remain unmet**; producing valid experiment results does not turn the API suite green.
- `docs/phase1a2/allocation_examples.py`: generated prospective numerical examples, checked against the unwired kernel; [JSON evidence](phase1a2/evidence/allocation-examples.json).

Package 1A.1 code/tests and both previous evidence directories remain unchanged. The reviewed fixes still run as part of the passing suite.

## Actual test results

| Suite | SQLite | PostgreSQL 17.11 | Meaning |
| --- | --- | --- | --- |
| Existing 1A.1 + new math + protocol experiments | **37 pass, 8 PostgreSQL-only skips** (45 discovered) | **45 pass, 0 skips** | 18 existing regressions + 19 pure-kernel tests + 8 experiments |
| Pending current-API requirements | **7 fail, 3 PostgreSQL-only skips** | **10 fail, 0 errors/skips** | Explicit outstanding requirements, not implemented features |
| Frontend TypeScript/Vite build | Passed | Same frontend artifact | Existing font import/chunk warnings remain; no frontend source changed |
| Migration drift | No changes detected | No proposed migration executed | No new models or migrations present |

Evidence: [SQLite results](phase1a2/evidence/sqlite-results.json), [PostgreSQL results](phase1a2/evidence/postgres-results.json), [passing PostgreSQL tests](phase1a2/evidence/postgres-green.txt), [failing API requirements](phase1a2/evidence/postgres-pending-api.txt), [frontend build](phase1a2/evidence/frontend-build.txt), [PostgreSQL environment](phase1a2/evidence/postgres-environment.json), [migration drift](phase1a2/evidence/migration-drift.txt).

Preservation/schema/link checks: [verification.json](phase1a2/evidence/verification.json). Phase 0 evidence hashes match; 1A.1 fixes/evidence and financial/frontend source are unchanged. Disposable PostgreSQL containers were removed.

The current-API failures are: insufficient stock, repeated successful request identity, conflicting payload/key, recipe-independent reversal, fractional loss, retained/replayable cancellation, unverifiable legacy guard, competing last-stock sales, concurrent duplicate creation, concurrent stale edits. Those failures remain Phase 1A release blockers. AUTH-01/02 and dependency issues are also still unresolved.

### Exactly what the PostgreSQL experiments prove

The experiment uses current `Ingredient.quantity` to hold **integer quanta as synthetic counters**, with temporary notes for allocation/revision state. It uses the existing `Category.slug` unique index as a **stand-in** for request identity. All such rows exist only in disposable test databases. This avoids creating proposed tables before approval.

It proves selected PostgreSQL locking, rollback, uniqueness-race and persisted-replay primitives combined with the tested arithmetic. It **does not prove** the proposed actor/key composite index, exact new CHECKs/FKs/numeric columns, immutable snapshots, integrated ledger, final API idempotency or complete schema migrations. Those require the actual approved models/migrations and new integrated tests later. No concurrency/readiness claim is made for current endpoints.

## Numerical reconciliation

For 0.01 kg / 3-unit batch from opening 1 kg: three separate sales deduct 0.003333333, 0.003333334 and 0.003333333 kg, leaving 0.990000000. Updating the middle sale from 1 to 2 units leaves 0.986666667. Cancelling all three sales (1, 2, 1 units) credits a total 0.013333333, restoring exactly **1.000000000 kg**. Original movements are never rewritten.

Changing the recipe to a 0.02/3 basis during an edit then removing the recipe does not affect the stored-input cancellation example: the final balance still returns to 1 kg. Three concurrent protocol-experiment sales against 0.01 kg reach zero exactly; two sales against 0.005 kg allow one and leave 0.001666667 kg. Concurrent cancellations of 1 and 2 allocated units restore 0.01 kg exactly.

These are arithmetic/experiment results. The current application still fails the corresponding API requirements. Stock uses nine decimal places; recipe batch input, minimum threshold and money retain existing two-decimal precision. Price input beyond cents is rejected, not silently rounded. Quantization/cancellation differences and the minimum rate policy require final owner approval.

## Design refinements and migration status

The final design keeps four records but removes duplicate UUID PKs, pending-operation state, a redundant after-snapshot, duplicate cancellation metadata and unnecessary precision alterations. It proposes four tables (32 columns), seven added columns and one altered column on existing tables, with 14 new B-tree indexes including required PK/unique/FK coverage. No JSON search indexes or unrelated reporting indexes.

Only completed operation records commit. A uniqueness race loser must roll back its **entire business transaction** before replay/conflict handling. New schema checks alone cannot enforce cross-row allocation sums or immutability; those limitations are stated explicitly.

**New migrations created/applied: 0. New model/schema changes: 0.** Existing migrations were applied only when constructing disposable test databases. Forward/reverse migration tests of the proposed changes have not run because those changes are not authorized.

## Explicit review decisions

1. Approve/revise the exact field/constraint/index/relationship design.
2. Confirm cumulative nine-decimal HALF_UP allocation, two-decimal batch input, fractional pcs, minimum one-quantum rate, and possible one-quantum difference from a cancellation's original rounding allocation.
3. Choose financial reporting **A** (exclude cancelled revenue on original sale date, retaining audit history) or request a separate **B** design (reversal on cancellation date). No reporting behavior changes before that decision.
4. Confirm the documented legacy reconciliation process: independently approved current-stock corrections; no invented historical consumption and no automatic financial cancellation of unverifiable sales.
5. Authorize the next action explicitly—model code, migration generation for review, or disposable migration execution. None is implied by conditional design approval; production remains separately unauthorized.

## Reproduce

```powershell
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a2/allocation_examples.py
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a2/run_checks.py
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a2/run_checks.py --postgres
```

Both check commands currently return 1 due to unmet API requirements. Individual result JSON distinguishes successful regressions/experiments from failures. The PostgreSQL runner requires the existing local postgres:17-alpine image and Docker Desktop local pipe, uses random credentials/loopback ports/tmpfs and removes only its own container. No existing business database is selected.

**Stopped at the next approval checkpoint. Do not begin schema implementation or migrations without the owner's explicit decision.**
