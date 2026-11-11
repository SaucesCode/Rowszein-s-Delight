# Phase 1C.2B — Catalog, lookup and pagination repair

Date: 2026-11-11. Accepted baseline: `98e29bf`. Branch: `codex/phase-1c2b-pagination-lookups`.

**F02 and CAT-01 are corrected in the verified workflows.** Later-page records are discoverable in the storefront, management lists and selectors. Edit forms retain their selected off-page relations. F04 remains passing. No models, migrations, dependency versions, money/stock algorithms, or authentication/permission controls changed. Production deployment remains unauthorized.

## Before and after

Before application edits, real Edge/React/Django verification with 25 synthetic records reproduced three failures on the accepted baseline:

| Requirement | Before | After |
| --- | --- | --- |
| Management search finds ingredient 25 | No match from the loaded first page | Server search returns the record and resets the list to page 1 |
| Recipe 25 displays its selected product | Product selector value `0` | Exact-ID lookup displays product `25`; ingredient `25` also remains selected |
| Sale selector offers product 25 | No corresponding option | Search and incremental loading find and select it |
| Featured product on a later catalog page | Prior CAT-01 audit showed `is_featured` was ignored; storefront filtered its first page only | Independent filtered API query shows the featured record before the menu reaches that page |

The three fresh baseline failures are in [before.json](phase1c2b/evidence/20261111-100807-sqlite-before-25-5f2e86f2/before.json), with screenshots. CAT-01's API reproduction remains in the accepted Phase 1C.1 evidence; the relevant backend was unchanged by 1C.2A. A successful baseline collection process is not a passing requirement.

## API contracts and backend implementation

The complete contract is in [API_CONTRACT.md](phase1c2b/API_CONTRACT.md). The existing URLs, success envelope and default page size of **20** remain unchanged. The listing-specific maximum also stays **20**. There is no unpaginated mode, global pagination setting change, or fetch-all endpoint.

| List | Search | Filters | Allowlisted ordering |
| --- | --- | --- | --- |
| `/api/products/` | name, description | exact `id`, category ID, `is_available`, `is_featured`, `category_active` | name/default, price; owner also created_at; each ascending/descending |
| `/api/products/categories/` | name, description | exact `id`, `is_active` | sort_order/default with name tie, name; ascending/descending |
| `/api/ingredients/` | name; owner also category/supplier | exact `id`, unit, stock status; owner also category | name/default, quantity; owner also minimum_stock, cost_per_unit, inventory value; ascending/descending |
| `/api/recipes/` | product name | exact `id`, product category ID | product name/default or descending, highest batch cost, lowest cost/unit, most ingredients |

All orders append a unique PK tie-breaker. Filters/search run before pagination. `page_size=1..20` is optional; `page` defaults to 1 and the existing DRF `last` alias is retained. Empty optional values default/omit; a valid empty first page returns `200` with zero results, malformed/duplicate/unknown listing parameters return `400`, and a valid page beyond the range returns `404`. Existing DRF format negotiation is unchanged. Search is trimmed and capped at 100 characters; boolean values are `true`/`false`. Error bodies do not expose private values or raw database errors.

The listing mixin runs on the **already-authorized queryset**. Anonymous products still require availability and active category; anonymous categories still require active status. An explicit false filter cannot widen those constraints. Staff queries cannot infer owner-only ingredient metadata via category/supplier search or cost/threshold ordering; product creation timestamps are not an ordering option for public/staff. Existing operational serializers and permission checks remain authoritative. Recipes remain owner-only. Category product-count annotation is only needed for the owner projection.

Recipe lists now include a read-only category projection from the joined product/category. This replaces the frontend's incomplete cross-reference to the first product page. Recipe cost ordering ranks SQL ingredient totals; existing serialized Decimal cost calculations and ledger algorithms are unchanged. SQLite read ranking explicitly avoids integer division; PostgreSQL retains numeric arithmetic. No values are written by listing queries.

## Frontend and cache implementation

- Storefront menu and featured sections use independent bounded queries. Menu/category search and load-more discover later pages; loading, no-match, error/retry and end-of-list states are visible. Storefront requests omit cookies even when visited by an owner, using the same anonymous API projection and a separate public cache identity. Only safe public GET requests use that path; private transport, CSRF bootstrap and mutations are unchanged.
- A shared searchable lookup loads one page at a time and deduplicates by ID. Product, ingredient and category form selectors use it. A selected off-page record is fetched using the same authorized list endpoint with exact `id`; already-loaded selections need no separate lookup. Native selects remain controlled so arriving options do not reset an edit's selection. Recipe product remains immutable on edit. Loading a sale's selected product does not set its price; only a user selection fills a new unit price.
- Product/ingredient/recipe management searches, filters and sorts run on the server. Staff operational catalog/stock search stays read-only. Management controls reset to page 1 when their filters/order change; if a mutation removes the last page, the list recovers to page 1. Returned products display in server order without dropping rows whose category was absent from a prior lookup page. Existing card/layout styling was retained.
- Resource prefixes and distinct list/detail namespaces from 1C.2A remain. Actor/role and normalized request parameters are included in private keys; infinite queries track page parameters within the filter-specific identity. New searches/filters use separate result families; revisiting the same valid key may reuse its cached pages. Axios/fetch consume the query abort signal. A delayed old search response cannot replace the current result. Existing mutation invalidation prefixes cover the new lookups and public catalog queries; ingredient edits still do not invalidate derived recipe/margin caches.

## Verification

| Check | Actual result |
| --- | --- |
| Baseline browser, 25 records, SQLite | 3 expected failing requirements, no page script errors |
| Final browser, **20** records, PostgreSQL | **14/14 passed**. No extra page at 20; create 21st row, update it, delete sole last-page row and recover to page 1. |
| Final browser, **21** records, PostgreSQL | **14/14 passed**. One extra menu row, later-category filter, owner storefront still public-safe. |
| Final browser, **25** records, PostgreSQL | **32/32 passed**. Later-page selectors, edit pins, historical price, role projections, old-response rejection and F04 navigation. |
| Listing contract API, PostgreSQL | **14 passed**, 0 failures/errors/skips |
| Listing contract API, SQLite | **14 passed**, 0 failures/errors/skips |
| Accepted preservation, PostgreSQL | **250 run: 249 passed, 1 SQLite-only skip, 0 failures/errors** |
| Accepted preservation, SQLite | **250 run: 215 passed, 35 PostgreSQL-specific skips, 0 failures/errors** |
| Frontend utilities and accepted regressions | **66 passed**: 5 new listing tests, 9 accepted F04 tests, 52 accepted transport/identity/stock/permission/session tests |
| TypeScript + Vite | Build passed; existing CSS import-order and bundle-size warnings remain |
| Affected-file lint | Passed with **0 errors, 1 existing ProductForm `watch()` warning** |
| Full-project lint | Still fails with **4 errors, 5 warnings**; unrelated F15 work remains deferred |

The API suite covers 0/1/20/21/25 products, all four 25-row lists, similarly named data, tied prices across pages, malformed/duplicate params, featured true/false, hidden and inactive-category public exclusions, exact-ID/category filtering, SQLite fractional read ranking, field/parameter side-channel restrictions, and zero business mutations on reads/denials. The accepted suite includes all 120 PostgreSQL Phase 1A business tests and ten integrated contracts, 13 original role requirements, 26 CSRF checks, 21 expanded RBAC checks, session/throttling and independent PostgreSQL concurrency. SQLite skips are reported separately. No accepted assertion was changed.

The real browser tests use actual Django cookies, authorization and CSRF, not mocked auth. The delayed-search case holds a real authorized response, changes the search, and verifies the new result remains. The historical-price case records a synthetic sale at ₱31 and opens its off-page product (catalog price ₱50) without repricing. Staff then finds the later product and receives only the approved stock projection. No browser script errors were recorded in final runs. The final narrow compatibility check retained the DRF `last` alias and original product grid classes; contract/build checks reran for those changes, while the browser and preservation runs exercised the unchanged numeric-page behavior.

Canonical evidence directories under `docs/phase1c2b/evidence/`:

| Evidence | Directory |
| --- | --- |
| 20-record browser | `20261111-103637-postgres-browser-20-96432e23` |
| 21-record browser | `20261111-103757-postgres-browser-21-4a10bf32` |
| 25-record browser | `20261111-103200-postgres-browser-25-285e5500` |
| Final PostgreSQL listing API | `20261111-104104-postgres-api-25-60867cb4` |
| Final SQLite listing API | `20261111-104055-sqlite-api-25-b2dba904` |
| PostgreSQL preservation | `20261111-103223-postgres-preservation-25-2590096b` |
| SQLite preservation | `20261111-103155-sqlite-preservation-25-c7a1e2da` |

[Verification summary](phase1c2b/verification-summary.json) identifies final frontend logs, exact totals and cleanup. All 28 Phase 0, 119 Phase 1C.1 and 101 Phase 1C.2A manifest hashes match. Intermediate evidence is retained: initial setup hit a duplicate-keyword syntax error; a category fixture included five migration-seeded test categories; SQLite needed an explicit output type for read-only division; an initial browser assertion selected both responsive DOM variants. These were corrected in implementation or new harness code as applicable. They are not counted as final passes.

## Performance and limits

Captured full request query counts for recipe lists with page sizes 1 and 20 were **15/15 on PostgreSQL**, **13/13 on SQLite**, including session/transaction work. Related product/category joins and bounded ingredient prefetching avoid per-returned-row query growth in this sample. Exact-ID pins are bounded, keyed and reused; listing responses never exceed 20. Categories do not annotate owner-only counts on public/staff reads.

This is not a production-size benchmark. SQL `COUNT`, substring matching and computed sorts may scan matching rows using the current indexes. Stable ordering does not provide a snapshot across separate offset pages under concurrent external writes; the client deduplicates IDs and normal authorized mutations invalidate the relevant families. No schema/index/cursor redesign was introduced.

## Changed files, isolation and deferred work

Application source:

- Backend: `backend/backend/catalog_listing.py`, `backend/products/views.py`, `backend/ingredients/views.py`, `backend/recipes/views.py`, `backend/recipes/serializers.py`.
- Frontend services: `listing.service.ts`, `product.service.ts`, `ingredient.service.ts`, `recipe.service.ts` under `frontend/src/services/`.
- Hooks/keys/types: `useListingPages.ts`, `useListingPageRecovery.ts`, `useProducts.ts`, `useIngredients.ts`, `useRecipes.ts`, `listingParams.ts`, `managementQueryKeys.ts`, `recipe.types.ts`.
- Components/pages: `PaginatedLookup.tsx`, `RecipeCostPreview.tsx`, `LandingPage.tsx`, `ProductsPage.tsx`, `IngredientsPage.tsx`, `RecipesPage.tsx`, `OperationalPages.tsx`, `ProductFormPage.tsx`, `RecipeFormPage.tsx`, `SaleFormPage.tsx`.
- This report and `docs/phase1c2b/` contain the API contract, new test wrappers/fixtures/checks and raw verification evidence. The manifest hashes those verification files.

Verification uses the accepted migration-hash, no-dotenv, ownership, loopback-only and tmpfs/no-bind-mount guards, plus a package marker. It runs only existing accepted migrations on freshly created disposable targets. Synthetic browser rows are destroyed; they are not persistent demo data. Browser processes and all owned databases/containers/runtime directories are cleaned up. Historical evidence and application auth/ledger code remain unchanged.

**F05 remains open:** no cross-resource derived-cost invalidation or new cost calculation was added. **F11 remains open:** page-scoped ingredient/recipe aggregates and export scope were not made global. The minimal shared-contract adjustments label the product count as matching and hidden count as page-scoped, and avoid showing the old partial missing-recipe sample on filtered/nondefault recipe pages. Existing expense/sales exports and financial semantics are unchanged. No category CRUD screen or protected-delete fix was added; category API management and all existing selectors/filters now paginate correctly. Full mobile/layout review, date logic, numeric constraints, dependency work and production gates remain separate.

Recommended next review: **1C.3A — Manila dates and strict date filters**, per the accepted repair sequence. Package 1C.2B stops after its local commit. No subsequent package, dependency upgrade, demo generation, redesign or deployment begins without approval.
