# Phase 1C.2A — Cache identity correctness

Date: 2026-11-11. Accepted baseline: `b990398`. Branch: `codex/phase-1c2a-cache-identity`.

**F04 is repaired in the verified workflows.** Lists and details cannot share query identities, and actor/role scopes separate private projections. This package changes six frontend files only, plus new verification/report files. No backend, model, migration, dependency, date logic, pagination contract or derived-cost invalidation change was made. Production deployment remains unauthorized.

## 1. Original failure reproduction

Before application edits, a real headless Edge browser used the existing React application, actual Django cookies/CSRF/session checks and an owned SQLite database with 25 synthetic ingredients/products/recipes. Ingredient ID 2 sorts onto page 2, allowing the second collision to be reached through actual row actions.

| Actual navigation | Before repair |
| --- | --- |
| Ingredient page 1 → Edit ingredient ID 1 | Empty name/quantity rather than ingredient 1. |
| Ingredient detail → list | Passed as a control. |
| Ingredient page 2 → Edit ingredient ID 2 | Empty name/quantity rather than ingredient 2. |
| Recipe page 1 → Edit recipe ID 1 | Product `0`/placeholder rather than product `1`; blank recipe fields. |

Before result: **4 checks, 3 failed requirements and 1 passing control**, no recorded page script errors. Evidence: [before.json](phase1c2a/evidence/20261111-093233-sqlite-before-33d9f656/before.json), accompanying logs and three screenshots. This was collected before frontend implementation, not inferred from isolated key tests. The local Docker engine was initially unavailable; it was started for subsequent disposable PostgreSQL verification. The failed initial PostgreSQL setup ran no tests and its cleanup evidence is retained separately.

## 2. Root cause and related initialization race

The old keys were `['ingredients', page]` versus `['ingredients', id]`, and `['recipes', page]` versus `['recipes', id]`. With a 60-second default stale time, detail observers treated the corresponding fresh paginated envelope as a detail DTO and did not fetch the requested record. Form reset code then read nonexistent fields.

The first repaired browser run also exposed a reload race: the correct recipe could arrive before its existing product/ingredient choices. Resetting an uncontrolled select before those options existed left the selected product at `0`. Recipe form loading/initialization now waits for those same lookup requests to finish. **It still requests page 1 only**; this does not repair F02 or add lookup pages.

Route-ID changes now remount the local form state, preventing unsaved fields/files from the previous record carrying into the next one. Ingredient image preview derives from the current detail unless a new local upload exists; local object URLs are cleaned up. These are record-identity changes, not a visual redesign.

## 3. Query keys, hooks and invalidation

`managementQueryKeys.ts` contains typed factories. For actor `{id: 1, role: 'admin'}`:

| Query | New identity |
| --- | --- |
| Ingredient list page 1 | `['ingredients', 'list', {userId: 1, role: 'admin'}, {page: 1}]` |
| Ingredient detail ID 1 | `['ingredients', 'detail', {userId: 1, role: 'admin'}, 1]` |
| Ingredient low stock | `['ingredients', 'low-stock', {userId: 1, role: 'admin'}]` |
| Recipe list page 1 | `['recipes', 'list', {userId: 1, role: 'admin'}, {page: 1}]` |
| Recipe detail ID 1 | `['recipes', 'detail', {userId: 1, role: 'admin'}, 1]` |

The current list services accept only `page`; it is included explicitly. Local search/category/status controls are not API parameters and are unchanged. Future server filters must join both the query key and request when separately implemented.

Affected hooks: `useIngredients`, `useIngredient`, `useLowStockIngredients`, `useRecipes`, `useRecipe`, and their create/update/delete/stock prefix invalidations. Hook call signatures remain compatible. Reviewed callers include ingredient/recipe lists and forms, staff `OperationalStockPage`, recipe ingredient lookups, and sales mutations.

The root prefixes remain **`['ingredients']` and `['recipes']`**. Existing sales/stock invalidations still match all affected lists, details and low-stock queries; create/update/delete invalidation retains the original resource scope. No ingredient mutation now invalidates recipes/margins: **F05 remains unchanged**.

Detail queries require a positive safe integer ID and the applicable management capability. A successful response must contain exactly the requested numeric `id`; list envelopes or another ID become an error and cannot populate a successful detail cache. Returned detail data is hidden on query error, invalid ID or lost authority. Detail reads use explicit retry after failure, rather than repeatedly fetching a missing record. No business mutation retry behavior was changed.

Both forms distinguish loading, invalid ID, missing record and failed query. The shared `RecordLoadError` offers safe feedback, retry where appropriate and return-to-list navigation. It does not expose raw server error bodies. Nonnumeric/unmapped paths continue to fail closed under existing route guards.

## 4. Actual after-repair browser evidence

Final actual React/Edge/PostgreSQL run: **58 checks passed, 0 failed, no harness failure and no recorded page script errors**. Canonical evidence: [browser.json](phase1c2a/evidence/20261111-094826-postgres-browser-2d5abfc6/browser.json), its API method/path/status/field-name observations and screenshots.

| Scenario | Actual result |
| --- | --- |
| Ingredient page 1 → ID 1 | Correct name, supplier and exact readonly quantity. |
| Ingredient page 2 → ID 2 | Correct ID 2 fields; never a list envelope. |
| Ingredient detail → list | Correct paginated list shape/rows. |
| Recipe page 1 → ID 1, then list | Product `1`, yield `3`, correct list rows. |
| Record switching / cached revisits | Recipe 1 → 3 → 1 and ingredient 1 → 2 → 1 stay on the requested records; previous unsaved notes/supplier are discarded. |
| Loading | A real authorized recipe response was delayed: no previous form/text displayed. Reload with delayed existing product lookup renders loading until options arrive. |
| Reload and direct edit | Recipe reload and ingredient direct navigation/reload populate the correct fields. |
| Successful edits | Ingredient metadata edit and recipe yield/notes edit return 200; list and detail revisits show committed values and perform the expected invalidated detail fetch. |
| Missing / invalid IDs | Actual 404s for ID 99999 show no editable form. Zero/unsafe-integer IDs show no form; zero IDs issue no detail request. |
| Query failure / recovery | Injected 503 response shows no form; explicit retry loads the requested record. |
| Mismatched response ID | Injected wrong-ID detail response is rejected, with no editable form for the wrong record. |
| Create / delete | Actual ingredient and recipe POST/DELETE succeed, lists refresh, and revisiting cached deleted details yields not-found without an editable form. Created recipe is found through normal pagination, without assuming the preexisting unordered endpoint places it on a particular page. |
| Owner/staff/anonymous transitions | Passed the checks described in section 6. |

The browser uses actual application row menus/buttons for list/detail entry, real forms for mutations, sidebar navigation and actual reloads. Native browser history events additionally exercise record-to-record route reuse. No helper-only result substitutes for real React navigation.

Fault injection is limited to selected GET responses **after the real server returns an authorized 200**: delay, synthetic 503 or deliberately mismatched ID. Authentication, CSRF, roles, session validation and business services are never mocked. The ordinary missing-record checks are actual API 404s. External browser traffic is blocked; no tokens, passwords or cookie values are recorded.

Intermediate runs are retained: the first stopped at the genuine lookup-initialization race (then fixed); another passed 44 checks before a test incorrectly assumed the created recipe's page; a later run passed 54 checks before a synthetic visibility event was delivered to `document` instead of the installed Query focus listener on `window`. The final run corrects those test mechanics while retaining all prior assertions and evidence. It explicitly observes the real authority recheck returning 401.

## 5. Backend and frontend regression totals

| Verification | Actual result |
| --- | --- |
| Complete accepted preservation scope, PostgreSQL 17.11 | **250 run: 249 passed, 1 SQLite-only skip, 0 failures/errors**. |
| Same scope, SQLite | **250 run: 215 passed, 35 PostgreSQL-specific skips, 0 failures/errors**. |
| Phase 1A business tests within that scope | PostgreSQL **120/120 passed**; SQLite **103 passed / 17 PostgreSQL-specific skips**. All ten integrated release-blocker contracts pass. |
| Original role and CSRF assertions | Original **13 role requirements** and **26 CSRF regressions** pass on both engines; expanded 21 RBAC regressions also pass. |
| Session/throttling/concurrency | Included unchanged in the 250-test scope, including copied-token logout, password/role revocation, shared atomic limiter and independent PostgreSQL connection tests. SQLite skips unsupported PostgreSQL cases explicitly. |
| New QueryClient identity/invalidation tests | **9 passed** using the installed real QueryClient/QueryObserver, including scope separation, prefix invalidation, invalid IDs, wrong response shapes and observer switching. |
| Existing frontend regressions | **52 passed**: CSRF transport 14, operation identities 13, stock preview 10, permissions 10, authentication lifecycle 5. **61 frontend tests total.** |
| TypeScript / frontend build | **Passed** (`tsc -b` followed by Vite build with empty env directory). Existing CSS import-order and large-chunk warnings remain. |
| Affected-file ESLint | **Passed: zero errors/warnings** across all six changed application files. |
| Full-project ESLint | **Still fails: 5 errors, 16 warnings** outside the changed files. The old form `any` and image-effect violations disappeared as part of typing/current-record initialization; unrelated F15 debt was not repaired. |
| Browser baseline / final | Baseline 3 failing requirements + 1 control; final **58/58 passed**. |

Canonical preservation directories are `phase1c2a/evidence/20261111-093647-postgres-preservation-ffc8bb2a` and `20261111-093642-sqlite-preservation-eeb9f05c`. Final frontend checks are in `20261111-094823-frontend-3706197b`. Per-test outcomes and skip reasons are retained, rather than treating skips as passes. Existing assertions/fixtures and historical evidence were not weakened or rewritten.

The [machine-readable summary](phase1c2a/verification-summary.json) records these results and cleanup checks. All **28 Phase 0 evidence hashes** and **119 accepted Phase 1C.1 manifest hashes** match. All owned runtime directories are removed, PostgreSQL test containers are removed, and both test ports were successfully bound and released to verify availability. Exact verification-file hashes are in [manifest.json](phase1c2a/manifest.json).

## 6. Role-aware cache isolation

Actor ID and role participate in every affected private query identity; undefined authority has a separate disabled scope. Queries use the existing capability rules, not Django technical superuser flags. Backend authorization remains authoritative and unchanged.

Existing login/logout/renewal `queryClient.clear()`, failed `useMe` authority handling and `ProtectedRoute` authority-change reset remain unchanged. No query-cache persistence was introduced. Pending idempotency identities retain their existing actor-scoped storage and UUID/revision behavior.

Real-browser evidence includes:

- Hold an actual owner detail response, log out through the application, release that response, then log into staff **without reloading the app**. No owner form/supplier fields appear.
- Staff navigation issues a fresh ingredient list request returning only the operational projection; recorded field names exclude supplier and cost. Staff has no edit actions or cached recipe form.
- Staff PATCH with real cookies and a freshly bootstrapped valid CSRF token returns **403**. Complete before/after state equality across the 13 business models confirms zero business/ledger mutations.
- Logout then anonymous private navigation shows the login flow and no private fields, without reloading away the cache under test.
- A different owner account obtains an authorized fresh detail through normal authentication.
- Demote the current synthetic owner in the disposable DB; trigger the existing visibility authority recheck. Actual `/auth/me/` returns **401**, the owner view disappears, and password login as the same actor now in staff role renders operational stock with no owner data. No new role-management endpoint was added.

This verifies cache behavior after an authority recheck; it does not introduce continuous role polling or claim the client can know about a server-side change before rechecking. Existing server-side revocation tests remain passing.

## 7. Files changed and verification isolation

Application files:

| File | Change |
| --- | --- |
| `frontend/src/lib/managementQueryKeys.ts` (new) | Typed scoped key factories, safe-ID check and requested-record guard. |
| `frontend/src/hooks/useIngredients.ts` | Scoped separate keys, enabled capability checks, guarded detail data and compatible root invalidation. |
| `frontend/src/hooks/useRecipes.ts` | Equivalent recipe keys/guards and typed detail data. |
| `frontend/src/components/RecordLoadError.tsx` (new) | Shared safe loading-failure/invalid-ID/missing-record feedback and retry/back actions. |
| `frontend/src/pages/IngredientFormPage.tsx` | Keyed per-record form state, explicit detail states, current-record image handling. |
| `frontend/src/pages/RecipeFormPage.tsx` | Keyed form state, typed lookup rows, lookup-ready initialization and explicit error states. |

Documentation/evidence: this report and new `docs/phase1c2a/` runners, settings, browser/QueryClient tests, synthetic fixture server, README, summary and raw evidence. The manifest lists the new verification files. All backend files, dependency declarations/locks, auth guards/transports, operation identity code, sales logic and accepted audit evidence remain unchanged.

Isolation reuses the accepted migration-hash, ownership, generated credential, loopback-only, tmpfs/no-bind-mount and no-dotenv guards with an additional current-package authorization marker. Only accepted migrations run in freshly owned disposable targets. Browser servers are owned hidden child processes; cleanup stops only those processes and removes only owned resources. SQLite uses a workspace UUID directory. All fixture data is synthetic and destroyed; no existing business database or production resource was used. This is not persistent demo-data generation.

Reproduction commands from repository root:

```powershell
# Run 'before' only against the accepted baseline, before applying this repair.
backend/.venv/Scripts/python.exe -B docs/phase1c2a/run_checks.py --backend sqlite --scope before
backend/.venv/Scripts/python.exe -B docs/phase1c2a/run_checks.py --backend postgres --scope browser
backend/.venv/Scripts/python.exe -B docs/phase1c2a/run_checks.py --backend postgres --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c2a/run_checks.py --backend sqlite --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c2a/run_frontend.py
```

The `before` mode records desired-behavior failures without treating collection completion as an application pass. The final browser mode exits nonzero on a failed check or harness error. PostgreSQL requires the existing cached local image/engine; browser tests require installed Edge/Playwright and free loopback test ports. There is no fallback to project/production database settings.

## 8. Remaining F04 issues and limits

No remaining list/detail identity collision was observed in the required verified workflows. Matching IDs, scoped identities, cache revisits, successful mutations, failure states and authentication transitions are covered. Server DTO ID/shape errors fail visibly rather than populating another record's form.

This is controlled local evidence, not exhaustive browser/device coverage or production readiness. The browser checks related selectors whose selected records are in the existing loaded lookup page. An off-page related product/ingredient can still be unavailable in a selector; that is the explicitly deferred F02 limitation, not a claim that every recipe is now fully editable. No new regression test was used to bless that limitation as correct behavior.

## 9. Explicit scope boundaries: F02 and F05

**F02 stays open:** selectors/storefront still fetch their original pages; no global search/filter/order contract, page-size change or complete lookup fetching was introduced. Existing recipe ordering remains unguaranteed. Waiting for an existing lookup is essential form-initialization compatibility, not pagination repair.

**F05 stays open:** resource-root invalidation is preserved, not broadened. Ingredient cost changes still do not invalidate derived recipe/margin caches. No financial/cost recomputation or cross-resource invalidation expansion was added. Other audit findings, date bugs and dependency/production release gates also remain separately tracked.

## 10. Recommended next package and stop

Recommended next review: **Package 1C.2B — complete catalog/lookups and pagination**, with explicit server filter/search/order contracts, >20-record selector/storefront tests and unchanged public/staff-safe projections. It requires separate implementation approval.

Package 1C.2A ends here after the local commit. Do not start 1C.2B, dependency upgrades, schema changes, redesign or deployment automatically.
