# Revival roadmap and approval gates

Date: 2026-11-09. This is a proposal based on [PROJECT_REVIVAL_AUDIT.md](PROJECT_REVIVAL_AUDIT.md), not authorization to implement later phases.

| Phase | Work and dependencies | Acceptance evidence | Gate |
| --- | --- | --- | --- |
| 0 | Inspect current architecture; reproduce defects in memory DB; baseline build/lint/browser/security; preserve evidence | Audit, source locations, 22 backend probes, frontend date/import probes, 10 screenshots and scan/build logs | Complete; owner review pending |
| 1 | Stabilize one module at a time; order below | Desired-behavior regression tests, actual business calculations, rollback/access-control checks; build/lint; API contract checks | Explicit approval before starting and after completion |
| 2 | Deterministic, development/demo-only seeding after stock/cost fixes | Repeated seed creates no duplicates; dry-run writes nothing; totals/stock agree; verified-demo reset preserves unrelated records; no shared public credentials | Separate approval |
| 3 | First present a brand-preserving design proposal; then implement approved scope | Desktop/mobile/tablet previews; keyboard, labels, dialog, contrast and zoom verification; workflow feedback | Separate design approval before substantial visuals; phase review after implementation |
| 4 | Improve existing public storefront metadata/navigation/assets only | Truthful public metadata, route/indexing checks; private-page exclusion; no invented business facts | Separate approval |
| 5 | Apply selected product quality, information security, human-centred design and WCAG practices | Measurable quality/security/usability evidence and remaining limitations | Separate approval; no certification claim |
| 6 | Optimize measured problems, CI, full regressions, release/rollback documentation | PostgreSQL integration/concurrency, browser E2E, dependency scan, migrations, build, restore rehearsal | Separate approval; no automatic deploy/production migration |

## Proposed Phase 1 sequence

1. **Sales/inventory:** first add tests that fail on INV-01/02/03/04/05/06. Move transaction logic to one cohesive service. Validate all inputs and aggregate required ingredient quantities before writing. Lock ingredient rows in deterministic order on PostgreSQL. Reject insufficient stock. Make sale and inventory changes commit or roll back together.
2. **Consumption history proposal:** present minimal additive movement/snapshot and request-identity schema for review. Persist exact signed quantities/precision, sale reference, actor/reason and operation identity where justified. Decide whether deletion becomes cancellation or retains current contract. Do not infer past consumption from today's recipe. Keep the existing tables and IDs. Mark unreconstructable historical consumption explicitly; agree reconciliation rather than fabricating it.
3. **Authentication:** agree owner/staff method permissions; enforce cookie CSRF including login; review one-hour access/seven-day refresh behavior; decide refresh/revocation strategy; add throttling and permission tests. Clarify Django superuser/admin flags versus business role. Retain HttpOnly cookies.
4. **Dependency updates:** prioritize unsupported Django and runtime security fixes; select a supported compatible release using current official advisories at implementation time. Upgrade small groups in isolated changes; review migrations/deprecations and lockfile diffs. Move unnecessary CLIs out of runtime dependencies if appropriate. Do not use automatic forced fixes/downgrades.
5. **Costing/integrity:** define measurement base units and stock/cost precision with examples. Keep monetary arithmetic Decimal until response formatting. Add validators and database checks only after an authorized data-quality audit; report invalid existing rows instead of silently clamping them.
6. **Historical revenue:** create a new backfill migration using SaleItem quantity × historical unit_price. Compare sale sums, subtotals and dashboard sums; make migration idempotent/reversible or record a precise recovery strategy. Never rewrite previously applied migrations.
7. **Reporting/API:** local-date formatting and year-month chart keys; explicit malformed/reversed-date validation; agreed financial metric labels; useful protected-delete errors; consistent response/error types; server search/filter/order and usable paginated selectors. Verify remaining CRUD errors individually.
8. **Frontend integration:** normalize Decimal/response contracts, invalidate dependent queries, retain pending states, show actual backend field errors, handle edit 404/network failures, clear lint errors with focused changes. Do not begin the substantial visual redesign here.

## Release-blocking Phase 1 acceptance examples

- Invalid sale update leaves Sale, SaleItems and all stock unchanged.
- Insufficient or duplicate/concurrent submission cannot overdraw, inflate or double-apply inventory.
- Injected exception at each write boundary fully rolls back; PostgreSQL concurrency tests pass.
- Changing/deleting a recipe cannot change historical sale consumption or restoration.
- Fractional batch consumption balances across separate transactions using agreed rounding.
- Negative/invalid money and quantities are rejected at API/model/database layers without corrupting existing data.
- Historical item subtotals match historical prices; chart totals equal underlying records across years.
- Cookie-authenticated unsafe requests without valid CSRF protection fail; approved role matrix enforced server-side.
- Records beyond 20 remain discoverable in storefront, lookup controls and searches.
- Build and required lint/tests pass; unresolved deployment/security limitations documented.

## Phase 2 design constraints

The current schema has no supplier entity, stock ledger, status/refund model or demo marker. Implement only supported demo scenarios; explain any required additive schema extension first. Generate approximately 90 days of PHP-priced synthetic activity through the same tested transaction rules. Restrict by an explicit nonproduction environment policy, not DEBUG alone. Tag/namespace demo ownership, use deterministic keys and a fixed configurable random seed, and avoid deleting unrelated records. Any reset must prove ownership and nonproduction context. The Phase 0 throwaway browser fixtures are intentionally not a demo generator.

## Decisions needed at implementation time

Owner/staff privileges; legitimate products without recipes; stock base units/precision; cancellation versus deletion; cash surplus versus accounting profit; trustworthy contact/business information; historical reconciliation method. These do not block the completed audit. Resolve them before their dependent fixes.

## Rollback and scope boundaries

Use the audit branch as a reviewable baseline. Later changes should be grouped by module and purpose, with tests and additive migrations where feasible. Document backup requirements and reverse operations before schema work. Keep production settings/data untouched until separately approved. Do not introduce payments, loyalty, suppliers, deliveries or a replacement frontend without an approved business requirement.

**Pending decision:** approve Phase 1 and its initial sales/inventory stabilization scope, or request changes to this roadmap.
