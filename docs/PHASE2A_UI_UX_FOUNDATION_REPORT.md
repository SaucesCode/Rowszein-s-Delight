# Phase 2A — UI/UX redesign foundation

Phase 2A introduces the shared design system, authenticated workspace shell, and owner dashboard on `codex/phase-2a-ui-foundation`, based on `6b30b27`.

## Design concept and tokens

The workspace borrows the warmth of a bakery counter. A cocoa rail carries the existing cake-slice mark and Rowszein’s Delight wordmark. Ivory paper surfaces separate the ledger and stock information from the chrome. Blush identifies the current page, while caramel distinguishes inventory warnings and the expense series. The strongest visual emphasis goes to the selected period’s net sales.

| Token group | Values and usage |
| --- | --- |
| Surfaces | Canvas `#f7efe6`, paper `#fffcf8`, cocoa rail `#34231e`, divider `#e6d8cc` |
| Text and actions | Ink `#38251f`, muted `#6d5347`, primary `#61382e`, primary hover `#4d2b24` |
| Accents and controls | Blush `#f6d9df`, rose focus `#873d55`, caramel `#87501e`, control border `#967b6d` |
| Semantic colors | Success `#245b40` on `#e7f1e9`, warning `#774218` on `#faeddc`, danger `#8b3139` on `#fbe9eb`, info `#435676` on `#ebeff8` |
| Type | Georgia for the wordmark and display headings. Locally bundled Geist Variable for workspace text and controls. KPI numbers use tabular figures and preserve the full peso amount. Dashboard title scales from 32 to 52px and KPI values from about 22 to 39px. |
| Layout | Spacing scale 4, 8, 12, 16, 24, and 32px. Radii 8px for controls, 16px for panels, 20px for dialogs. Content maximum 1400px. The sidebar gives way to a drawer below 960px. Dashboard columns respond to available content width. |
| Motion | 140ms color transitions on controls, static skeletons, and stable chart space. The workspace honors reduced motion. |

The shared token and primitive rules live in [workspace.css](../frontend/src/workspace.css).

## Reusable components

| Foundation | Implementation |
| --- | --- |
| Forms and actions | Workspace styles for existing button, input, select, textarea, label, validation, disabled, and focus classes. `DateRangeFilter` uses labeled native dates, associated error text, and a clear action. |
| Data presentation | Shared surface, semantic badge, table, tabular number, and skeleton classes. `StatCard` renders labeled values. The dashboard uses semantic tables for product and chart data. |
| Feedback | `WorkspaceState` supports empty, denied, and recoverable error states. Existing `EmptyState` delegates to it. The existing toaster uses the success and danger tokens. |
| Dialogs | The existing `ConfirmDialog` uses the installed Radix alert dialog with keyboard containment, Cancel focus, Escape handling, and focus restoration. The mobile rail uses Radix Dialog. Both use the same overlay and control styling. |

## Shell and dashboard

- The shell shows the current section, the record context on new/edit routes, and the account’s name and role. The desktop sidebar collapses to labeled icon controls with focus tooltips. The mobile menu traps focus while open, returns focus to its trigger on Escape, and moves focus into the destination after a menu navigation. Opening and closing the menu keeps the current form mounted.
- The owner dashboard uses the existing endpoint, including signed net sales, recorded expenses, and the existing difference. The UI calls the last value **Sales less expenses** and explains its inputs. Accounting profit and F09 monthly summary semantics remain open for a separate business decision.
- The preset and custom controls use the accepted Manila date helpers. Applied bounds are visible next to the period selector. Year compares the current month to date with the preceding month when that baseline exists. Shorter or custom views show their own selected range. The chart shows the months inside the applied range and keeps each API value intact.
- The trend chart uses distinct line styles and a table of full amounts. Product performance keeps the API’s order by units sold and displays item values by original sale date. Long product names wrap. Stock watch shows current threshold alerts independent of the report dates, with exact recorded quantities.

## Before and after

| View | Before | After |
| --- | --- | --- |
| Owner dashboard at 1440px | [Desktop baseline](phase2a/evidence/before-20261111-114704-c98796/dashboard-1440.png) | [Desktop redesign](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-1440.png) |
| Owner dashboard at 1024px |  | [Compact desktop](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-1024.png) |
| Owner dashboard at 768px | [Tablet baseline](phase2a/evidence/before-20261111-114704-c98796/dashboard-768.png) | [Tablet redesign](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-768.png) |
| Owner dashboard at 390px | [Phone baseline](phase2a/evidence/before-20261111-114704-c98796/dashboard-390.png) | [Phone redesign](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-390.png) |
| Owner dashboard at 320px |  | [Narrow phone](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-320.png), [large negative value](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-large-negative-320.png) |
| Staff navigation at 390px | [Drawer baseline](phase2a/evidence/before-20261111-114704-c98796/staff-menu-390.png) | [Staff drawer](phase2a/evidence/after-20261111-221106-3a60f5/staff-menu-390.png), [restricted page](phase2a/evidence/after-20261111-221106-3a60f5/staff-denied-390.png) |
| Product table and confirmation |  | [Long product names](phase2a/evidence/after-20261111-221106-3a60f5/dashboard-products-1440.png), [sale confirmation](phase2a/evidence/after-20261111-221106-3a60f5/confirm-390.png) |

Screenshots use disposable API data and local verification accounts. The main comparison uses the same owner date range and recorded amounts.

## Permissions and accessibility

The owner saw seven authorized destinations. Staff landed on Sales and saw Sales, Ingredients, and Products after the owner logged out of the same browser. The staff member saw their own sale while the same-day owner sale stayed hidden. A direct staff visit to Dashboard showed the restricted page. The actual dashboard API returned 403, and the stock API returned only staff-safe fields. Removing the staff access cookie led to the existing renewal flow, which returned the user to Sales.

Edge verified navigation and chart fit at 320, 390, 768, 1024, and 1440px without horizontal page overflow. Keyboard checks covered skip navigation, visible focus, sidebar tooltips, native radio arrows, drawer containment and restoration, and the confirmation dialog. The browser also checked reduced motion and preservation of typed notes across menu toggles.

Rendered text samples measured 6.19:1 to 12.16:1, and the secondary control boundary measured 3.84:1. These checks used the WCAG 2.2 AA contrast thresholds for text and controls. The new primary actions and menu controls use 44px targets. This is a focused browser and contrast review of the new surfaces. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Verification and performance

| Check | Result |
| --- | --- |
| Accepted frontend regression checks | 81 passed across cache identity, listing parameters, CSRF, operation identity, stock precision, permissions, session lifecycle, and date ranges |
| TypeScript and production build | Passed |
| Affected TypeScript/React lint | Passed with zero errors or warnings |
| Full-project lint | Two existing errors and five existing warnings |
| Real Edge browser workflows | 70 passed on disposable PostgreSQL |

The browser exercised Manila date presets from New York, custom date correction, exact stock quantities, zero and large negative peso values, loading and retry, real owner/staff cookies, and a cancellation that kept the existing UUID and revision headers. The backend and API contracts are outside this frontend diff. Browser checks exercised the accepted API directly. The accepted backend preservation totals remain recorded at 1C.3A. [Browser checks](phase2a/evidence/after-20261111-221106-3a60f5/after.json) · [Frontend checks](phase2a/evidence/static-20261111-220558-d24303/summary.json)

The initial JavaScript fell from 305.76 to 228.53 kB gzip after splitting the chart into a 102.94 kB gzip lazy chunk. Total JavaScript for an owner who loads the chart is 331.47 kB gzip, up 25.71 kB. CSS increased from 7.63 to 10.96 kB gzip and the workspace adds a 29.40 kB local font file. Build output still warns about the existing CSS import order and large initial chunk. The chart reserves its space before loading and disables drawing animation. The desktop browser load recorded a layout-shift sum of 0.0001 in this run. This is a local observation, with broader device performance still unmeasured. [Baseline build](phase1c3a/evidence/20261111-112507-frontend-f0f30b72/build.txt) · [Phase 2A build](phase2a/evidence/static-20261111-220558-d24303/build.txt)

Preliminary evidence records the verification fixture’s missing device session, SQLite’s concurrent session-read 503s, and the visual contrast correction. The final browser matrix used PostgreSQL. The final run’s owned database and loopback servers were removed.

## Known limitations and next review

- Keyboard and visual verification used Edge. Assistive-technology testing and a broader browser matrix remain appropriate as more pages adopt the system.
- Very wide date ranges can crowd the chart. The exact monthly figures are available through the scrollable table. The accepted Manila preset still updates on render, so an idle tab can retain its last range across midnight.
- Existing operational forms and tables have their previous page-level behavior. Opening or collapsing navigation preserves current input. A route change still follows each form’s existing lifecycle.
- Numeric-integrity gaps, spreadsheet formula injection in CSV, dependency security, and production operations remain tracked release blockers. [Accepted functional audit and release gates](PHASE1C_FUNCTIONAL_QUALITY_AUDIT.md)

For Phase 2B, apply the foundation to the sales and inventory workspaces first. Focus on recording a sale, reviewing history, locating stock, and using existing adjustment and edit forms on phones and with a keyboard. Keep the approved ledger and permission contracts as acceptance criteria. Phase 2A ends at this review checkpoint.
