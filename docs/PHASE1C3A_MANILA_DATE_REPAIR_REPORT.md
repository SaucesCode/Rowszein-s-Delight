# Phase 1C.3A — Manila business dates and strict date filters

Package 1C.3A fixes F03 and F06 on `codex/phase-1c3a-manila-dates`, based on accepted commit `3934b74`. The date controls use the Manila calendar, and invalid date filters return HTTP 400 across the eight date-filtered endpoints.

## Before and after

| Finding | Before on `3934b74` | Repaired behavior |
| --- | --- | --- |
| F03, UTC date drift | At Manila midnight on March 1, 2024, Edge requested February 29 for Today and showed the leap-day sale. The expense default was February 29. Dashboard Year sent December 31, 2023 through February 29, 2024. The accepted date-helper probe also reproduced the wrong start of week and month. | At that same instant, Today and the new expense default use March 1. The month starts March 1. Dashboard Year sends January 1 through March 1 and the API echoes those exact bounds. |
| F06, inconsistent date filters | Across eight endpoints and eight invalid input shapes, 54 requests returned HTTP 200. The other 10 returned HTTP 400 with a string instead of a field-level error. All 64 assertions failed the new contract. | Every endpoint rejects malformed, impossible, blank, duplicate, or reversed values with the same field-level error shape. Invalid exports carry no download headers. |

Baseline evidence includes the [browser observations](phase1c3a/evidence/20261111-111642-sqlite-before-browser-504cb009/before-browser.json), [date-helper probe](phase1c3a/evidence/baseline-frontend/date-probes.json), and [API assertions](phase1c3a/evidence/20261111-111430-sqlite-before-api-daab4ca2/before-api.txt).

## Manila calendar and API contract

- Presets derive today's calendar day from the instant in `Asia/Manila`. The shared TypeScript functions use numeric calendar arithmetic for week, month, quarter, year, and yesterday, independent of the browser timezone or daylight saving time. A week starts Monday and ends Sunday. Presets end on today and custom input stays a date-only string.
- Sales and expenses history, sales and expenses CSV/PDF, dashboard, and sales financial summary all take `date_from` and `date_to` as inclusive bounds. Each supplied bound must appear once and match ASCII `YYYY-MM-DD` with a real calendar date and a year from 0001 through 9999. A bound sent as an empty string is invalid. Clients omit a bound to use the behavior below.

| Endpoint family | Omitted bounds | Recorded field used |
| --- | --- | --- |
| Sales list and CSV/PDF | Open on the omitted side | `Sale.date`, the original business date |
| Expense list and CSV/PDF | Open on the omitted side | `Expense.date` |
| Dashboard and sales financial summary | Omitted start uses January 1 of the current Manila year. Omitted end uses the current Manila day. | Sales use `SaleFinancialEntry.effective_date` plus disjoint legacy `Sale.date`. Dashboard expense totals use `Expense.date`, and dashboard product mix uses original `Sale.date`. |

After applying the applicable defaults, the API rejects a start later than the end. Equal endpoints select a single business date. Date validation runs after authentication and authorization and before queryset evaluation or export generation. A reversed range returns this HTTP 400 body.

```json
{"success": false, "error": {"date_to": ["The end date must be on or after the start date."]}}
```

Sales and expense custom filters omit cleared bounds, explain invalid ranges, and disable export while the range is invalid. Valid exports use the same bounds as the visible list. Dashboard date controls stay available during loading and after a rejected range so the user can correct it. Sales history can still use an open bound even if the separately defaulted financial report would be reversed.

## Financial and historical preservation

The integration test creates a ₱25.00 tracked sale dated February 29, a ₱4.00 legacy sale that day, and a ₱7.00 sale on March 1. The tracked sale is cancelled on March 1 through the existing API.

| Range | Gross sales | Signed cancellation | Net sales |
| --- | ---: | ---: | ---: |
| February 29 | ₱29.00 | ₱0.00 | ₱29.00 |
| March 1 | ₱7.00 | −₱25.00 | −₱18.00 |
| February 29 through March 1 | ₱36.00 | −₱25.00 | ₱11.00 |

The February 29 sale CSV and PDF contain the original sale and the legacy sale. The PDF original values total is ₱29.00. The expense exports contain only the ₱3.50 leap-day expense. Tests compare full persisted business rows before and after filtered reads and exports, including sales, inventory, consumption, operation identities, and financial postings. The resulting rows match exactly.

The repair changes the date range passed to existing reporting and history queries. It leaves the transaction and signed posting code, historical dates, staff write restrictions, security session deadlines, and migrations outside the diff. The test harness uses only disposable databases and the accepted migration files.

## Verification results

| Run | Passed | Failed | Skipped | Evidence |
| --- | ---: | ---: | ---: | --- |
| PostgreSQL date API | 6 | 0 | 0 | [API run](phase1c3a/evidence/20261111-112755-postgres-api-220572cb/summary.json) |
| SQLite date API | 6 | 0 | 0 | [API run](phase1c3a/evidence/20261111-112758-sqlite-api-65b457c6/summary.json) |
| PostgreSQL preservation | 263 | 0 | 1 SQLite-only | [Preservation run](phase1c3a/evidence/20261111-112119-postgres-preservation-73ccc93f/summary.json) |
| SQLite preservation | 229 | 0 | 35 PostgreSQL-specific | [Preservation run](phase1c3a/evidence/20261111-112120-sqlite-preservation-75402382/summary.json) |
| Edge against PostgreSQL | 127 | 0 | 0 | [Browser observations](phase1c3a/evidence/20261111-112609-postgres-browser-b600b4bd/browser.json) |
| Frontend scripts | 81 | 0 | 0 | [Frontend run](phase1c3a/evidence/20261111-112507-frontend-f0f30b72/summary.json) |

The six API cases on each engine include 72 invalid-filter requests across the eight endpoints, optional and inclusive bounds, field errors, actual CSV/PDF content, signed posting totals, and authorization before validation. The preservation suite includes the 120 Phase 1A tests, the accepted CSRF, role, session, throttling, and idempotency coverage, and the 14 catalog pagination tests. Test output records skips individually.

The browser matrix used `Asia/Manila`, `UTC`, and `America/New_York`. It covered Manila 23:59 and 00:00, leap day and the March month transition, the December 31/January 1 transition, and Sunday/Monday on New York's spring-forward date. It checked the actual API query parameters and returned scope, Today/Yesterday group labels, expense defaults, and correction of reversed ranges. Edge downloaded and inspected sales and expenses CSV/PDF files. A staff user in New York submitted a real synthetic sale at the server-accepted Manila date and catalog price.

TypeScript and the Vite build passed with the existing CSS import and bundle size warnings. Affected-file lint passed with four existing warnings. Full-project lint still has two errors and five warnings. The frontend scripts include the 66 accepted checks and 15 new date cases.

The raw evidence includes preliminary harness attempts that are excluded from the final totals. The API fixture was corrected to supply the recipe required by the transaction service. The browser harness was corrected to pass an aware timestamp and account for Monday sharing the Today cache entry. SHA-256 verification matched all 394 files listed across the Phase 0, 1C.1, 1C.2A, and 1C.2B manifests. Disposable PostgreSQL containers, temporary database directories, browser services, and the frontend build runtime were removed.

## Changed application files

| Area | Files |
| --- | --- |
| Backend | `backend/backend/date_filters.py`, `backend/dashboard/views.py`, `backend/expenses/views.py`, `backend/sales/views.py` |
| Calendar and compatibility | `frontend/src/lib/dateRanges.ts`, `frontend/src/lib/groupByDay.ts`, `frontend/src/lib/permissions.ts` |
| Date and export controls | `frontend/src/components/DateRangeFilter.tsx`, `frontend/src/components/ExportMenu.tsx` |
| Read-query hooks | `frontend/src/hooks/useDashboard.ts`, `frontend/src/hooks/useExpenses.ts`, `frontend/src/hooks/useSales.ts` |
| Screens | `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/ExpenseFormPage.tsx`, `frontend/src/pages/ExpensesPage.tsx`, `frontend/src/pages/SalesPage.tsx` |
| Verification and documentation | This report and `docs/phase1c3a/`, which contains the runner, date tests, and raw evidence. |

## Limits and review checkpoint

- Preset dates are calculated on render. A view left idle across midnight can keep its last rendered range until it renders again or is refreshed.
- History exports follow the original business date and the existing export columns. Signed posting totals remain in the separate financial report. Search and category filters applied locally to a history page are outside the date-filter contract.
- F05 derived-cost invalidation, F09 monthly report semantics, and F11 page/global summary scope remain tracked in the [Phase 1C.1 audit](PHASE1C_FUNCTIONAL_QUALITY_AUDIT.md).
- Dependency and security remediation, F01 numeric integrity, and F07 spreadsheet formula injection in CSV remain separate release blockers before public or production exposure. Production topology, key rotation, monitoring, backup recovery, and deployment validation remain operational release gates.

The next planned phase is UI/UX design and implementation after owner review of 1C.3A. Release authorization is a separate checkpoint.
