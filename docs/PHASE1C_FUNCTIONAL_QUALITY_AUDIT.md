# Phase 1C.1 — Functional, quality and dependency audit

Date: 2026-11-10. Accepted baseline: `fdd46a3`. Isolated branch: `codex/phase-1c1-functional-quality-audit`.

**Review checkpoint: audit and repair plan only. No application fixes, new migrations, dependency upgrades, persistent demo data, redesign, SEO or deployment were performed.** Existing accepted migrations ran only in freshly owned disposable test databases. No existing business database or production environment was accessed.

## 1. Executive summary

The accepted sales/inventory/financial architecture and security assertions remain green in controlled local verification. The main remaining problems are incomplete pagination, frontend cache collisions, Manila date filters, missing model/database numeric safeguards, unsafe spreadsheet exports, and misleading or stale operational presentation. These should be repaired in small packages before realistic demonstration data is generated.

No new P0 application exploit or ledger-corruption regression was established. This is not an exhaustive security clearance. Django 5.1 is unsupported, and current advisory scans flag both application dependencies and development tooling. Passing security tests do not make these versions safe or authorize production deployment.

Actual results:

| Check | Result |
| --- | --- |
| PostgreSQL preservation | **250 run: 249 pass, 1 SQLite-only skip, 0 failures/errors** |
| SQLite preservation | **250 run: 215 pass, 35 PostgreSQL-specific skips, 0 failures/errors** |
| New desired-behavior audit probes, each database | **27 run: 13 passing controls, 14 failing requirements, 0 errors/skips** |
| Existing frontend unit checks | **52 pass** across CSRF transport, operation identities, stock preview, permissions and authentication lifecycle |
| Actual date helper under Asia/Manila | **3/3 desired date cases fail** |
| Final headless Edge audit, actual React/API/PostgreSQL | **19 explicit checks: 5 pass, 14 fail**; findings overlap rather than representing 14 additional independent bugs; no recorded page script errors |
| Frontend production build | Pass; CSS import-order and large-chunk warnings remain |
| Full-project frontend lint | **8 errors, 16 warnings** |
| Installed Python advisory scan | 112 returned vulnerability records in 7 packages; **79 distinct CVE identities across those package results** after deduplicating aliases |
| npm lockfile advisory scan | **37 affected package entries:** 1 critical, 17 high, 18 moderate, 1 low; these are not counts of demonstrated application exploits |

The preservation run includes all **120 Phase 1A business tests**, all **10 integrated release-blocker contracts**, all **13 original role requirements**, all **26 CSRF regressions**, the **21 RBAC regressions**, and session/concurrency/operational checks. PostgreSQL business tests pass 120/120; SQLite passes 103 with 17 PostgreSQL-specific skips. No existing test source, fixture contract or assertion was weakened or edited by this audit.

## 2. Current functionality and remaining defects

Severity uses the owner's scale: P0 critical integrity/exploitable security; P1 incorrect business behavior/major operational failure; P2 usability, reliability or maintainability; P3 cosmetic/minor. “Confirmed” below means observed in a small synthetic test or a deterministic source calculation explicitly identified as such. Package advisory matches are classified separately in section 6.

| ID / severity | Confirmed behavior, impact and location | Recommended boundary |
| --- | --- | --- |
| **F01 / P1 — numeric safeguards** | Ingredient cost `-1` passes `full_clean()` and an actual DB update on both engines. DB writes also accept negative product price, expense amount and recipe ingredient usage. API serializers reject these values; this is an ORM/admin/maintenance integrity gap, **not evidence of existing corrupt production data**. `backend/ingredients/models.py:29`, `products/models.py`, `expenses/models.py`, `recipes/models.py`. Five failing model/DB assertions. | Add consistent validators and constraints in a separately approved package; inspect existing values read-only before any proposed constraint migration. Never silently repair historical amounts. |
| **F02 / P1 — records hidden by pagination** | With 25 products/categories/ingredients, the API correctly returns 20 then 5 products. Storefront cannot show product 25, the only featured product. Recipe and sale product selectors, recipe ingredient selector and product category selector each expose 20 choices plus placeholder. Inventory search for ingredient 25 on page 1 says no matches. Management filtering/sorting also operates on fetched pages. `product.service.ts`, `LandingPage.tsx:926`, form/list pages. | Add authorized server search/filter/order and paginated lookup/catalog consumption. Preserve page-size limits and public-safe projections. Never solve by disabling pagination globally. |
| **F03 / P1 — business-date drift** | Real TS helper returns Oct 31 for November's start; at Manila 07:00 on Nov 10 “today” is Nov 9 and the week's start is Nov 8. Actual browser Year request starts `2025-12-31`. `dateRanges.ts:3`, `DashboardPage.tsx:65`; expense default repeats the UTC pattern at `ExpenseFormPage.tsx:193`. Staff sale date enforcement already uses Manila and must remain unchanged. | One explicit Asia/Manila date-only policy and shared helpers; test boundaries on browsers in other timezones too. |
| **F04 / P1 — list/detail cache collisions** | `useIngredients(page)` and `useIngredient(id)` both use `['ingredients', number]`; recipes repeat this pattern. Visiting ingredient list page 1 then editing ingredient 1 shows blank name/quantity without fetching the correct detail. Recipe list → edit recipe 1 selects product `0`, although the stored product is `1`. The form still renders, so “did not crash” is insufficient. `useIngredients.ts:11,18`, `useRecipes.ts:9,16`. | Separate list/detail namespaces and test navigation in both directions, page/ID collisions, reload and cached revisits. |
| **F05 / P2 — stale derived costs** | Real owner form changes ingredient 2 cost from ₱1 to ₱10 (HTTP 200). Returning to the already cached recipe list still shows batch ₱0.01/unit ₱0.00; fresh API returns batch ₱0.10/unit ₱0.03. Ingredient mutation invalidates ingredients only; recipe and margin/dashboard dependencies remain fresh for the default 60 seconds. Recipe/product/expense hooks have related missing invalidations by source inspection. | Explicit dependency invalidation map; test mounted/cached queries. Do not invalidate or replay business mutations to refresh views. |
| **F06 / P2 — date validation inconsistency** | Sales/expenses list and expense CSV silently ignore malformed dates (`bad` → 200); reversed sales dates return 200/empty results. Dashboard and financial summary correctly return 400. Exporting with an invalid filter can unexpectedly export a wider range. Other CSV/PDF branches share the same permissive parser. | Shared strict date validation, reversed-range rejection, consistent error envelope and form feedback. |
| **F07 / P1 — CSV formula injection** | Synthetic expense description and sale notes `=1+1` survive CSV parsing as formula-leading cells. Ordinary CSV quoting does not make spreadsheet text safe. Frontend ingredient CSV also quotes without neutralizing formula-like text (source-confirmed equivalent path). A privileged user or staff sale note can reach a downloaded owner report. No spreadsheet formula was executed. | Define spreadsheet-safe text export for all text columns; preserve numeric signed financial columns as numeric. Test separators, quotes, tabs/newlines, formula prefixes and Unicode variants. See [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection). |
| **F08 / P2 — protected category deletion** | Owner DELETE category referenced by a product returns **503 `auth_unavailable`**, rather than a business conflict. `CategoryDetailView.destroy` does not catch `ProtectedError`; session middleware maps database errors to a fail-closed 503. FK/data preservation works. Ingredient/product protected-delete handling is already improved. `backend/products/views.py:98`. | Handle the known protected relationship in the business view; preserve atomicity and session fail-closed behavior. Do not broadly suppress DB errors. |
| **F09 / P2 — inconsistent monthly horizons** | With today's business date controlled to Nov 10 and a future Nov 25 expense of ₱25, dashboard `this_month.expenses=25` although monthly sales stop at Nov 10 and date-filtered totals exclude that expense. Reproduced in both databases. The current API field is inconsistent even if a frontend does not display it. `dashboard/views.py`. | Choose and label month-to-date versus full-month consistently for both sides of the calculation. |
| **F10 / P2 — quantity presentation** | Stored/API `19.996666668 kg` appears as **19.997 kg** in the owner table, while staff operational stock displays all nine places. `IngredientRow.tsx:69` uses default locale rounding; cards/CSV/modal should follow one documented display policy. Storage/ledger arithmetic is not shown to be wrong. | Preserve decimal strings; distinguish an approximate friendly value from an accessible exact value and use exact quantity for every command. Avoid converting stock to JS Number for integrity decisions. |
| **F11 / P2 — misleading scope of summaries/exports** | Browser inventory header says “Total Ingredients 25” alongside “Inventory Value ₱399.93”, calculated from only the 20 loaded rows. All 25 synthetic rows at ₱1/unit total ₱499.92 when rounded for display. Current source explicitly scopes out-of-stock/value to the page, but visible labels do not. Ingredient export receives only visible rows; sales/expense exports receive date filters but not local search/category filters. Recipe summaries/missing-recipe detection also use partial lists. | Make dataset scope explicit, implement server aggregates where global totals are intended, and align export filter contracts. Do not change signed ledger reporting formulas. |
| **F12 / P2 — edit errors and field feedback** | `/ingredients/99999/edit` returns a legitimate 404 while the UI presents an empty edit form without an explicit alert. Several forms only handle detail loading, not detail errors. Mutation hooks generally replace DRF field-specific failures with generic toasts. Fractional counts/yields can pass frontend number schemas while DRF requires integers (source-confirmed validation mismatch). | Separate not-found/network/permission/validation states; map safe field errors; keep the server authoritative and never auto-repeat unsafe requests. |
| **F13 / P2 — functional accessibility** | Actual login username/password inputs have no associated label; repeated form `Field` components use sibling labels without `htmlFor`/IDs. `LoginPage.tsx:31` and other form pages. This impairs assistive technologies and clickable labels. The old hidden-confirmation-dialog defect is fixed and must not be carried forward. | Bind labels/errors and verify keyboard/focus/announcements; focused functional fixes can precede the visual redesign. |
| **F14 / P2 — mobile sale entry** | At 390×844 the actual sale product selector is **42px wide**, making product names unreadable; fixed grid columns consume the width. No document-level horizontal overflow in this tested sample. `SaleFormPage.tsx:266`. Recipe selector truncation still needs a fresh mobile measurement; do not claim it reverified. | Small breakpoint fix preserving owner/staff rules and price/date restrictions; broader styling belongs to redesign. |
| **F15 / P2 — lint/build debt** | Full lint fails with 8 errors/16 warnings; build passes with invalid CSS `@import` ordering and a 1,038.84 kB minified JS chunk (303.60 kB gzip). Lint failures block a clean quality gate; bundle size is a performance risk, not proof of a measured operational failure. | Fix specific rules/types/effects and font loading; profile/split bundle later. No blanket disabling or unrelated dependency changes. |
| **F16 / P2 — removed static setting** | A no-DB/no-dotenv runtime probe resolves `StaticFilesStorage`, despite the requested WhiteNoise manifest backend. `backend/backend/settings.py:162` uses removed `STATICFILES_STORAGE`; not the test profile's intentional storage override. | Use supported `STORAGES` in a reviewed configuration package and validate collectstatic/manifest/static serving on the eventual deployment topology. Production gate. |
| **F17 / P2 — notes cannot be cleared** | Owner clears ingredient notes in the real form; PUT succeeds, but subsequent API still returns `SYNTHETIC-TO-CLEAR`. `ingredient.service.ts:15` appends notes only when truthy. | Send an intentional empty value, distinguish omitted versus cleared fields, and add a real form/API regression. |

Current working paths were also exercised: expense create/edit/delete and basic CSV/PDF generation, recipe edit/delete, protected ingredient deletion, anonymous unavailable-product filtering, owner sales creation/cancellation, exact inventory reversal, signed financial reconciliation, staff denial with zero business writes, staff operational stock/cost redaction, and backend date validation for dashboard. These controls do not claim every CRUD combination or export layout has been exhausted.

### Reporting semantics and issues requiring further testing/decisions

| Classification | Evidence and required decision/test |
| --- | --- |
| **Potential misleading financial label / P1 decision before financial demo** | Dashboard “Net profit” is **net sales minus recorded expenses**. It has no historical COGS, accrual, tax or refund accounting. Ingredient purchase expense does not itself restock inventory. The formula is deterministic; whether it is the intended profit measure requires owner confirmation. Recommend an explicit “Net sales less recorded expenses; excludes COGS” label/description until accounting scope is approved. Never reconstruct historical COGS using today's recipe/cost. |
| **Existing correct financial labels** | Sales shows Gross, Adjustments, Cancellations and Net separately; explicitly says refunds are not tracked. CSV names original/current values; PDF clearly says sales history/original values, not posting-date net sales. Cancellation-date negative postings remain authoritative. Do not subtract cancellations twice or interpret them as cash refunds. |
| **Potential export presentation inconsistency** | Sales CSV exports current items while PDF lists original immutable items/amounts, with an original-values explanation. This is not established as an accounting error. Decide a common export contract and test edited/cancelled/legacy records before changing either. No dedicated financial-posting export was found; absence is a feature gap, not a broken existing endpoint. |
| **Potential PDF layout/locale issues** | Small PDFs return valid PDF headers. Long notes/descriptions and large datasets, peso glyph support, line wrapping, repeated headers and page breaks still need visual/PDF text tests. Expense PDF uses float accumulation and both PDFs use server `datetime.now()` for generated-date text; these remain source risks, not a demonstrated cent discrepancy or current-host date failure. |
| **Potential pricing-estimate precision inconsistency** | Recipe costs round the batch then divide/round; Python Decimal default half-even differs from explicitly specified ledger money/quantity policies. Tiny costs may display ₱0.00. Agree estimate precision/rounding and labels; do not change accepted money or allocation math as a side effect. |
| **Potential pagination stability/performance** | Recipe model/queryset has no deterministic ordering. Product-margin endpoint does one recipe fetch per product; dashboard iterates original-date sales and current projections. Add ordered-page and query-count/load checks before large demo sets. No production-scale timeout was simulated. |
| **Potential stock-alert semantics** | Zero stock with minimum 0 is `is_low_stock=True` by model property, while low-stock endpoint/dashboard requires minimum >0; UI separately identifies out-of-stock. Decide whether 0 means “threshold unset” and whether out-of-stock must always alert. |
| **Nonessential visual improvements / P3** | Theme, spacing, typography, illustration, decorative motion, new layouts and major component restyling are deferred. Source guideline observations about contrast/reduced motion require measured accessibility work; the old Phase 0 contrast evidence is not a fresh full WCAG audit. |

## 3. Original Phase 0 issue disposition

Original evidence remains unchanged. All **28** files in the Phase 1A-recorded Phase 0 SHA-256 manifest match. This table supersedes old status assumptions, not the historical evidence.

| Original finding | Current disposition |
| --- | --- |
| INV-01 invalid edits inflate stock | **Previously fixed; still passing** accepted invalid-edit/rollback tests. |
| INV-02 insufficient stock/clamped restoration | **Previously fixed; still passing** rejection and conservation assertions. |
| INV-03 recipe-dependent historical reversal | **Previously fixed; still passing** immutable snapshots/exact reversal and changed/removed recipe tests. |
| INV-04 non-atomic writes | **Previously fixed; still passing** exception injection and full rollback assertions. |
| INV-05 duplicate sales/deductions | **Previously fixed; still passing** durable operation uniqueness/replay/payload conflict/concurrency tests. |
| INV-06 fractional usage loss | **Previously fixed; still passing** nine-decimal allocation/conservation/concurrency tests. Display mismatch is separate F10. |
| COST-01 negative ingredient costs | **Still confirmed**, now verified on PostgreSQL and SQLite; F01 includes related numeric DB gaps. |
| SALE-01 unavailable or recipe-less sales | **Previously fixed** approved sale service validation; retained business regressions pass. No new permission to sell recipe-less products is proposed. |
| DATA-01 zero default legacy subtotal migration | **Historical stored condition retained, runtime projection corrected.** New probe synthesizes an old zero subtotal: GET derives ₱100 from historical 2×₱50 while stored zero remains zero; no stock movement/posting fabricated. Original migration 0002 is unchanged. Prior suggestion to automatically backfill is superseded by approved legacy-preservation policy. Any real-record reconciliation remains an explicit owner-reviewed process. |
| API-01 protected ingredient deletion | **Ingredient/product path fixed; category variant still fails** as misleading 503, F08. |
| DASH-01 same month across years | **Fixed and reverified** both expense and real sale postings preserve Jan 2025/Jan 2026 separately; F09 is a different monthly-horizon issue. |
| DATE-01 UTC/Manila differences | **Partly fixed** backend business dates and staff sale rules; frontend filters/default expense still fail, F03. |
| AUTH-01 cookie JWT without CSRF | **Accepted fix preserved:** 26 CSRF regressions pass, including Cookie/Origin/Referer failures and zero writes. |
| AUTH-02 roles unenforced | **Accepted fix preserved:** original 13 role requirements and expanded RBAC tests pass; technical superuser flags do not grant business admin rights. |
| CAT-01 public availability/featured behavior | **Partly fixed:** anonymous unavailable/inactive-category exposure is filtered; `is_featured=true` still ignored and returns a nonfeatured product, one explicit failing API probe. Include in F02's catalog contract package. |
| PAGE-01 hidden records | **Still confirmed**, F02/F11. Backend's correct 20+5 result rules out missing DB records. |
| STOCK-UI-01 discarded adjustment note | **Fixed in accepted implementation:** stock mutation forwards delta/reason/revision/identity; ledger/browser evidence retained. Ingredient metadata notes clearing is separate F17. |
| CACHE-01 incomplete invalidation | **Partly fixed:** sales/stock invalidate inventory/dashboard; cost/recipe/product/expense dependencies remain, F05. Newly confirmed key collision is F04. |
| A11Y-01 labels/hidden dialog | **Partly fixed:** actual alertdialog is exposed (passing browser control); login/form labels remain broken, F13. |
| UI-01 mobile selectors | **Sale selector still confirmed** 42px; recipe mobile variant requires renewed measurement. F14. |
| BUILD-01 lint/CSS warning | **Improved but open:** old 13 errors are now 8; 16 warnings and CSS import warning remain. Fresh counts, F15. |
| CONFIG-01 legacy static backend | **Still confirmed** with zero DB connections, F16. |

## 4. Reproduction evidence and limitations

Canonical evidence under `docs/phase1c1/evidence/`:

| Directory | Contents |
| --- | --- |
| `20261110-162643-postgres-audit-dee2f6f4` | Final 27 desired-behavior probes, real authenticated cookies/CSRF, PostgreSQL 17.11; 14 failures are release requirements still open. |
| `20261110-162639-sqlite-audit-ec6c6cea` | Same final probes, isolated SQLite 3.53.1; identical 14 failures. |
| `20261110-161539-postgres-preservation-6bdbbd02` | Unmodified accepted assertions: 250 tests, detailed per-test outcomes. |
| `20261110-161821-sqlite-preservation-ab40b178` | Same preservation scope, explicit PostgreSQL skips. |
| `20261110-162338-postgres-browser-1fc6c9e1` | Final real Edge owner/staff workflows, 19 observations, API GET paths without tokens, seven screenshots, owned-server cleanup. |
| `20261110-161049-static-e411e59f` | Build/full-lint/raw installed and declared inventory, date cases, existing frontend unit outputs. Initial advisory attempts did not succeed; use the successful dependency directory below. |
| `20261110-161248-dependencies-034a96af` | Successful current npm/PyPI advisory JSON and stderr. |
| `20261110-162040-configuration-9929c747` | No-dotenv/no-DB static storage/timezone/pagination probe. |

Compact machine-readable totals and preservation hashes: [verification-summary.json](phase1c1/verification-summary.json). Detailed failing assertion tracebacks live in each `audit.json`/`audit.txt`; they assert the desired behavior rather than bless existing defects. The audit suite's nonzero exit is intentional evidence of uncorrected requirements, not a failed migration or accepted security regression. The browser script records false checks without treating successful completion as all requirements passing.

Representative smallest reproductions:

1. Create one synthetic ingredient. Assign cost -1, call `full_clean()`: no exception. Update the actual DB row to -1: no constraint violation. API PATCH -1 still returns 400 and leaves original cost intact.
2. Add expenses ₱11 in Jan 2025 and ₱22 in Jan 2026: chart returns distinct year-month values. Separately create two actual ₱50 sales in those months: both chart entries are ₱50. These are passing controls for the old bug.
3. Sell one unit of a batch consuming 0.01 kg/yield 3: 20 → **19.996666667**. Cancel once through API: **20.000000000**, two exact opposite movements, signed financial entries sum to zero. Broader duplicate/exceptions/concurrency cases remain in the accepted suite.
4. Create a future-month expense and control only the dashboard's date clock: `this_month` includes it while date-filtered totals do not. No session validator/database clock was mocked.
5. Export harmless text `=1+1`, parse with CSV reader, observe formula-leading text. No external spreadsheet or exploit payload is run.
6. Browser list 1 → edit ID 1 without full reload exposes actual cache collision; direct fresh navigation is a different scenario and must not be used to hide this failure.

Harness details: reused accepted resource ownership, generated credentials, local Docker context, loopback bindings, PostgreSQL tmpfs/no bind mounts, `.env` discovery suppression and migration-hash guards; added a separate Phase 1C authorization marker and new evidence destination. SQLite lives only under an owned random workspace runtime directory. Real V2 cookies/CSRF/session authorization are used; no `force_authenticate` or authentication/permission mock is used. Browser external requests are blocked, Vite uses an empty env directory, and only owned child servers are stopped. Synthetic 25-row boundary fixtures are destroyed with their databases; they are not Phase 2 demo data.

Earlier attempts remain for auditability: initial SQLite run had one audit-fixture type mismatch (`Decimal('1.00')` compared to fixture string `'1'`), corrected in audit code only; final runs have 14 genuine requirement failures. The first browser run stopped because the script measured an item row before clicking Add Item; incomplete observations are superseded by the final run, with explicit render waits and correct controls. Initial npm lookup failed under restricted DNS; successful approved public-registry retry is recorded separately. Initial pip invocation rejected an incompatible CLI flag; successful retry audited the installed environment without installation.

Limitations: browser evidence covers selected owner/staff workflows and one mobile viewport, not an exhaustive screen-reader/device matrix. PDF checks validate small-file generation, not visual layout. Performance, arbitrary upload-format exploitability and every advisory precondition were not stress-tested. No claim is made about production data contents or live infrastructure.

## 5. Code-quality findings

Full-project ESLint errors, exact current source locations:

| File:line | Rule / focused repair |
| --- | --- |
| `frontend/src/components/ingredients/StockStatusBadge.tsx:16` | `react-refresh/only-export-components`; extract shared noncomponent exports. |
| `frontend/src/components/recipes/RecipeCostPreview.tsx:26` | `@typescript-eslint/no-explicit-any`; type watched form rows. |
| `frontend/src/components/ui/button.tsx:67` | `react-refresh/only-export-components`; preserve the existing variant API during extraction. |
| `frontend/src/pages/DashboardPage.tsx:321` | `@typescript-eslint/no-explicit-any`; typed chart tooltip. |
| `frontend/src/pages/DashboardPage.tsx:482` | Same rule; type chart callback. |
| `frontend/src/pages/IngredientFormPage.tsx:123` | `react-hooks/set-state-in-effect`; review form/image synchronization rather than suppress the rule. |
| `frontend/src/pages/RecipeFormPage.tsx:151` | `@typescript-eslint/no-explicit-any`; proper form/recipe types. |
| `frontend/src/pages/RecipeFormPage.tsx:274` | Same rule; typed ingredient preview/watch data. |

Sixteen warnings are dependency/memo warnings on list pages and incompatible-library notices for form `watch` use. Review them individually; warnings do not all demonstrate runtime bugs. Raw `full-lint.json` contains every path, line and message. A focused lint pass from prior packages did not imply full-project cleanliness.

Other maintainability concerns: duplicate field/date/CRUD/export implementations; API decimals typed as numbers in recipe/expense/product contracts despite DRF decimal strings; repeated envelope extraction without runtime checks; inconsistent safe API error presentation; missing dependency-aware cache keys/invalidation; legacy comments claiming ingredient fields are ignored although they now exist. Backend has no configured full-project lint gate in this audited setup; syntax parsing is useful but is not a substitute for one. Python AST validation is recorded in the summary. Future typing/refactoring should be incremental with behavior-preserving tests, not a wholesale architecture rewrite.

`tsconfig.app.json` does not enable TypeScript strict mode and sets `ignoreDeprecations: "6.0"`; `skipLibCheck` also limits what a passing build verifies. Review these deliberate compiler boundaries in a focused typing package rather than enabling strictness across the project in this audit. Frontend package scripts expose build/lint but no general test command; the accepted 52 regression checks currently run as explicit Node scripts under docs. Make those checks discoverable in a future CI/quality package while preserving their assertions.

Functional UI findings follow the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), particularly associated labels, inline errors, focus and responsive content. This package did not implement or certify a complete accessibility redesign.

## 6. Dependency and security inventory

Observed versions are from the existing virtualenv/node_modules plus declared requirements/package.json and package-lock.json. Nothing was installed/upgraded. Raw inventory includes **all installed Python distributions and all frontend direct packages**. Backend declared pins match the corresponding installed packages; frontend installed versions satisfy the declared ranges, with npm reporting no direct-tree installation errors. Backend transitive dependencies are not fully locked in requirements; reproducible resolved constraints/hashes and a formal Node/Python engine policy remain future work.

### Runtime and backend

Python is **3.12.14**, a security-supported series through October 2028 according to the [Python lifecycle table](https://devguide.python.org/versions/). Node is **24.21.0**, a supported LTS line per the [Node release schedule](https://nodejs.org/en/about/previous-releases). Disposable verification uses PostgreSQL **17.11**, not a discovered production DB version. SQLite **3.53.1** is a sequential-test engine, not PostgreSQL concurrency evidence.

| Dependency | Declared = installed | Current assessment |
| --- | --- | --- |
| Django | 5.1.4 | **P1 unsupported/security risk.** 5.1 ended security support Dec 3, 2025. Current [official support table](https://www.djangoproject.com/download/) offers 5.2 LTS through April 2028. 20 distinct CVEs in this scan. Example [official Dec 2025 fixes](https://www.djangoproject.com/weblog/2025/dec/02/security-releases/) include PostgreSQL alias injection under specific ORM usage; no user-controlled alias exploit was demonstrated here. |
| DRF | 3.15.2 | **P1 known advisory risk**, five distinct CVEs. Maintainer advisories include [JSON/form request size guard bypass](https://github.com/encode/django-rest-framework/security/advisories/GHSA-2m8g-3cmr-wg3w) and [Accept-header content negotiation DoS](https://github.com/encode/django-rest-framework/security/advisories/GHSA-33wh-fxxf-88vv). Custom login's small-body guard does not secure every parser/endpoint. Latest reviewed [release notes](https://www.django-rest-framework.org/community/release-notes/) identify 3.18.3 and confirm 3.18 dropped Django 5.1 and changed list error formats. Upgrade the compatible cohort, not DRF alone. |
| SimpleJWT | 5.3.1 | Advisory match CVE-2024-22513; [maintainer 5.5.1 release](https://github.com/jazzband/djangorestframework-simplejwt/releases/tag/v5.5.1) is a minimum review point, not an automatic target. Current custom session codec, current-user/role checks and deactivation regressions prevent equating the package advisory with a reproduced app revocation bypass. Still upgrade/test the library boundary. |
| django-allauth | 65.13.1 | One scan CVE; maintainer [security notes](https://docs.allauth.org/en/latest/release-notes/recent.html) also describe SAML RelayState and default proxy trust changes in 65.14.x. Current public authentication is the custom API, not an enabled SAML route. Verify actual enabled features before assigning reachability; do not claim this dependency fixed because custom throttling passes. |
| Pillow | 10.4.0 | **P1 image-decoding risk**; 50 distinct CVEs reported. Actual image fields use Pillow validation, giving this more relevance than an unused tool. [Upstream 12.1.1 notes](https://pillow.readthedocs.io/en/stable/releasenotes/12.1.1.html) confirm CVE-2026-25990 affects >=10.3.0 when processing crafted PSD data. Newer scan fixes span later releases, including 13.0.0; 12.1.1 alone is not a complete remediation. No malicious image was decoded during this audit. |
| requests | 2.32.5 | One CVE match; review [2.33.0 release](https://github.com/psf/requests/releases/tag/v2.33.0), actual outbound callers and redirect/proxy policy. No demonstrated app SSRF here. |
| python-dotenv | 1.2.1 | One CVE match; review [1.2.2 release](https://github.com/theskumar/python-dotenv/releases/tag/v1.2.2) and where the package is actually used. Audit runners explicitly suppress dotenv discovery. |
| django-cors-headers / django-filter | 4.6.0 / 24.3 | No returned advisory in this scan; review support matrices with the Django/DRF cohort. This is not a support/security certification. |
| dj-database-url / psycopg2-binary | 2.3.0 / 2.9.10 | No returned advisory; preserve PostgreSQL transaction isolation, Decimal decoding, deterministic locks, connection/time bounds and test teardown. |
| gunicorn / whitenoise | 22.0.0 / 6.11.0 | No returned advisory; production runtime, proxy parsing and supported static configuration require separate deployment tests. Gunicorn is declared, not exercised as the Windows local server. |
| python-decouple / reportlab | 3.8 / 4.5.1 | No returned advisory; retain no-dotenv test isolation and test report output/Unicode/large documents. |

The 112 Python records contain repeated PYSEC/CVE aliases. Counts are deduplicated by CVE identity per package in `verification-summary.json`; they are **79**, not 112 unique vulnerabilities. No available scan proves all advisories covered, all vulnerabilities reachable, or vulnerability absence for a clean package.

### Frontend and tooling

| Component | Declared → installed | Assessment |
| --- | --- | --- |
| React / React DOM | ^19.2.6 → 19.2.7 | No npm advisory returned for these packages. This is a Vite client app, not a React Server Components server; do not apply RSC-only claims without those packages/routes. |
| Vite | ^8.0.12 → 8.0.16 | High aggregate advisory entry, including development-editor/file-serving risks and [maintainer cross-origin middleware advisory](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw). Keep dev server loopback-only; static dist does not run Vite server middleware. Review patched 8.x, not an automatic major jump. |
| TypeScript / plugin-react | ~6.0.2 → 6.0.3 / ^6.0.1 → 6.0.2 | Build passes. Vite 8 already uses Rolldown/Oxc; review [migration/deprecation notes](https://vite.dev/guide/migration) for build option changes. No migration to older Rollup advice by habit. |
| Axios | ^1.17.0 → 1.17.0 | High aggregate entry, multiple distinct prerequisites/adapters. [Maintainer fetch-adapter gadget advisory](https://github.com/axios/axios/security/advisories/GHSA-vh66-26gq-q6x8) requires inherited/polluted options; Node adapter advisories are not automatically browser exploits. Axios is imported by the cookie client. Retest Origin/CSRF bootstrap, same-origin restrictions, FormData, blobs and unsafe retry behavior after any upgrade. |
| react-router-dom | ^7.17.0 → 7.17.0 | Moderate aggregate, including [untrusted-path redirect advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6). Current route destinations are mostly fixed paths; SSR/RSC-specific findings do not describe this deployment. Audit data-driven URLs/redirects before dismissing the client advisory. |
| Zod | ^4.4.3 → 4.4.3 | High entry GHSA-mrhx-c7xc-m3w5, constrained-collection exhaustion, scan patched range >=4.6.6. Used for frontend forms; browser validation is not the API security boundary. Review [upstream fix #6652](https://github.com/colinhacks/zod/pull/6652) and resolver compatibility. |
| shadcn | ^4.11.0 → 4.11.0 | Tooling chain pulls MCP SDK → Express/express-rate-limit → **proxy-addr 2.0.7**, the critical entry GHSA-jqcg-44mw-7w3h. It is listed under package.json production dependencies, but no app source imports its CLI/MCP/Express runtime. **No app-level critical IP-spoof exploit was demonstrated.** Audit actual tool invocation and remove/move unused tooling in a separate package rather than blindly downgrading. |
| PostCSS | ^8.5.15 → 8.5.15 | High source-map loading advisories, relevant to build/untrusted CSS input; no uploaded-CSS processing path established. |
| ESLint / @eslint/js / typescript-eslint | ^10.3.0 → 10.4.1 / ^10.0.1 → 10.0.1 / ^8.59.2 → 8.61.0 | Moderate aggregate transitive findings. npm proposes some major **downgrades** for remediation; these are not approved repair instructions. Review patched compatible tooling deliberately. |
| Other direct UI/runtime packages | TanStack Query 5.101.0, RHF 7.78.0, resolvers 5.4.0, Recharts 3.8.1, Radix 1.5.0, Tailwind 4.3.0, etc. | Full exact list/ranges in raw inventory and `npm-installed.json`. No direct advisory returned for these names in this scan; retain API/form/CSS compatibility tests. |

Nine direct manifest entries appear in npm's affected dependency tree (some through transitive dependencies): Axios, Router, Zod, shadcn, Vite, PostCSS, ESLint, @eslint/js and typescript-eslint. A package entry is not a unique CVE or proof of exploitability. `--omit=dev` alone would not exclude shadcn because of its current manifest placement. Never run `npm audit fix --force` based on this report.

### Upgrade sequence and required evidence

1. Approve a dependency-only package with explicit target versions, lock/constraint diff, compatibility matrix and rollback baseline. Keep dependency work separate from functional repairs.
2. Upgrade Django to a current patched **5.2 LTS** cohort together with compatible patched DRF/SimpleJWT/filter/CORS/auth packages. Django 5.1 patching alone cannot restore ongoing support. Retest custom authentication inheritance, user/session claims, exception/serializer envelopes and admin protections. Do not replace the approved revocation architecture with library defaults.
3. Review image/network/env packages and their full transitive graph, updating within compatible supported versions or explicitly reviewing necessary major changes (notably Pillow). Test image uploads, reports, application startup, no-dotenv isolation and outbound network behavior.
4. Separate unused CLI/tooling from shipped frontend runtime; update Axios/Router/Zod with their form/transport tests, then Vite/PostCSS/lint tooling. Review generated lockfiles and build output for accidental server/CLI inclusion, Node-engine changes and schema-error differences.
5. Run all accepted backend suites on disposable PostgreSQL and SQLite, independent concurrency tests, original CSRF/RBAC requirements, frontend units/full lint/build, real owner/staff/browser renewal flows, uploads/CSV/PDF, and a fresh advisory scan. Require explicit documented disposition for remaining findings. No scanner-only “clean” claim without applicability/testing review.

## 7. Recommended repair packages and priorities

Each package ends in a report and owner review. Numbers are proposed, not implementation authorization.

| Package | Scope / exit test | Timing |
| --- | --- | --- |
| **1C.2A — cache identity correctness (P1)** | F04 only: distinct list/detail keys for ingredients/recipes; navigation/page/ID collision tests including 1 and 2. No DB change. | **Recommended next checkpoint; before demo data.** |
| **1C.2B — complete catalog/lookups (P1)** | F02 and CAT-01: safe public/operational query contracts, featured filtering, paginated selectors; >20 category/product/ingredient tests, global search/sort and stable ordering. Recheck RBAC fields/querysets. | Before demo data; review separately from cache changes. |
| **1C.3A — Manila dates and strict filters (P1/P2)** | F03/F06: common date-only helpers/validators; before/after midnight, month/year/week/leap boundaries, alternate browser timezones; list/dashboard/export consistency. | Before demo data and financial demonstrations. |
| **1C.3B — analytics scope/labels (P2 + owner decisions)** | F09/F11 and financial-label decision; consistent horizons, page/global aggregate labels, explicit net-sales/expense and current-estimate semantics. No historical COGS fabrication. | Before financial demo; approve semantics first. |
| **1C.4 — numeric domain constraints (P1)** | F01: validators/checks, negative/zero/precision tests through serializer/model/DB, read-only existing-value assessment and additive migration design. | Before demo data. **Separate schema approval required; no migration created here.** |
| **1C.5A — spreadsheet-safe exports (P1)** | F07 only: shared text-cell policy and formula/separator/Unicode tests. Preserve signed financial numbers and RBAC. | Before downloadable reports are shared. |
| **1C.5B — CRUD, metadata and feedback (P2)** | F08/F12/F17: protected category conflict, explicit missing-detail state, safe field errors, integer form validation, clearable metadata. | Before acceptance of CRUD demo; small independent changes. |
| **1C.6A — query invalidation/display precision (P2)** | F05/F10: mounted cached-cost/margin/dashboard tests and approximate/exact quantity policy. Preserve raw Decimal command quantities and accepted stock unit semantics. | Before operational demo. |
| **1C.6B — quality/accessibility fixes (P2)** | F13–F15: repair 8 lint errors/16 warnings, labels/errors/focus and 390px sale grid; build/font check. Keep broad visual redesign out. | Functional blockers before demo; deeper responsive/a11y coverage alongside redesign. |
| **1C.7 — dependency remediation (P1 risk)** | Reviewed compatible backend/runtime/tooling batches and all tests/scans in section 6. | Begin planning early; **before any shared/externally exposed demo or production**. Local synthetic repair tests can continue under current containment. |
| **Deployment configuration gate (P2 configuration, high release importance)** | F16 plus ingress/TLS/cookies/keys/monitoring/recovery tests. | Separate production-release work; never implied by a local build. |

Do not generate realistic demo data yet. Finish the business lookup/date/numeric/CRUD/display/financial-label prerequisites above and verify their behavior first; otherwise larger data masks defects and produces misleading demonstrations. Nonessential P3 visuals, brand polish and bundle optimization can accompany the later redesign. Authoritative security/dependency remediation and operational gates must complete before external deployment regardless of visual progress.

## 8. Test plan and preservation requirements

Keep accepted Phase 0/1A/1B evidence immutable. Add desired-behavior cases to the relevant maintained suite when a repair is authorized; keep failing audit probes explicit until the actual behavior is corrected. Do not turn them into tests that assert a 503, negative value or omitted record as success.

For each small package: run affected backend/API and frontend tests, full lint/build when frontend changes, and relevant actual browser flows. Before closing the repair series, repeat the entire 250-test preservation scope on both engines and independent PostgreSQL concurrency checks. Record skips per engine; SQLite is never evidence of PostgreSQL row locking. All ten integrated Phase 1A contracts must continue to pass as APIs, not just arithmetic experiments. All thirteen original role and twenty-six CSRF requirements remain mandatory.

Expanded functional cases: 0/1/20/21/25 records and later pages; search/sort/filter reset and export scope; lost responses, duplicate identities, stale revisions and unauthorized zero-write state snapshots; changed/deleted recipes and immutable original prices; midnight/year/month boundaries in Manila and non-Manila browsers; negative/zero/overflow/decimal values through all write layers; failed form loads and field validation; edited/cancelled/legacy CSV/PDF; long text and pagination; keyboard-only and screen-reader labels; mobile widths and larger font zoom. Use minimal synthetic fixtures, never accepted historical business data.

Repro commands from repository root, using the existing virtualenv:

```powershell
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_audit.py --backend sqlite --scope audit
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_audit.py --backend postgres --scope audit
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_audit.py --backend postgres --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_audit.py --backend sqlite --scope preservation
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_audit.py --backend postgres --scope browser
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_static.py
backend/.venv/Scripts/python.exe -B docs/phase1c1/run_dependencies.py
backend/.venv/Scripts/python.exe -B docs/phase1c1/config_probe.py
backend/.venv/Scripts/python.exe -B docs/phase1c1/summarize.py
```

PostgreSQL commands require the existing local Docker engine/cached image; browser requires installed Edge/Playwright and free owned ports. No wrapper falls back to project/production database settings. Advisory commands need public-registry network access; they do not install/fix packages. Audit exits nonzero while requirements fail. Existing migration hashes are checked; creating new migrations is outside this package.

## 9. Remaining production-readiness risks

Production remains unauthorized. Accepted local AUTH-01/AUTH-02/session evidence does not validate real production topology. Keep these separate release gates:

- Supported patched dependencies and documented residual advisory applicability.
- Actual HTTPS ingress, trusted proxy boundary/header scrubbing, host/origin/referer configuration, Secure/SameSite/HttpOnly cookies, request/header/upload limits and no exposed dev server.
- Production signing/HMAC/SECRET key custody and rotation/old-key policy, session environment separation and compatibility on upgrade. No secrets were inspected or rotated here.
- Real session cleanup scheduling/retention, rate-limit capacity/availability and lock-time monitoring; alerting on replay, deactivation and auth/database outages without token/password logging.
- PostgreSQL backup plus restored-copy recovery drill, ledger reconciliation, database privileges, migrations/trigger verification and rollback plan. Never rollback by deleting historical ledger records.
- Production static/media serving, manifest correctness, CSP/upload hardening, OS/runtime/container patching, load/concurrency and recovery verification.

The accepted session architecture's logout/password-change/deactivation/replay/atomic limiter tests continue to pass. Infrastructure outages remain fail-closed; F08 should correct business error classification without weakening that property. No dependency advisory is declared resolved by these regression passes.

## 10. Recommended next implementation checkpoint

**Request review of this audit and approval for Package 1C.2A: cache identity correctness only.** It has a small, confirmed failure, needs no migration or accounting decision, and can be validated by real list → edit → list navigation with page/ID collisions. Then review 1C.2B independently.

Owner decisions before dependent later packages: month-to-date versus full-month summaries; explicit profit/COGS labels and cost-estimate rounding; page/global summary/export scope; exact/approximate stock display; numeric zero-value policy (current serializers generally require strictly positive money/usage); zero-threshold/out-of-stock alert semantics; exact dependency cohort and migration plan. These are recorded for later approval, not silently chosen here.

Changed deliverables are this report, new audit-only files under `docs/phase1c1/` (runners/settings/probes/summary/raw evidence/screenshots), and narrowly scoped `docs/.gitattributes` rules preserving their hashed bytes across Windows checkouts. The complete file list and SHA-256 values are in [manifest.json](phase1c1/manifest.json). Generated terminal logs retain their original whitespace. Accepted application code, dependencies, migrations, tests and historical evidence remain unchanged. Owned test databases/containers/runtime directories and browser servers are cleaned up; per-run cleanup records and final summary retain that evidence.

**STOP: no repair implementation, upgrade, new migration or deployment is authorized by completion of this audit.**
