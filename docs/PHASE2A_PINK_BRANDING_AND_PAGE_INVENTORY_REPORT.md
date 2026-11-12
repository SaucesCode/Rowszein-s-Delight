# Phase 2A revision — pink branding and page inventory

The revision is based on `5a840d9` and compares the application with the pre-redesign commit `6b30b27`. Both commits have the same 19 named React routes, the same catch-all behavior, the same route permissions, and the same Django URL configuration. The original management pages and storefront components are still present. Phase 2A changed the workspace shell, Dashboard and shared components.

## Complete page and route inventory

Owner means an active user with the business role `admin`. Staff means an active user with `role=staff`. Public includes signed-in users who visit the storefront. The component named in the table is the component at `6b30b27` and at `5a840d9`. All 19 remain registered in the pink revision.

| React route | Original purpose and component | Current entry | Roles | Status and correction |
| --- | --- | --- | --- | --- |
| `/` | Public shop, `LandingPage` | Direct URL, workspace shop shortcut | Public | Storefront page unchanged. Its desktop header shortcut was restored in the workspace. |
| `/login` | Sign-in and session renewal, `AuthLayout` and `LoginPage` under `GuestRoute` | Storefront’s desktop Owner Login icon, direct URL, guest guard and logout | Public guests. Signed-in owner and staff redirect to their own start page. | Unchanged. The existing icon is hidden below 640px. The URL is still available on phones. |
| `/dashboard` | Owner overview, `DashboardPage` | Dashboard sidebar/drawer and owner sign-in | Owner | Phase 2A redesign, now pink. Date presets, KPI values, chart, product ranking and stock alerts remain. |
| `/sales` | Sales history, `SalesPage` | Sales sidebar/drawer and staff sign-in | Owner and staff | Original page. Staff sees its own tracked sales. Owner posting totals, exports and cancellation remain on this page. |
| `/sales/new` | Record sale, `SaleFormPage` | Record Sale action on Sales. Dashboard shortcut for owner. | Owner and staff | Original form. Staff uses the current Manila day and catalog prices. |
| `/sales/:id/edit` | Edit sale, `SaleFormPage` | Edit action on an eligible sale | Owner | Original form, with existing UUID, revision, and historical safeguards. |
| `/ingredients` | Inventory, `StockRoute` → `IngredientsPage` or `OperationalStockPage` | Ingredients sidebar/drawer. Stock watch link on Dashboard. | Owner and staff | Original role-specific views. Owner sees inventory tools. Staff sees Stock quantities and safe fields. |
| `/ingredients/new` | Add ingredient, `IngredientFormPage` | Add Ingredient action | Owner | Original form. |
| `/ingredients/:id/edit` | Edit ingredient, `IngredientFormPage` | Ingredient row/card Edit action | Owner | Original form. Stock adjustment stays in the separate modal. |
| `/products` | Catalog management, `CatalogRoute` → `ProductsPage` or `OperationalCatalogPage` | Products sidebar/drawer | Owner and staff | Original role-specific views. The owner has category filters, hidden product controls, and product actions. Staff sees Catalog. |
| `/products/new` | Add or duplicate a product, `ProductFormPage` | New product action or Duplicate on an existing product | Owner | Original form and category lookup. |
| `/products/:id/edit` | Edit product, `ProductFormPage` | Product card Edit action | Owner | Original form. Existing selected category loads. |
| `/recipes` | Recipes and cost views, `RecipesPage` | Recipes sidebar/drawer | Owner | Original page, including search, filters, costs and missing-recipe entry points. |
| `/recipes/new` | Add recipe, `RecipeFormPage` | Add Recipe action | Owner | Original form, ingredient and product lookups, and live cost preview. |
| `/recipes/:id/edit` | Edit recipe, `RecipeFormPage` | Recipe row/card Edit action | Owner | Original form and saved product relation. |
| `/expenses` | Expense history, `ExpensesPage` | Expenses sidebar/drawer | Owner | Original page, including date, category and search controls, CSV/PDF and expense actions. |
| `/expenses/new` | Record expense, `ExpenseFormPage` | Add Expense action | Owner | Original form with Manila default date. |
| `/expenses/:id/edit` | Edit expense, `ExpenseFormPage` | Expense row Edit action | Owner | Original form. |
| `/profit-margins` | Product price and recipe-cost estimates, `ProfitMarginsPage` | Profit Margins sidebar/drawer | Owner | Original owner-only page. No new accounting calculation. |
| `*` | Unmatched URL, `Navigate` to `/` | Direct URL | Public landing after redirect | Existing fallback. A non-existent page path can look like a return to the shop. |

### Features without a standalone React route

| Feature | Original and current location | Access and status |
| --- | --- | --- |
| Category management | `/admin/products/category/` and its Django add/change/delete views. REST at `/api/products/categories/` and `/api/products/categories/:id/`. Product forms and catalog pages have category selectors and filters. | Neither compared commit had a React Categories management page. Django admin requires an active business owner with Django staff and appropriate model permissions. Category write APIs are owner-only. Public category reads retain their safe projection. |
| Stock adjustment | `UpdateStockModal` from the ingredient row/card menu. POST at `/api/ingredients/:id/adjustments/`. | Owner only. The existing adjustment still sends an operation UUID and revision. There was no standalone adjustment page. |
| Financial summary and exports | `/api/sales/financial-summary/`, sales and expense CSV/PDF endpoints, and ingredient CSV generated by the owner UI. | Owner only. These are existing actions or data endpoints. They do not represent additional React pages. |
| Storefront menu, featured products and cart | `/#menu`, `/#bestsellers`, and the cart drawer. Home, shop information and contact are sections of `/`. | Public. Menu and featured queries still page independently, hide unavailable items, and use public fields. The cart saves a shareable order summary. Neither commit had a separate product detail page or checkout route. |
| Django admin | `/admin/`, login/logout and password tools, registered Category, Product, Ingredient, Group, Sale, SaleItem and the five ledger models. | Separate Django workspace with its existing business-role and Django permissions. Retained sale and ledger records are read-only. The custom User model had no admin registration in either commit. |

The unchanged backend also exposes auth CSRF/login/logout/refresh/profile, ingredient list/detail/low-stock, product/category list/detail, recipes list/detail, sales list/detail and cancellation, expenses list/detail, Dashboard and Profit Margins. These remain APIs consumed by the pages above.

## What appeared missing

The original owner and staff navigation destinations are all still wired. Some headings differ by role, such as **Catalog** and **Stock quantities** for staff. Owner-only recipes, expenses, stock changes and financial views correctly return a restricted screen for staff. The existing local database and sign-in setup are independent of the route inventory.

The public shop was less obvious after Phase 2A moved its shortcut from the topbar to the rail footer and made the brand mark static. The revision restores **View live shop** in the workspace header at 640px and wider and keeps a dedicated link in the mobile drawer. Both open `/` in a new tab. No route definitions or role conditions changed. Category management and stock adjustments remain at their original entry points.

For local Django admin, open `http://127.0.0.1:8000/admin/`. The Vite app handles React pages and proxies `/api/`. Opening `/admin/` on Vite’s origin reaches the React catch-all and returns to the shop.

## Pink foundation

| Use | Tokens |
| --- | --- |
| Canvas, paper, rail | `#fff9fb`, `#ffffff`, `#fff1f5` |
| Highlight and action | `#fbe1ea` blush, `#f7b6c8` pink, `#f3a8bf` hover, `#e889a8` decorative accent |
| Text, focus and boundaries | `#4a3a3a` ink, `#715360` muted, `#602c46` berry action text, `#913354` focus, `#9c6d83` control border |
| Financial chart | Berry for net sales, `#905148` dashed expenses, `#754a88` dotted sales less expenses |
| Shape and type | 10px controls, 18px panels and 22px dialogs. Existing locally bundled Geist, with a rounded donut mark and tabular KPI values. |

White cards, a blush rail and a highlighted pink Net sales card set the visual hierarchy. Dark text and visible focus remain on controls. Stock warnings retain their semantic color and exact quantity text. Filters, dialogs, badges, loading states and existing page headers use the shared foundation. The Dashboard layout and data logic are the accepted Phase 2A implementation.

## Before and after

| Capture | Before at `5a840d9` | Pink revision |
| --- | --- | --- |
| Owner dashboard and sidebar, 1440px | [Cocoa](phase2a_pink/evidence/before-20261111-233555-610b63/owner-dashboard-1440.png) | [Pink](phase2a_pink/evidence/after-20261111-235018-e68809/owner-dashboard-1440.png) |
| Tablet dashboard, 768px | [Before](phase2a_pink/evidence/before-20261111-233555-610b63/owner-dashboard-768.png) | [After](phase2a_pink/evidence/after-20261111-235018-e68809/owner-dashboard-768.png) |
| Phone dashboard, 390px | [Before](phase2a_pink/evidence/before-20261111-233555-610b63/owner-dashboard-390.png) | [After](phase2a_pink/evidence/after-20261111-235018-e68809/owner-dashboard-390.png) |
| Other tested sizes | [1024px](phase2a_pink/evidence/before-20261111-233555-610b63/owner-dashboard-1024.png), [320px](phase2a_pink/evidence/before-20261111-233555-610b63/owner-dashboard-320.png) | [1024px](phase2a_pink/evidence/after-20261111-235018-e68809/owner-dashboard-1024.png), [320px](phase2a_pink/evidence/after-20261111-235018-e68809/owner-dashboard-320.png) |
| Staff drawer, 390px | [Before](phase2a_pink/evidence/before-20261111-233555-610b63/staff-navigation-390.png) | [After](phase2a_pink/evidence/after-20261111-235018-e68809/staff-navigation-390.png) |
| Public homepage | [Before](phase2a_pink/evidence/before-20261111-233555-610b63/public-home-1440.png) | [Desktop](phase2a_pink/evidence/after-20261111-235018-e68809/public-home-1440.png), [phone](phase2a_pink/evidence/after-20261111-235018-e68809/public-home-390.png) |
| Existing management pages | [Products before](phase2a_pink/evidence/before-20261111-233555-610b63/owner-products-1440.png) | [Products](phase2a_pink/evidence/after-20261111-235018-e68809/owner-products-1440.png), [Sales](phase2a_pink/evidence/after-20261111-235018-e68809/owner-sales-1440.png), [Ingredients](phase2a_pink/evidence/after-20261111-235018-e68809/owner-ingredients-1440.png), [Recipe edit](phase2a_pink/evidence/after-20261111-235018-e68809/owner-recipe-edit-1440.png) |
| Staff view and guard |  | [Stock quantities](phase2a_pink/evidence/after-20261111-235018-e68809/staff-stock-1440.png), [Access restricted](phase2a_pink/evidence/after-20261111-235018-e68809/staff-restricted-1440.png) |

The earlier comparison captures the original dashboard at `6b30b27`. This revision uses the same fixture design for the cocoa and pink views and keeps all captures local. [Original dashboard screenshot](phase2a/evidence/before-20261111-114704-c98796/dashboard-1440.png)

## Verification

| Check | Final result |
| --- | --- |
| Original route comparison | 19 identical named React routes and identical catch-all and role guards |
| Edge against isolated PostgreSQL | 92 passed, zero failed or skipped |
| Existing frontend regression scripts | 81 passed |
| TypeScript and Vite production build | Passed |
| Affected-file lint | Passed with zero errors or warnings |
| Full-project lint | Two existing errors and five existing warnings |

Edge opened all seven owner sidebar destinations and refreshed each one. It used the five add buttons and checked direct new/edit routes, including saved records on refresh. Back and Forward preserved the visited pages. Staff landed on Sales, saw their own sale after the owner logged out, and received the restricted screen on all 13 owner-only React routes. The stock API returned only staff-safe fields, and finance and recipe API reads were denied. An authorized owner opened the category change form in Django admin and read the saved category.

Public checks covered the restored shop link, the original homepage and login route, featured products, pagination beyond 20 items, a hidden product, menu search, and the cart summary. The existing stock modal submitted one synthetic adjustment with its UUID and revision and retained the ninth decimal. The test checked table headers, keyboard skip navigation, the trend’s table alternative, mobile drawer focus, and direct access behavior. [Browser results](phase2a_pink/evidence/after-20261111-235018-e68809/after.json)

The five dashboard widths were 320, 390, 768, 1024 and 1440px. The first run found that a Recharts tooltip could retain its desktop position during resize, producing horizontal scroll at 320px and 390px. The chart now contains that overflow and retains visible focus and its interactive tooltip. Sampled text contrast ranged from 6.41:1 to 10.79:1. The secondary control boundary measured 4.26:1 and the focus color 7.49:1 against the header. This was a focused contrast and keyboard review in Edge. [WCAG 2.2 contrast criteria](https://www.w3.org/TR/WCAG22/#contrast-minimum)

The browser runner restored only schema and three framework metadata tables into a fresh temporary PostgreSQL container, then created synthetic records there. It executed zero migrations and copied zero application rows. The test container, runtime and loopback web servers were removed. Preliminary runs remain in the evidence folder, including the first schema copy’s duplicate public-schema error, browser test selector corrections and the resize diagnosis. The build retains the existing CSS import-order and chunk-size warnings. [Schema isolation](phase2a_pink/evidence/after-20261111-235018-e68809/schema-copy.json) · [Frontend results](phase2a_pink/evidence/static-20261111-235013-a5c7d0/summary.json)

## Pending dedicated redesigns

- **Phase 2B** remains Sales and Inventory. The old sales and stock forms and tables are present. The stock adjustment dialog’s visible Quantity and Note captions still lack programmatic field associations, and the owner stock table uses its previous compact quantity display. Exact quantities remain available in the API and adjustment workflow.
- **Proposed Phase 2C** covers the remaining management experience. Products and category tooling, recipes and costing, expenses, margin views, and sign-in retain their existing implementations.
- **Proposed Phase 2D** covers the public storefront. Its independent layout, browsing, cart and contact workflows remain in place. A dedicated redesign can share the pink brand with a distinct customer-facing layout.
