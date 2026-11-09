# DECISIONS

## 2026-06-10

Decision:

Use Django REST Framework.

Reason:

Best fit for React frontend and business applications.

---

Decision:

Use JWT Authentication.

Reason:

Works well with SPA architecture.

---

Decision:

Use PostgreSQL.

Reason:

Reliable relational database and scalable.

---

Decision:

Use React Query instead of Redux.

Reason:

Simpler server state management.

---

Decision:

Build Backend First.

Reason:

Business logic is more important than UI.

---

Decision:

Use Admin and Staff roles only.

Reason:

Keeps authorization simple during MVP development.

---

Decision:

Focus on MVP only.

Reason:

Finish core business features before adding advanced functionality.

---

## 2026-06-11

Decision:
Use HttpOnly cookies for JWT storage instead of localStorage.

Reason:
localStorage is vulnerable to XSS — any injected script can steal the token.
HttpOnly cookies are inaccessible to JavaScript entirely, eliminating that attack vector.
withCredentials: true on Axios sends cookies automatically on every request.

## 2026-11-09 — Five-model implementation authorization

The owner approved InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement and SaleFinancialEntry implementation, additive migration generation/inspection, test definitions and documentation. The owner expressly withheld execution of every new migration, including disposable test-runner migrations. Cancellation uses signed financial reversals on the cancellation date (not a refund); inventory reverses exact applied snapshots, never redistributed rounding; the lifetime allocation cursor never decreases. Original sale facts and unverifiable legacy stock history remain preserved. Idempotency and cancellation uniqueness require database constraints; stale edits require revisions. See [implemented contract and remaining verification](PHASE1A2_IMPLEMENTATION_CHECKPOINT.md). All ten prior API blockers remain open; no production or later-phase approval is inferred.

## 2026-11-09 — Subsequent disposable verification authorization

The owner explicitly authorized executing both generated migrations, historical fixture migrations, regression/integration/concurrency/browser tests, disposable backup/restore and unused reversal rehearsals, with focused inventory/sales corrections. Production environments/data/migrations/deployment and automatic later/security packages remained forbidden. The dedicated owned-target settings retain general migration safeguards. [Actual verification](PHASE1A3_DATABASE_VERIFICATION_REPORT.md) now closes the ten API blockers on disposable PostgreSQL; it does not change production/security authorization. Unsafe SQLite quantities are rejected under the already-approved representability policy, without changing schema or PostgreSQL precision. Stopped for review after Phase 1A.3.
