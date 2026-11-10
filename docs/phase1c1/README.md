# Phase 1C.1 audit evidence

Baseline `fdd46a3`; branch `codex/phase-1c1-functional-quality-audit`.
See [the review report](../PHASE1C_FUNCTIONAL_QUALITY_AUDIT.md) for the canonical
run directories, exact commands, limitations and proposed repair boundaries.

These are audit-only tools. `audit_cases.py` asserts desired behavior and
intentionally fails on the fourteen still-open API/model requirements.
`browser_audit.py` records false desired-behavior checks; its successful process
exit means evidence collection completed, not that the application passed.
Passing control/preservation tests are reported separately. Nothing here fixes
or waives an application defect.

`run_audit.py` reuses accepted isolation/hash guards, adds current audit
authorization, and writes only new evidence. The original approval marker is
retained for compatibility, alongside the explicit Phase 1C marker. Only existing
accepted migrations are applied to newly owned targets. Never replace these
settings with ordinary project settings or an existing database URL.

PostgreSQL targets are local, UUID-owned, tmpfs-only disposable containers.
SQLite targets are UUID-owned runtime files. Browser servers are owned child
processes, external traffic is blocked, and Vite cannot discover project .env.
All fixture data is synthetic and removed after each run. Advisory checking
uses public registries without installing packages or running audit fixes.

Earlier attempts and intermediate evidence are retained, including the corrected
audit-only fixture comparison and browser selector mistake. Use the final runs
named in the report. Static quality checks are now separate from network
advisory checks; the initial scan CLI/DNS failures remain in their original logs.

`verification-summary.json` is regenerated from retained raw results by
`summarize.py`. The manifest lists every delivered file and its SHA-256,
excluding the manifest itself. Narrowly scoped docs/.gitattributes rules keep
hashed bytes intact across Windows line-ending conversions. Raw logs retain
terminal whitespace and are not reformatted to satisfy source whitespace checks.
Accepted Phase 0 and Phase 1A/1B files are
unchanged. No application repair, migration creation, upgrade or deployment is
part of this package.
