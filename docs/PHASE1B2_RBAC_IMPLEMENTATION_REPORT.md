# Package 1B.2 â€” RBAC implementation review checkpoint

Date: 2026-11-10, Asia/Shanghai. Branch: `codex/phase-1b2-rbac`, from approved Package 1B.1 commit `d696a74`.

**AUTH-02 controls are implemented and verified locally. STOPPED for owner review after Package 1B.2.** No production access/deployment occurred. No session revocation, rate limiter, dependency upgrade, schema/migration, new role, user-management API, demo-data package or major redesign was introduced. This is not a production-readiness declaration.

## 1. Approved matrix and final enforcement

An owner is an active `role=admin` user. Staff is active `role=staff`. Unknown/inactive users receive no business capabilities. Django `is_staff`/`is_superuser` never grant business-owner API capabilities.

| Resource/action | Anonymous | Staff | Owner/admin |
| --- | --- | --- | --- |
| Product/category lists | Public-safe active storefront catalog | Operational catalog | Full catalog |
| Product/category detail | Denied | Operational fields | Full read/manage |
| Create sale | Denied | Current catalog prices, current Manila date, existing availability/stock rules | Existing permitted custom/historical prices and dates |
| Read sales/counts/detail | Denied | Own verifiably tracked sales only | All retained sales, including legacy |
| Edit/cancel any recorded sale | Denied | Denied, including own sales/notes | Existing revision/idempotency/legacy safeguards apply |
| Ingredient list/detail/low-stock | Denied | ID, name, exact quantity, unit, low-stock status | Full fields |
| Ingredient/catalog/category writes, stock adjustment | Denied | Denied | Existing validation/transaction safeguards |
| Recipes, costing | Denied | Denied | Read/manage |
| Expenses and expense exports | Denied | Denied | Read/manage/export |
| Dashboard, margins, financial summary, sales exports | Denied | Denied | Allowed |
| Login/bootstrap/logout | Existing CSRF-protected auth flows | Self | Self |
| Unmapped private API actions | Denied | Denied | Denied |
| Django admin | No business access | Denied despite technical superuser flags | Also requires existing Django staff/model permissions; history remains read-only |

`accounts.permissions` centralizes role capabilities, command actions, default-deny `BusinessPermission`, current-actor validation and sale visibility. All **25 registered API routes** are inventoried by a regression. Only the three existing auth/bootstrap/cleanup views use AllowAny; public catalog GET/HEAD is explicitly mapped, and other business methods are role-gated. HEAD follows GET authority; unmapped methods fail closed. Generic metadata is disabled and JSON is the only API renderer, preventing browsable forms/OPTIONS from revealing owner-only schemas. CORS preflight does not grant business permissions.

Staff sales querysets use the existing immutable `InventoryOperation(action=sale_create).actor` relationship plus tracked inventory/ledger classification. They never infer ownership from timestamps, notes or current recipes. Filtering precedes date filters/pagination, so other employees and legacy records are absent from both rows and counts. The same scope applies to detail lookup; hidden and nonexistent sale IDs return indistinguishable 404 responses. Object permission checks also enforce the scope. Staff edit/cancel authority is denied before ID lookup or body validation.

Explicit allowlist serializers protect ingredient list/detail/low-stock and catalog/category list/detail. Staff stock responses contain exactly `id,name,quantity,unit,is_low_stock`; no cost, supplier, internal notes, stock audit fields or images. Anonymous catalog lists retain active categories and available products in active categories, matching storefront availability intent; public category/product metadata excludes internal counts and timestamps. Expired/malformed JWTs are tolerated **only for safe public catalog list reads**. Valid unknown-role/inactive identities do not fall back to anonymous; private endpoints retain normal JWT/CSRF enforcement.

Every `/api/` response now uses no-store and Vary: Cookie, protecting different role/anonymous representations from shared-cache reuse. No wildcard origin or deployment-header trust was added.

## 2. Sale commands, replay and PostgreSQL locking

Service entry points enforce current database authority even when called with a stale in-memory user. Inside the existing atomic command, a PostgreSQL **FOR SHARE** lock rechecks the actor before replay or writes. Lock order is actor â†’ existing sale/product/ingredient/basis order. Shared actor locks permit parallel requests by the same person, including the existing forced UUID collision test; they conflict with role/active updates until transaction completion. SQLite performs the same role checks without claiming PostgreSQL row-lock behavior.

Before returning any saved operation response, the service verifies authority for the **stored action**, and staff replay requires its own trustworthy tracked creation. A demoted owner cannot retrieve a stock-adjustment/edit/cancellation response through replay, including by submitting an old owner-edit UUID to the staff create endpoint. Permission denials use the existing structured 403 handler.

Successful exact replay occurs before checking today's catalog/date/recipe state. New staff intent is then validated against **locked current products**, with exact Decimal price equality and `timezone.localdate(timezone=ZoneInfo('Asia/Manila'))`. It never silently replaces a supplied price/date or reprices history. Price/date violations return 400 with no reserved operation or ledger write; identity conflicts remain 409. Existing positive quantity, availability, recipe, stock sufficiency, precision, revision, cancellation and legacy checks remain authoritative.

Verified example: a staff sale at 50.00 commits; afterward the catalog changes to 77.00, availability is disabled, the recipe is deleted and the test clock advances to 2030. Its exact original UUID/body still returns the identical 201 response with `Idempotency-Replayed: true`, no new operation, posting or deduction. Changing its price to 77.00 under the same UUID returns 409. A **new** staff request with a price differing from the current catalog is rejected. At 2026-11-09 17:30 UTC, the permitted Manila date is 2026-11-10; 2026-11-09 is rejected before writes.

Django admin's site and login form both require business-owner status in addition to normal technical eligibility. No existing account is promoted, and User is not newly registered or exposed through an API. Existing sale/line/five-ledger admin records remain read-only; existing ingredient quantity/unit/audit restrictions are retained.

## 3. Frontend behavior

Role-aware guards deny direct owner-only routes before their pages mount. Staff land on `/sales`; owners retain `/dashboard`. Navigation exposes only permitted sections. Staff use small readonly catalog/stock projections with the existing page components/styles, without cost, supplier, export, configuration or stock controls. The owner management pages remain intact.

Staff sales hide edit/cancel/export and do not issue financial-summary requests. Their new-sale date is readonly in Manila time and unit prices are readonly catalog values; only available products can be selected. The backend validates both independently. API errors remain permission-aware; pending actor-scoped operation UUIDs and the bounded CSRF transport are preserved.

`/me` overrides the prior 60-second global cache/focus policy with a fresh authority check on mount/focus. Failed authority checks stop rendering cached owner identity. A change in actor/role resets private query data; successful login/logout retain the existing cache clearing. A browser test downgrades an owner while logged in, then verifies readonly catalog/navigation, blocked dashboard and zero business mutations. No automatic unsafe-request replay or new refresh/session behavior was introduced.

## 4. Actual original role requirement results

The original `docs/phase1b/security_cases.py` is unchanged. Fresh baseline runs reproduce **13 failures, zero errors on each engine**: [PostgreSQL before](phase1b2/evidence/20261110-101336-postgres-before-11c92624/original-roles-13-before.json), [SQLite before](phase1b2/evidence/20261110-101147-sqlite-before-4bb55cea/original-roles-13-before.json).

All 13 now pass on **both** engines:

| Original requirement | Actual after |
| --- | --- |
| Staff cannot create an expense | Pass |
| Staff cannot change catalog price | Pass |
| Staff cannot change a recipe | Pass |
| Staff cannot adjust stock/create an operation | Pass |
| Staff cannot edit its own recorded sale | Pass |
| Staff cannot cancel its own recorded sale | Pass |
| Staff cannot read financial summary | Pass |
| Staff cannot read profit margins | Pass |
| Staff cannot read owner dashboard | Pass |
| Staff cannot export sales | Pass |
| Role downgrade applies to an existing JWT | Pass |
| Unknown role fails closed | Pass |
| Django superuser flags do not make staff an owner | Pass |

Final per-test evidence: [PostgreSQL](phase1b2/evidence/20261110-104454-postgres-all-bd779992/original-roles-13.json), [SQLite](phase1b2/evidence/20261110-104450-sqlite-all-f4131dc6/original-roles-13.json).

## 5. Regression totals and explicit remaining failures

| Suite | PostgreSQL 17.11 | SQLite |
| --- | --- | --- |
| Original role requirements | **13 pass** | **13 pass** |
| Package 1B.1 CSRF regressions | **26 pass** | **26 pass** |
| Existing Phase 1A business checks | **120 pass** | **103 pass, 17 PostgreSQL-specific skips** |
| New RBAC/API/admin/concurrency checks | **25 pass** | **21 pass, 4 PostgreSQL-specific skips** |
| Original CSRF/session/throttle requirements | **10 pass, 3 deferred failures** | **10 pass, 3 deferred failures** |
| **Combined selected backend totals** | **194 pass, 3 fail, 0 errors, 0 skips** | **173 pass, 3 fail, 0 errors, 21 skips** |

The three failures remain **logout invalidates copied access JWT**, **password change invalidates existing access JWT**, and **bad logins receive rate limiting**. They are neither skipped nor marked complete. The complete runner intentionally returns exit 1 for these outstanding 1B.3 requirements. AUTH-01's negative Origin/token checks remain passing.

Final [PostgreSQL suite summary](phase1b2/evidence/20261110-104454-postgres-all-bd779992/summary.json), [SQLite suite summary](phase1b2/evidence/20261110-104450-sqlite-all-f4131dc6/summary.json), and [machine-readable selected results](phase1b2/verification-summary.json) retain actual per-test outcomes and every attempt. No test error is treated as a pass.

Only three legacy business fixture account declarations changed, explicitly adding `role=admin`: `ledger-test`, `pending-contract`, `second-operator`. AST comparison proves **all other existing test code/assertions unchanged**. Inventory arithmetic, stock/financial assertions, exception injection and defined races remain intact. The new role/CSRF tests use real cookies and enabled CSRF, without force_authenticate or substituted permissions; Django-admin tests separately exercise its session/site/form boundary.

New protection evidence includes a route/method matrix of owner-only denials before validation; anonymous/unknown/inactive read denials; own/other/legacy/count scoping; exact stock field allowlists; public-safe catalog/invalid-cookie behavior; hidden/nonexistent ID equivalence; HTML/OPTIONS/schema protection; default unmapped-action denial for an owner; spoofed technical flags; admin login and HTTP write denial; price/date checks; direct-service stale actor rejection; and unauthorized stored-response replay.

For rejected requests, tests compare complete before/after rows across **Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry, Ingredient, Product, Category, Recipe, RecipeIngredient and Expense**. These assert zero business mutation, not merely a 403 status. Rejected staff creation also retains CSRF and hostile-Origin checks.

The four additional independent-session PostgreSQL cases use real cookie authentication and valid CSRF:

1. Two staff compete for last stock: one 201, one 400; exact ledger reconciliation.
2. Concurrent duplicate staff UUID: two identical 201 responses, one actual operation, one replay.
3. A pending role downgrade commits while a command waits: observed PostgreSQL lock wait, then 403 with unchanged ledgers.
4. A command holds the shared actor lock: observed role-update lock wait; the authorized command commits first, the role update follows, and subsequent requests are denied.

These supplement the existing PostgreSQL business races, including forced unique-key collision with disjoint stock. SQLite skips all 21 lock/concurrency-dependent cases explicitly.

Frontend: **10 permission + 14 CSRF transport + 13 identity + 10 stock checks pass (47 total)**. TypeScript/Vite build passes. Affected-file lint exits 0 with one existing SalesPage hook warning. Full lint remains **8 errors/16 warnings**, exit 1, versus 12/16 previously: four existing `any` usages in the touched sale form were replaced with its actual form/product types. Existing CSS import-order, bundle-size and timing warnings remain. [Frontend results](phase1b2/evidence/20261110-103709-frontend-4475e4cd/summary.json).

## 6. Real browser verification and reconciliation

**68 checks pass with zero uncaught page errors**, through React â†’ same-origin loopback Vite proxy â†’ Django â†’ fresh PostgreSQL. [Browser outcomes, mutation trace and final database rows](phase1b2/evidence/20261110-105147-postgres-browser-84994e82/browser.json), [readable log](phase1b2/evidence/20261110-105147-postgres-browser-84994e82/browser.txt).

The original 44 owner/CSRF behaviors remain verified: real login/logout, expired/malformed-cookie recovery, token rotation, native hostile-Origin forms with matching tokens and attached JWT cookies, missing-token denial, same-UUID CSRF recovery, simulated lost successful response, reload/replay/conflict/invalid-cent handling, owner edit, stale revision rejection, exact cancellation, one-quantum stock adjustment, insufficient stock, dashboard/report consistency and retained history.

Added browser checks prove staff login/home, restricted navigation/routes, readonly catalog and stock, exact HTTP projections, no financial fetches from staff pages, initially empty own history despite other users' records, readonly price/date controls, successful staff sale at the current price/date, hidden other-user IDs, no edit/cancel/export buttons, direct API 403/404 denials with unchanged business snapshots, owner re-login with full projections/history, live downgrade/cache behavior, and an anonymous storefront that still renders with an expired cookie while private stock remains 401. Expected HTTP denial/conflict/reset console messages are retained; external requests were blocked. They are not reported as a clean browser console.

Screenshots reviewed: [staff stock](phase1b2/evidence/20261110-105147-postgres-browser-84994e82/staff-stock-projection.png), [own tracked history](phase1b2/evidence/20261110-105147-postgres-browser-84994e82/staff-own-tracked-history.png), [anonymous storefront](phase1b2/evidence/20261110-105147-postgres-browser-84994e82/anonymous-storefront.png).

Concrete final reconciliation preserves the original nine-decimal allocation and signed postings:

- Owner sale 1: +50.00 gross, +40.50 edit adjustment, âˆ’90.50 cancellation. Owner sale 2: +50.00 gross, âˆ’50.00 cancellation. Both original sales/lines retained; net 0.00.
- One explicit observed flour adjustment adds 0.000000001 kg. Two staff each record one unit with the 0.01/3 recipe, adding +50.00 each; no owner financial authority is exposed to them.
- Final **four retained sales, nine inventory operations, seven financial postings**. Gross **200.00**, adjustments **+40.50**, signed cancellations **âˆ’140.50**, net **100.00**. Cancellation does not record a cash refund.
- Final flour **19.993333334 kg**, milk **9.993333333 l**. Applied usage/reversal snapshots and monotonic basis allocation reconcile through the existing `assert_reconciled` check. Unauthorized attempts add no operations, movements, consumptions or postings. No historical quantities were invented or redistributed.

## 7. Modified files

Backend application files:

- New `backend/accounts/permissions.py`, `admin_config.py`, `admin_site.py`, `middleware.py`.
- `backend/accounts/authentication.py`, `views.py`; `backend/backend/settings.py`.
- `backend/products/views.py`, `serializers.py`; `backend/ingredients/views.py`, `serializers.py`.
- `backend/recipes/views.py`, `backend/expenses/views.py`, `backend/dashboard/views.py`.
- `backend/sales/views.py`, `services.py` â€” scope/authorization checks only; stock and financial algorithms retained.

Existing business fixture files: `backend/sales/tests.py`, `test_release_blockers.py`, `test_verification_extended.py` â€” exactly one admin role keyword each.

Frontend application files:

- New `frontend/src/lib/permissions.ts`, `frontend/src/pages/OperationalPages.tsx`.
- `frontend/src/components/ProtectedRoute.tsx`, `GuestRoute.tsx`, `SaleRow.tsx`.
- `frontend/src/hooks/useAuth.ts`, `useSales.ts`.
- `frontend/src/layouts/MainLayout.tsx`, `frontend/src/router/index.tsx`.
- `frontend/src/pages/SalesPage.tsx`, `SaleFormPage.tsx`.

Verification additions in `docs/phase1b2/`: `rbac_regressions.py`, `rbac_concurrency.py`, `test_permissions.mjs`, `browser_checks.py`, `run_checks.py`, `result_runner.py`, `verification_settings.py`, `run_frontend.py`, `static_review.py`, `summarize_results.py`, `README.md`, `verification-summary.json`, timestamped raw logs/JSON/screenshots. Documentation: this report, root `README.md`, `docs/PROJECT_STATUS.md`, `docs/CHANGELOG.md`.

## 8. Preservation, isolation and outstanding risks

Static provenance compares **539 protected existing files** against `d696a74`: earlier evidence/reports, all models/migrations, inventory/financial kernels/reporting/storage precision and CSRF/operation-identity transport remain unchanged. The central frontend/backend capability lists match. Core CSRF authenticator, bootstrap, logout, cookie helpers and enforcement are also AST/source-checked unchanged. No migration was generated. The approved ingredient 0004 and sales 0003 hashes remain `6b16f329b58d1dd2385c053f8bda98466f77f2483eafa275a6d66f810ef4843c` and `56b12876f54896011f31b8c089bf0553e6f5c047481eaddba7eb25d6502cff14`.

All DB work used ownership-verified fresh SQLite files and loopback PostgreSQL 17.11 containers under READ COMMITTED, with generated credentials, no persistent mounts and dotenv discovery disabled. Existing migrations only were applied to these disposable targets. The retained Phase 1A.3 safety-profile marker is unchanged; environment metadata separately identifies Package 1B.2. Test-only HTTP cookie/fast-password overrides follow ownership validation; CSRF was never disabled. Browser processes were hidden, ports exclusive and external networking blocked. Logs exclude raw credentials/JWTs/CSRF secrets. Completed owned targets and browser process trees were removed; no production DB/account was examined or changed.

Unsuccessful attempts remain visible: Docker was initially stopped, so one baseline startup failed before target creation (cleanup retained); the first versioned browser run used the previous day's fixed date and could not find its sale under today's UI filter. The browser fixture now uses the current Manila date while retaining the same assertions. Visual review also caught an early staff-history screenshot during loading; final checks explicitly wait for visible stock/catalog/sale rows before testing absent controls. Earlier successful suites/partial coverage and later complete runs are all listed by the summarizer. Prior package evidence was not overwritten.

Remaining issues:

- The three 1B.3 requirements still fail: copied access survives logout/password change, and failed logins are not throttled. Token lifetimes remain 60 minutes/7 days; no new refresh route or durable device sessions were added. Deactivation/deletion checks remain enforced. Role authorization is current, but this package does not provide token/session revocation or prevent an old still-valid UID token from regaining privileges after later promotion/reactivation.
- Unsupported/dependency-security findings, full lint failures, other prior upload/export/XSS/operational findings and actual HTTPS/proxy/cookie deployment verification remain open. Controlled local tests do not establish production security or ISO certification.
- Pending intents remain actor-scoped and conservative. An uncertain UI request whose payload changes after reload/catalog changes receives a conflict and requires reconciliation; it is not silently assigned another UUID or repriced. Exact original API replay is verified, including after catalog/date/recipe changes. Existing legacy reconciliation safeguards remain mandatory; no ownership or consumption was backfilled.

Authorization follows [OWASP least-privilege/default-deny guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [DRF's separate permission/queryset/serializer responsibilities](https://www.django-rest-framework.org/api-guide/permissions/). The actor-lock choice follows [PostgreSQL's row-lock compatibility rules](https://www.postgresql.org/docs/17/explicit-locking.html). Risk ownership/review remains the project's ISO/IEC 27001:2022-oriented treatment process, not certification.

## 9. Recommended next step â€” separate 1B.3 design checkpoint

After accepting 1B.2, review an **exact revocable device-session and distributed throttling design** before implementation: model/field/constraint/index/FK details; token/session binding; 15-minute access, 30-minute idle and 8-hour absolute limits; current-device logout and password/role/deactivation revocation; refresh rotation/reuse detection; concurrent refresh/revoke/sale behavior and lock order; shared atomic failure counters with verified client IP; outages/monitoring/retention; additive migration, backup, compatibility and rollback plan. Preserve the currently failing requirements as release blockers and add real PostgreSQL/distributed-counter evidence once separately authorized. No session table, migration or infrastructure is authorized by this package.

**STOP after 1B.2. Await owner review before beginning 1B.3.**
