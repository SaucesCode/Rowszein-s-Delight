# Revival changelog

## 2026-11-09 — Phase 1A package 1A.1; database approval checkpoint

Preserved reviewed Phase 0 documents/evidence in commit `5e6991c`; created `codex/phase-1a-sales-inventory`. Added desired-behavior sales regressions first (18 tests, 13 failures against original code), then moved edit validation before restoration and wrapped HTTP create/update/delete in atomic transactions. All 18 tests pass on SQLite and disposable PostgreSQL 17.11; frontend production build passes with existing warnings. No model/schema changes or migrations were created.

Added isolated regression settings, disposable PostgreSQL runner/evidence, [progress report](PHASE1A_PROGRESS.md) and [database design proposal](PHASE1A_DATABASE_PROPOSAL.md). Full Phase 1A remains incomplete: insufficient-stock handling, historical consumption, successful-request idempotency, fractional allocation and concurrency await the approved schema/service package. AUTH-01/02 remain unresolved. No deployment, production changes or later-phase work occurred. Stopped for the mandatory schema/business-policy approval.

## 2026-11-09 — Phase 0 audit

Created `PROJECT_REVIVAL_AUDIT.md`, `REVIVAL_ROADMAP.md`, `SECURITY_REVIEW.md`, `SEO_AUDIT.md`, `QUALITY_CHECKLIST.md`, `TEST_RESULTS.md`, this changelog, and reproducible scripts/evidence under `docs/audit/`.

Audited existing architecture, business calculations, inventory/sales integrity, auth/permissions, API integration, public SEO, accessibility, build/lint/dependencies and performance. Captured 10 local desktop/mobile screenshots. Executed 22 backend evidence probes and frontend date/import probes. Preserved actual build/lint/migration/security outputs, including failures and limitations.

No business defects were fixed in this phase. No application implementation, deployment configuration, existing migration, requirements or lockfile was changed. No production data/credentials were used or modified; no deployment took place. Local dependencies were installed for audit execution. Work is isolated on `codex/phase-0-revival-audit` from baseline `78ee4a0`.

Phase 1 is awaiting explicit owner approval. A demo-data guide will be created with Phase 2 implementation rather than as an empty placeholder now.
