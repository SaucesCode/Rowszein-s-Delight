# Quality baseline and proposed acceptance checklist

Date: 2026-11-09. This records Phase 0 evidence and future acceptance targets; unchecked items are not completed work. The requested ISO frameworks guide future evaluation, not certification.

Framework references: [ISO/IEC 25010:2023 product quality model](https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/07/81/78176.html), [ISO/IEC 27001:2022](https://www.iso.org/standard/27001), and [ISO 9241-210:2019](https://www.iso.org/standard/77520.html). The tables below are project-specific acceptance proposals, not a clause-by-clause assessment of those standards.

## Phase 0 evidence

- [x] Architecture, modules, API routes and relationships inspected.
- [x] Negative-cost validation tested at API and model layers.
- [x] Inventory corruption, historical restoration and rollback defects reproduced in isolated memory databases.
- [x] Fresh migrations apply; model/migration drift check returns no changes.
- [x] Build/lint/dependency and browser baselines retained, including failures/warnings.
- [x] Public SEO distinguished from private MIS access and utility pages.
- [x] Roadmap includes explicit approval gates and no automatic deployment.
- [ ] Phase 1 approval received.

## Product quality targets using the requested ISO/IEC 25010:2023 characteristics

| Characteristic | Current evidence | Proposed measurable acceptance |
| --- | --- | --- |
| Functional suitability | Normal sale math works; invalid/oversold operations corrupt stock | Approved sales/stock/cost examples match database and API exactly, including rejection paths |
| Performance efficiency | JS 1,026.68 kB; margin queries grow from 4 to 9 with 1→6 products | Record before/after assets and queries; eliminate per-product query growth; set realistic latency budgets after PostgreSQL measurement |
| Compatibility | React SPA + cookie API; production browser cookie behavior unknown | Supported desktop/mobile browsers pass login, CRUD and reporting; validate deployment cookie/proxy behavior |
| Interaction capability | Responsive layout exists; mobile selector width 42px; labels/dialog defects | Core tasks usable by keyboard at 390px/768px/1440px and 200% zoom with clear feedback and accessible controls |
| Reliability | No pre-existing executable tests; non-atomic sales | Fault injection rolls back every mutation; retries idempotent; concurrent PostgreSQL tests preserve stock invariants |
| Security | CSRF and role enforcement gaps; unsupported dependencies | Deny unauthorized/forged writes; security scan findings triaged/remediated with documented residual risks |
| Maintainability | Duplicate form/date/export logic, 13 lint errors | Required lint/type/build checks pass; focused shared helpers; clear API types and regression tests |
| Flexibility | Catalog breaks beyond 20 records; environment setup undocumented | Seed/configure nonproduction reproducibly; discover/edit records beyond first page; responsive supported workflows |
| Safety | Incorrect costs/stock/profit can mislead business actions | Validation prevents destructive incorrect operations; history/actor/reason preserved; explicit recovery/cancellation behavior |

## Risk-based security targets (ISO/IEC 27001:2022 framing)

- [ ] Owner/staff role matrix agreed and enforced on every relevant backend method.
- [ ] CSRF/session expiry/logout and login abuse cases tested.
- [ ] Constraints and historical-data checks deployed through reviewed migrations.
- [ ] Domain auditability, export/upload policy, dependency review and secret handling documented.
- [ ] Hosting, database access, media retention, backups and recovery verified in an approved environment.

## Human-centred design targets (ISO 9241-210:2019 framing)

- [ ] Validate owner/staff tasks and context: recording a sale, correcting a mistake, restocking, changing recipe, reviewing results.
- [ ] Review the proposed design and task flows with the owner before substantial redesign.
- [ ] Observe task completion/confusion on representative devices; retain findings and iterate.
- [ ] Explain stock units, page/filter scopes, cash/financial metric meaning and failure recovery in user language.

## Preliminary WCAG 2.2 AA checklist

- [ ] Programmatically associated labels, helper text, validation messages and named switches.
- [ ] Visible focus, logical order, skip link, keyboard-operable menus, correctly managed dialogs/drawers.
- [ ] Normal text contrast at least 4.5:1 where required; review control and focus contrast.
- [ ] Touch targets, reflow/zoom and mobile forms verified.
- [ ] Meaningful headings/table semantics; screen-reader testing of errors, loading and charts.
- [ ] Consistent reduced-motion treatment, including smooth scroll and sliding panels.

Existing reduced-animation support, image alt text, explicit button labels in many shared controls, and error/loading states should be retained. A complete conformance audit has not been conducted. Use the [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) for criterion-level verification rather than claiming accessibility from automated checks alone.
