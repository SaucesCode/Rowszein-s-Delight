# Rowszein's Delight — Phase 0 project revival audit

Date: 2026-11-09 (Asia/Shanghai). Baseline commit: `78ee4a0`. Audit branch: `codex/phase-0-revival-audit`.

## Scope and decision

**Phase 0 only is complete. Phase 1 requires the owner's explicit approval.** The existing application is worth preserving, but its inventory transactions and security controls are not ready for operational use. No application implementation, requirements, lockfile, deployment configuration, existing migration, or production record was changed. Additions are documentation, reproducible audit scripts, and evidence.

The assessment covers all seven Django apps, their models/serializers/views/URLs/migrations/admin/test files, all frontend source directories, service/query integration, forms and lists, project documentation, build/lint configuration, and tracked deployment files. No `AGENTS.md` was found in the repository or checked ancestor directories. Existing project guidance was read; the user's comprehensive audit takes precedence over older one-module implementation guidance. Later implementation should still proceed one module at a time.

Evidence labels used below:

- **Reproduced:** exercised against current code in isolated tests or the local browser.
- **Source-confirmed:** directly demonstrated by source/configuration inspection; production impact is not automatically established.
- **Risk/unverified:** plausible concern requiring a separate experiment or environment access.

The backend audit uses disposable **SQLite memory databases**, never the configured business database. Browser fixtures contain 25 synthetic products, ingredients and recipes, and no sales/expenses. These deliberately simple fixtures expose pagination problems; they are not Phase 2 demo seeding. A random per-run local password is generated in memory. Browser requests outside localhost are blocked. No production service, credentials, deployment, or production migration was used.

## Verified architecture

| Area | Current implementation |
| --- | --- |
| Backend | Django 5.1.4, DRF 3.15.2, SimpleJWT 5.3.1; apps `accounts`, `ingredients`, `products`, `recipes`, `sales`, `expenses`, `dashboard` |
| Database | `DEBUG=True`: PostgreSQL through separate `DB_*` variables, default port 5433. `DEBUG=False`: `DATABASE_URL` parsed by dj-database-url. Actual deployed engine/data not inspected. |
| Frontend | React/ReactDOM 19.2.7 installed from lockfile, TypeScript 6.0.3, Vite 8.0.16, Tailwind 4.3.0; React Router 7; Axios; TanStack Query; RHF/Zod; Recharts; Lucide; react-hot-toast |
| UI | Warm cream/pink/chocolate interface already exists. shadcn configuration and one generated Button exist, but the Button is not reachable from the main entry point; most UI is custom. |
| Authentication | Backend JWT access/refresh cookies, HttpOnly; Axios `withCredentials`; `/auth/me/`; owner routes guarded in React. No token storage in local/session storage. Public cart alone uses sessionStorage. |
| State/data flow | Router → pages → query/mutation hooks → services → shared Axios `/api` → DRF. Landing page invokes services through its own queries. Query stale time 60 seconds, no refetch on focus. |
| Deployment evidence | `frontend/vercel.json` rewrites `/api/*` to a **Render** URL and remaining routes to `index.html`. Root `vercel.json` is empty. No tracked Railway/Render blueprint, Dockerfile, Procfile, or CI workflow found. Railway is not verified. |
| Static/media | WhiteNoise middleware; local image fields. Media routes only when DEBUG. Legacy `STATICFILES_STORAGE` is set but runtime resolves plain `StaticFilesStorage`; compression/manifest backend is not active. |

### Schema and integrity

| Entity | Relationships and important fields |
| --- | --- |
| User | Extends AbstractUser; `role=admin/staff` is independent of Django `is_staff`/`is_superuser`. Custom User is not registered in admin. |
| Ingredient | Unique name; quantity, cost/unit, minimum stock are Decimal(10,2); enumerated measurement/category; supplier is text; optional notes/image. |
| Category / Product | Product belongs to protected Category; unique names, positive price validated in API, availability/featured flags, image. Category has active/order flags. |
| Recipe / RecipeIngredient | One recipe per Product; product deletion cascades recipe. Ingredient links protected; unique recipe/ingredient pair; batch yield; current ingredient costs determine current recipe cost. |
| Sale / SaleItem | Sale date/total/notes; items cascade from sale, protect product; unique sale/product; quantity, historical unit price, stored subtotal. No status/refund/discount/tax fields. |
| Expense | Date, category, positive API-validated amount, description. Ingredient purchase expense does not restock inventory. |

No supplier entity, delivery module, purchase-order module, finished-product stock, inventory movement ledger, cost snapshot, sale actor, transaction idempotency key, or demo ownership marker exists. Do not add these silently: justify extensions and migrations in Phase 1/2. Database constraints cover FK/uniqueness and integer nonnegativity in places; ingredient monetary/quantity checks and strictly positive recipe yields are not enforced by database constraints. Existing validators are concentrated in serializers, which ORM/admin writes can bypass.

### API inventory

All paths below begin `/api/`; detail views support GET/PUT/PATCH/DELETE unless noted. List/create views support GET/POST; list payload is `{success,data:{count,next,previous,results},message}`, page size 20.

| Prefix | Endpoints | Access |
| --- | --- | --- |
| `auth/` | `login/` POST; `logout/` POST; `me/` GET | Login public; others authenticated |
| `ingredients/` | list/create, `<id>/`, `low-stock/` GET | Authenticated |
| `products/` | list/create, `<id>/`; `categories/`, `categories/<id>/` | Product/category list reads public; writes and detail reads authenticated |
| `recipes/` | list/create, `<id>/` | Authenticated |
| `sales/` | list/create, `<id>/`, `export/csv/`, `export/pdf/` | Authenticated |
| `expenses/` | list/create, `<id>/`, `export/csv/`, `export/pdf/` | Authenticated |
| `dashboard/` | summary GET; `profit-margins/` GET | Authenticated |

Sale/expense lists and exports accept date filters; malformed dates are silently ignored. Product/category list querysets do not implement availability/featured/category filtering. Low-stock and margin APIs are unpaginated. Generic error paths do not consistently use the documented envelope. `/admin/` is separate from `/api/`.

### Existing user-facing features

Public `/`: storefront/menu, featured cards, category buttons, local cart, downloadable order-summary image, Messenger/mail contact actions. The cart does **not** submit an order, reserve stock, or create a Sale. No payment/checkout exists.

Private owner panel: dashboard with date controls, sales/expenses chart and bestsellers; ingredient CRUD, low-stock list, direct stock adjustment and CSV; product CRUD/duplicate/availability; recipes with yield and live cost preview; sales/expenses CRUD, date filters and CSV/PDF; per-product margin overview. Desktop sidebar and mobile drawer/card alternatives already exist. CRUD routes exist, but this is not a claim that every flow is defect-free.

## Confirmed defects and reproductions

Backend reproduction entry point: `docs/audit/run_backend_audit.py`; exact assertions and results are retained in [backend-probes.txt](audit/evidence/backend-probes.txt). A green `test_defect_*` means the defective behavior was reproduced, **not repaired**. All sequences below use synthetic local data.

| ID / Priority | Finding and exact reproduction | Root cause / recommended correction |
| --- | --- | --- |
| INV-01 **Critical** | **Reproduced:** start stock 10, recipe uses 2, record one sale → 8. PATCH sale with invalid date → HTTP 400 but stock becomes 10; repeat → 12. | `backend/sales/views.py:84` restores inventory before validation. Validate first; make restore/update/deduct one atomic operation, with rollback tests. |
| INV-02 **Critical** | **Reproduced:** stock 10, requirement 20; sale returns 201 and stock 0. Delete sale → stock 20, rather than original 10. | `backend/sales/services.py:21` clamps insufficient stock to zero, then restore credits the full requirement. Reject insufficient stock under a lock; persist actual movement quantities. |
| INV-03 **High** | **Reproduced:** stock 10 → sell using 2 → 8; change recipe use to 3; delete sale → 11. Deleting recipe first instead leaves stock at 8 after sale deletion. | Restore uses current recipe/yield, not sale-time consumption. Record consumption snapshots/movements; define safe cancellation and recipe-change behavior. Historical consumption cannot be reconstructed reliably from current recipes alone. |
| INV-04 **High** | **Reproduced:** inject an exception in sale deduction; request fails 500 but Sale and SaleItem remain committed, inventory unchanged. | Create and stock update lack `transaction.atomic`; `ATOMIC_REQUESTS=False`. Introduce one transaction boundary in service layer; test failures after each write. |
| INV-05 **High** | **Reproduced:** identical valid POST twice creates two sales and deducts twice. Calling deduction service again also deducts again. | No operation identity, unique request key, or applied-movement guard. UI pending states help ordinary clicks but cannot protect HTTP retries. Define idempotency contract before schema/API changes. |
| INV-06 **High** | **Reproduced:** recipe uses 0.01 kg per batch of 3; record three separate one-unit sales. Stock remains 10.00 instead of 9.99. | Two-decimal stock persistence loses each 0.003333 deduction. Agree base-unit precision/rounding and store precise movement amounts; do not fix by hiding values. |
| COST-01 **High** | **Reproduced:** ingredient API PATCH with cost -1 is rejected 400. But set ingredient cost to -60 through model, call `full_clean()` and save: allowed, recipe cost becomes -120. | Serializer protection exists; model/database safeguards are absent (`ingredients/models.py:26`). Add model validators and DB constraints after auditing existing values. This demonstrates a reachable bypass, not evidence that production contains negative costs. |
| SALE-01 **Medium** | **Reproduced:** mark product unavailable and remove recipe; sale still returns 201 with no inventory deduction. | Sale serializer does not validate availability; service silently skips missing recipe. Agree whether any legitimate nonrecipe products may be sold, then enforce explicitly. |
| DATA-01 **High** | **Reproduced:** create an old-schema sale item: 2 × ₱50, total ₱100. Apply sales migration 0002: stored `subtotal_amount=0`; Sale total remains 100. | `sales/migrations/0002_saleitem_subtotal_amount.py:16` adds a zero default without backfill. Add a new reversible data migration based on historical quantity × historical unit_price; never rewrite applied migration or use today's product price. |
| API-01 **Medium** | **Reproduced:** DELETE ingredient used by a recipe → HTTP 500. Similar protected relations exist for products/categories. | `instance.delete()` does not catch ProtectedError. Return a clear conflict/validation response with linked-record explanation; preserve the FK protection. Product/category variants require separate regression tests. |
| DASH-01 **High** | **Reproduced:** add ₱50 sale in Jan 2025 and Jan 2026, filter both years: total ₱100 but chart sales sum ₱50. | `dashboard/views.py:106` keys grouped months only by month number, overwriting other years. Use year-month keys and date-range-appropriate labels. |
| DATE-01 **High** | **Reproduced from actual TS module:** Asia/Manila Nov 9 at noon, “this month” starts Oct 31 instead of Nov 1. At 07:00, “today” returns Nov 8. Browser Year request also starts Dec 31, 2025. | `frontend/src/lib/dateRanges.ts:3`, duplicated Dashboard helper, Expense default date use UTC `toISOString()` for local dates. Use explicit shop-local date semantics; backend also uses UTC `timezone.now().date()`. Test local midnight/month/year boundaries. |
| AUTH-01 **High** | **Reproduced:** with a valid auth cookie and enforced CSRF checks, an unsafe PATCH from untrusted Origin without CSRF token succeeds. Simple form-encoded cross-origin expense POST also succeeds 201. | `accounts/authentication.py:5` validates JWT cookie without enforcing CSRF; DRF APIViews are CSRF-exempt. Enforce origin/CSRF for cookie writes including login. Browser cookie policy may affect delivery, but server acceptance is confirmed. |
| AUTH-02 **High** | **Reproduced:** default-role Staff can create and delete expenses. Source confirms all business writes check only IsAuthenticated. | Role field has no authorization policy. Define owner/staff matrix, then enforce on backend and test each method. Staff permissions are an implementation gap; the exact desired matrix needs owner agreement. |
| CAT-01 **Medium** | **Reproduced:** anonymous GET `/api/products/?is_featured=true` returns an unavailable, nonfeatured item. | Public queryset exposes full product list and ignores parameter; UI filters only returned page. Separate public projection/filtering from authenticated management access. Whether unavailable products are confidential is a business decision. |
| PAGE-01 **High** | **Browser reproduced with 25 records:** storefront never displays product 25 (the only featured product); recipe selectors offer 20 records + placeholder; inventory search cannot find ingredient 25 from page 1. | `LandingPage.tsx:926`, Recipe/Sale forms fetch page 1 only. Lists filter/sort current page. Add server search/filter/order and paginated lookups/public catalog; don't disable pagination globally. |
| STOCK-UI-01 **Medium** | **Source-confirmed:** stock modal accepts a note but calls only `onSave(resultingQuantity)`; parent sends previous ingredient notes. New adjustment note is discarded. | `UpdateStockModal.tsx:49`, `IngredientsPage.tsx:237`. Decide movement/adjustment storage first; preserve note, actor, delta and reason rather than overwrite generic notes. |
| CACHE-01 **Medium** | **Source-confirmed:** sale mutations invalidate only `sales`; ingredient edits only `ingredients`; recipe edits only `recipes`; public product keys differ from management keys. | Loaded inventory, dashboard, margins, recipe costs, and storefront can remain stale after mutations. Define dependency-aware invalidation and verify with mounted cached queries. Exact user-visible duration depends on navigation/staleness. |
| A11Y-01 **High** | **Browser reproduced:** username/password controls have no associated label. **Source-confirmed:** ConfirmDialog's alertdialog is inside `aria-hidden=true`; child false cannot undo hidden ancestor. | Bind labels/errors and use tested accessible dialogs. See security/UX sections and screenshots. |
| UI-01 **Medium** | **Browser reproduced:** 390px sale form has a 42px product selector. Recipe ingredient selector truncates heavily. No full-document horizontal overflow was observed in these samples. | Fixed grid columns consume mobile width. Stack fields or change columns at small breakpoints; retain table/card alternatives. |
| BUILD-01 **Medium** | **Measured:** lint finds 13 errors / 16 warnings. Build succeeds with invalid CSS import placement warning; Google font import follows generated CSS rules. | Fix specific lint/type/effect issues; move valid font loading into appropriate location. Do not suppress rules wholesale. |
| CONFIG-01 **Medium** | **Runtime confirmed:** desired compressed manifest static backend resolves as plain StaticFilesStorage. | Migrate legacy setting to supported `STORAGES` in an approved later configuration change; validate collectstatic and actual hosting. |

### Negative-cost investigation conclusion

There is no evidence of a subtraction or unit-conversion formula creating negative costs from positive inputs. Current recipe cost is the sum of ingredient quantity × cost/unit, then divided by batch yield. All terms must use the ingredient's own measurement unit; no purchase-pack conversion feature exists. The current API validates positive cost and recipe quantities. The confirmed model/admin/ORM validation gap can create negative recipe costs. Production records/history were not inspected, so the original incident's specific cause remains **unresolved**. A negative profit margin can also be a legitimate selling-price-below-cost result, not a negative ingredient cost.

## Security assessment

Details and source guidance: [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Positive controls: Django password hashing/validators; ORM; HttpOnly JWT cookies; secure auth-cookie defaults when DEBUG is false; default authenticated API access; explicit credentialed CORS origin list; protected FK relationships; React escaping; no actual secrets found in inspected tracked configuration.

Important gaps beyond AUTH-01/02:

- **High, source-confirmed:** Django 5.1.4 is unsupported and behind security patches. Version/advisory snapshots: Python pinned direct dependencies have **112 advisory entries across 7 packages**; npm reports **37 vulnerable package entries: 1 critical, 17 high, 18 moderate, 1 low**. These are scanner findings, not 149 demonstrated exploits. Python scan excludes transitive dependencies; npm includes CLI/build chains. `proxy-addr` is the critical npm entry; trace its shadcn/tooling chain before assigning deployed exposure.
- **Medium:** seven-day refresh cookie is issued but no refresh endpoint/client flow exists. Logout removes browser cookies without revoking existing tokens. No login throttling is configured. Production gateway controls and third-party-cookie behavior are unverified.
- **Medium:** check --deploy reports missing HTTPS redirect/HSTS. Hosting proxy might enforce these; verify environment before changing. Media persistence/serving under DEBUG=false is not specified. Upload size/type policy and backup restoration need explicit verification.
- **Medium:** CSV exports write user text verbatim (formula-injection risk). PDF export uses floats for running totals, fixed widths, and standard fonts; long-text layout/peso glyph fidelity need generated-file testing.
- **Medium:** no domain audit trail/actor fields, structured business logging, backup/recovery procedure, CI security gate or documented environment example. Logging and production operational controls outside the repository remain unknown.

## UX, accessibility and workflow assessment

Preserve the existing brand, sidebar information structure, familiar CRUD routes, component patterns, explicit pending buttons, toast feedback, low-stock indicators, image fallbacks, and loading/empty/error states. This is an incremental repair, not a replacement design.

Baseline [desktop dashboard](audit/evidence/dashboard-desktop.png), [mobile dashboard](audit/evidence/dashboard-mobile.png), [public storefront](audit/evidence/storefront-desktop.png), [mobile sale form](audit/evidence/sale-form-mobile.png), [mobile recipe form](audit/evidence/recipe-form-mobile.png), [inventory search](audit/evidence/ingredients-page-search.png), [mobile login](audit/evidence/login-mobile.png). All images contain synthetic data. Desktop 1440×1000; mobile 390×844. Fonts/assets from external hosts were intentionally blocked, so screenshots are not proof of live-host font availability.

Additional source findings (WCAG review is preliminary, not conformance certification):

- `frontend/src/pages/ProductFormPage.tsx:100` — switch rows lack accessible names; label/helper/error association repeats across copied Field functions in six forms.
- `frontend/src/components/CartPanel.tsx:299` — closed cart remains a modal dialog in DOM, without inert/hidden state, focus trap, Escape handling or focus restoration. MobileDrawer similarly remains present when closed and lacks a focus trap. ConfirmDialog has a partial trap but hidden-ancestor defect and no return-focus mechanism.
- `frontend/src/index.css:197` — normal white text over primary gradient's #EC4899 endpoint is 3.53:1; #FF6FAE is 2.58:1. Small muted #A8A49B text on #FFFDFB is 2.45:1. These measured combinations miss 4.5:1 normal-text contrast; assess whole gradients and control boundaries during redesign.
- `frontend/src/index.css:464` — reduced-motion handling exists for named animations/skeletons, but not all smooth scrolling, hover movement, transitions and cart transforms. No skip link found. Keyboard/focus/screen-reader and 200% zoom coverage remain incomplete.
- `frontend/src/pages/IngredientsPage.tsx:183` — inventory value/out-of-stock are current-page figures alongside global totals without matching scope labels. Recipe averages/missing-recipe banner are also computed from partial lists. Sales/expense totals correctly say “on this page”; exports, however, use date-only filters and can differ from text/category-filtered visible results.
- `frontend/src/pages/*FormPage.tsx` — list-level errors exist, but edit-detail network/404 errors are not consistently distinguished from a blank form; mutation errors usually hide specific field-level API messages. Integer/date/money precision in Zod does not fully mirror DRF validators. Unsaved-edit protection is absent.

UI direction for later approval: retain cream/chocolate/pink, improve accessible contrast, mobile forms, reliable table scope, field feedback and keyboard behavior first. A substantial redesign requires a separate proposal/preview and explicit approval under Phase 3.

## SEO scope

Public SEO belongs to `/` and any later approved customer pages. `/login`, owner CRUD routes, dashboard/margins and backend administration are private/utility surfaces, not SEO landing pages. See [SEO_AUDIT.md](SEO_AUDIT.md).

Source-confirmed public gaps: only a generic title/viewport/favicon in HTML; no meta description, canonical, OG/Twitter tags, structured data, robots.txt or sitemap. Product content is client-fetched; no SSR/prerendering exists, but **no Google indexing failure has been demonstrated**. Unknown routes redirect to `/`, creating a potential soft-404 issue. Public images have alt text; below-fold product images lack native lazy loading. Messenger/email and marketing claims are explicitly replacement/configuration candidates, not verified business facts. Do not invent address/hours/reviews or add LocalBusiness markup until verified.

## Performance and quality baseline

| Measurement | Actual result / interpretation |
| --- | --- |
| Existing backend tests | 0 executable tests; seven app `tests.py` files contain placeholders |
| New audit probes | **22/22 assertions pass**, 0.812s test-body time: 4 working-behavior checks, 17 defect probes, 1 query-growth measurement. They are evidence, not a regression suite validating fixes. |
| Migration state | `makemigrations --check --dry-run`: no changes detected; migrations apply to fresh SQLite; sales historical backfill defect reproduced |
| Build | `tsc -b && vite build` succeeds; Vite production bundling 8.94s; 2,569 transformed modules |
| Assets | JS **1,026.68 kB**, gzip **299.15 kB**; CSS 35.54 kB, gzip 7.63 kB; one eager JS entry chunk; routes statically imported |
| Lint | **13 errors, 16 warnings**; `any`, state-in-effect, refresh exports and unstable memo dependencies; not all warnings imply runtime failure |
| Margin endpoint | 1 recipe-bearing product → **4 SQL queries**; add 5 products without recipes → **9 queries**. Query count grows per product; with recipes, ingredient prefetch adds queries. |
| Browser | 10 screenshots; no uncaught page errors; one expected anonymous `/auth/me/` 401 console message; synthetic login returns 200 |
| Local page navigation | One cold dev storefront navigation ~3,000ms. No mobile/network throttling; not a production performance or Core Web Vitals score. |
| Dependencies | 29 frontend direct packages outdated; 14 declared backend dependencies outdated in installed-version query. Do not blindly upgrade majors/downgrade based on npm audit suggestions. |

Other performance risks: unpaginated margins/low-stock endpoints, unbounded synchronous PDF/CSV generation, missing sale/expense date indexes, backend margin N+1, repeated costing property iteration and duplicated reporting queries. Sales/recipe list prefetching and product category select_related are already present. Preserve these optimizations. No DB latency, PostgreSQL query plan, concurrent throughput, Lighthouse, LCP/INP/CLS or production memory measurement was collected.

## Maintainability and documentation

The application is small enough to retain its current architecture. Avoid a broad feature-folder migration just to match stale documentation. Stabilize service boundaries and contracts first.

- Repeated CRUD/envelope/date parsing and CSV/PDF code; six near-identical Field components; duplicated date-period logic; many repeated inline styles/colors.
- TypeScript types claim some decimal API values are numbers although DRF serializes strings. `any` hides contract drift. Introduce explicit response/pagination/money types and normalize at service boundaries.
- Main-entry import graph identifies `App.tsx`, `App.css`, `components/ui/button.tsx`, `lib/utils.ts` as unreachable candidates; this is not automatic permission to delete. Geist, shadcn CLI runtime dependency, `tw-animate-css`, and backend allauth/filter/dotenv/requests usage should be reviewed. CLI dependencies enlarge scan/install surface even when not shipped to the browser.
- `docs/PROJECT_STATUS.md` incorrectly declares all business logic complete and landing/mobile work not started. `DATABASE_SCHEME.md`, root `vercel.json`, and `frontend/response.html` are empty. README/frontend setup lacks complete reproducible environment/test instructions.

## Unverified issues, risks and dependencies

1. **High:** concurrent stock lost updates/overselling are likely from read-modify-save without locks, but were not reproduced under PostgreSQL. SQLite probes cannot establish PostgreSQL locking/isolation correctness.
2. **High:** deployed database contents, existing negative values, whether sales migration 0002 was applied over real historical data, and historical inventory reconciliation are unknown. Obtain an authorized nonproduction copy or a scoped read-only data audit before remediation; never auto-correct historical quantities.
3. **Medium:** decide whether dashboard “net profit” means cash sales minus recorded expenses (current behavior) or accounting profit/COGS. Current margin is ingredient-only, excluding labor/overhead. No cost snapshots, discount, refund, cancellation or tax model exists. These require business decisions, not assumed bug fixes.
4. **Medium:** deployment headers, Render/Railway ownership/current service, storage persistence, CORS origins, DB SSL, TLS proxy header trust, third-party cookies, error logging, backups and restore are unverified. No production changes are authorized.
5. **Medium:** actual package exploit reachability, transitive Python vulnerabilities, CSV formula execution, PDF rendering, upload attack cases, 404/edit-form recovery, cache/race behavior, keyboard/screen-reader/zoom and tablet sizes need targeted follow-up.

## Recommended order and migration strategy

Detailed approval gates and acceptance criteria: [REVIVAL_ROADMAP.md](REVIVAL_ROADMAP.md).

1. Phase 1, inventory/sales module first: tests asserting desired behavior; validate before mutation; atomic transactions, row locking, insufficient-stock policy, precise consumption, operation idempotency. Propose additive movement/snapshot fields with explicit rollback and historical-data treatment before schema changes.
2. Phase 1, authentication: CSRF-protected cookie writes; agreed role matrix; consistent session expiry/logout; abuse controls. Dependency security updates should start early in an isolated change, verified against business tests; retain current framework architecture.
3. Phase 1, costing/data/API: model/DB constraints after profiling invalid data; historical subtotal backfill; date/chart fixes; protected-delete errors; server pagination/search; query invalidation; detail-form error handling; lint and regression checks. Preserve existing historical unit prices and sale totals.
4. Phase 2 only after approval: safe nonproduction deterministic demo command with ownership markers, dry-run/idempotency, consistency tests and verified demo-only reset. Suppliers/refunds only if supported or separately approved.
5. Phase 3: approved visual proposal, then accessibility/mobile/interaction improvements using existing brand and components.
6. Phase 4: truthful public metadata/crawlability and public-only performance; indexing evidence before SSR decision.
7. Phase 5: quality/security/accessibility evidence mapped to ISO frameworks, without certification/compliance claims.
8. Phase 6: optimize measured bottlenecks, add CI/E2E, verify production build/migrations, prepare backup/deployment/rollback instructions. Deployment and production migration need separate approval.

**Approval checkpoint:** review this audit and proposed Phase 1 order. No fixes, demo seeding, redesign, dependency upgrades or deployment will begin until the owner explicitly approves the next phase.
