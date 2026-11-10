# Phase 1A progress — schema approval checkpoint

Date: 2026-11-09 (Asia/Shanghai). Branch: `codex/phase-1a-sales-inventory`. Reviewed Phase 0 baseline committed as `5e6991c` on `codex/phase-0-revival-audit`.

**Package 1A.1 is complete. Phase 1A overall is incomplete and stopped at the owner's mandatory database design checkpoint.** Review [PHASE1A_DATABASE_PROPOSAL.md](PHASE1A_DATABASE_PROPOSAL.md) before any new model, ledger, consumption snapshot, operation identity field, cancellation status or migration is implemented.

## Implemented changes

- **INV-01 fixed for invalid HTTP sale edits:** serializers validate before any restoration. Repeated invalid PATCH/PUT requests leave sale/items/stock/timestamps unchanged, including after recipe changes/removal.
- **INV-04 fixed for the existing HTTP sale mutation boundary:** `transaction.atomic()` wraps create/update/delete, covering parent/item writes, restoration, deduction and response-data construction. Exceptions roll back all related database writes. This does not make arbitrary direct ORM/serializer/service calls transaction-safe; the next approved package will consolidate a shared domain service.
- Existing endpoints, status codes, response envelopes, sale/item fields, historical prices and normal same-recipe create/edit/delete behavior are preserved. No monetary or quantity formula was changed in this package. Tests use Decimal values and existing ingredient measurement units (kg/l), with amounts exactly representable by the existing two-decimal schema.
- Created desired-behavior regression tests before the fix. These assert corrected behavior rather than expecting the audited corruption. No expected-failure/skip markers conceal unresolved cases in this suite.

## Files changed or created

| File | Change |
| --- | --- |
| `backend/sales/views.py` | Validate edit before restoring; atomic mutation methods; explanatory boundary comment |
| `backend/sales/tests.py` | Replace placeholder with 18 validation/rollback/API regressions |
| `backend/backend/test_settings.py` | Explicit memory SQLite defaults and guarded opt-in disposable PostgreSQL settings; no application DB selected |
| `docs/phase1a/run_postgres_tests.py` | Local-only Docker runner using the existing image, random credentials, loopback random port and tmpfs; automatic owned-container cleanup |
| `docs/phase1a/evidence/` | Separate before/after tests, PostgreSQL environment, build, migration and preservation checks |
| `docs/PHASE1A_DATABASE_PROPOSAL.md` | Proposed schema, historical policy, operations, precision, migration/rollback/compatibility, approval decisions |
| `docs/PHASE1A_PROGRESS.md` | This checkpoint report |
| `docs/REVIVAL_ROADMAP.md`, `docs/TEST_RESULTS.md`, `docs/QUALITY_CHECKLIST.md`, `docs/CHANGELOG.md` | Append/update phase status and evidence; retain Phase 0 results as historical baseline |

No frontend source, business model, existing migration, dependency manifest/lockfile, production configuration or production data was changed. Phase 0 scripts/evidence and the original audit/security/SEO reports remain intact. The generic audit defect probes are intentionally preserved as historical evidence and are not the new correctness suite; some will now fail because the corresponding defects were fixed. Do not overwrite the Phase 0 evidence with a rerun against changed code.

## Tests and actual results

| Run | Actual result | Evidence |
| --- | --- | --- |
| New regression tests against original sales code | 18 tests; **13 failures**, no errors; 0.577s | [sqlite-before.txt](phase1a/evidence/sqlite-before.txt) |
| Same regressions after fix, SQLite memory DB | **18/18 pass**, 0.250s | [sqlite-after.txt](phase1a/evidence/sqlite-after.txt) |
| PostgreSQL 17.11 disposable local container | **18/18 pass**, 2.694s; test DB destroyed/container removed | [postgres-after.txt](phase1a/evidence/postgres-after.txt), [environment](phase1a/evidence/postgres-environment.json) |
| Frontend `tsc -b && vite build` | Pass; bundling 5.55s; original CSS import-order and large-chunk warnings remain; assets unchanged | [frontend-build.txt](phase1a/evidence/frontend-build.txt) |
| Migration drift check | No changes detected; no new migrations generated | [migration-drift.txt](phase1a/evidence/migration-drift.txt) |
| Django system check / preservation | No issues; Phase 0 artifacts unchanged against baseline; no schema changes | [verification.json](phase1a/evidence/verification.json), [Phase 0 hashes](phase1a/evidence/phase0-evidence-sha256.json) |

The suite covers successful/invalid creation; historical submitted unit prices differing from current product price; repeated invalid edits; invalid nested item updates; invalid edits after recipe edits/removal; failures after item insertion, first/last ingredient writes, response serialization, restoration, replacement items, replacement deduction and actual deletion; successful same-recipe edit/delete; retry after rolled-back create; repeated delete returning 404 without extra stock credit. State comparisons include IDs, values and timestamps, so partial write artifacts are detected.

The PostgreSQL tests exercise real PostgreSQL transactions through Django TestCase/savepoints. They do **not** yet prove simultaneous-request correctness, row locking, snapshot consistency, or durable idempotency. No production database was contacted. Only existing migrations were applied inside disposable test databases; no new application schema was created.

## Inventory reconciliation examples from regression tests

All examples use synthetic flour stock 20.00 kg and milk stock 10.00 l. An unchanged recipe requires 2.00 kg flour + 1.00 l milk per donut. Sale unit price is independently snapshotted in SaleItem.

| Operation | Expected and observed stock | Sale state |
| --- | --- | --- |
| Sell 1 | 18.00 kg / 9.00 l | One sale/item committed |
| Submit invalid date twice | Stays 18.00 kg / 9.00 l | Original IDs/prices/timestamps unchanged; each request 400 |
| Create fails after first/last deduction | Returns to 20.00 kg / 10.00 l | No Sale or SaleItem remains |
| Retry that rolled-back creation | 18.00 kg / 9.00 l | Exactly one sale committed; this is failed-request retry safety, not successful-request idempotency |
| Edit 1 → 3 at PHP 40.25, unchanged recipe | 14.00 kg / 7.00 l | Sale total PHP 120.75 |
| Edit fails after replacement/deduction | Remains 18.00 kg / 9.00 l | Original item IDs/prices restored |
| Delete succeeds; repeat DELETE | 20.00 kg / 10.00 l; remains there | First 200, second 404, no second credit |
| Delete fails after row deletion | Remains 18.00 kg / 9.00 l | Original sale/items restored |

These are implemented/tested examples. Fractional cumulative examples in the database proposal are **proposed policy**, not completed implementation.

## Outstanding risks and approval boundary

**Not fixed:** INV-02 insufficient-stock clamping/inflation cycles, INV-03 valid reversal after recipe changes/removal, INV-05 repeat-successful-request/deduction idempotency, INV-06 fractional loss, and shared-stock concurrency. Atomicity cannot resolve those by itself. A valid edit/delete of historical sales may still use the current recipe; this package must not be represented as stock-consistency release-ready.

AUTH-01 (CSRF), AUTH-02 (role enforcement), unsupported/vulnerable dependencies and other Phase 0 findings remain unresolved. No security/readiness claim is made. No deployment, push, production migration or demo seeding occurred.

**Database migrations created: 0.** Schema remains unchanged. The proposal requires decisions on legacy guards, soft cancellation, nine-decimal cumulative allocation, durable operation identities/expected revisions, necessary stock/recipe/report integrations and protected retention.

## Proposed next work

Await approval of the database design, then proceed to package **1A.2: schema/migrations, precise allocation arithmetic, immutable consumption and legacy guards**, with desired-behavior and migration tests. Subsequently implement the shared transaction/idempotency service and compatibility integration, then prove PostgreSQL concurrency before presenting full Phase 1A for completion review. AUTH-01/02 remain a separately reviewed Phase 1 security package. No Phase 2–4 work is authorized.

## Reproduction

From root, using the retained isolated Python environment:

```powershell
& 'backend/.venv/Scripts/python.exe' -B backend/manage.py test sales --settings=backend.test_settings --verbosity=2
& 'backend/.venv/Scripts/python.exe' -B docs/phase1a/run_postgres_tests.py
& 'backend/.venv/Scripts/python.exe' -B backend/manage.py makemigrations --check --dry-run --settings=backend.test_settings
```

PostgreSQL runner requires local Docker Desktop's `desktop-linux` pipe, existing `postgres:17-alpine` image and loopback/process permission. It refuses a different Docker endpoint, uses no host data mounts or persistent volumes, generates its own database/password and removes only its own newly created container. The test settings are for tests only, with a dummy key and test-speed hasher; never use them for development hosting or deployment.
