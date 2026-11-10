# Phase 1B.3 — disposable database verification checkpoint

Date: 2026-11-10 (Asia/Shanghai). Approved candidate: `30a9a61`. Verification branch: `codex/phase-1b3-disposable-verification`. Focused corrective commit: `c94d20f`.

**Result: PostgreSQL verification passes; package remains incomplete because SQLite throttling fails closed with 503.** The exact SQLite correction is prepared but unapplied, awaiting authorization for its changed migration hash. No production database access, deployment, Redis, dependency upgrade, demo dataset, SEO or redesign occurred.

## Authorization, isolation and migration provenance

All database activity used newly created targets from the existing ownership-verified harness. Its original marker/token checks remain, with an additional Phase 1B.3 approval and migration-hash gate. Production `.env` discovery is disabled with decouple RepositoryEmpty; inherited database credentials are scrubbed. The frontend browser/build processes use an empty Vite envDir.

PostgreSQL **17.11** used the existing postgres:17-alpine image (`sha256:f02121de6f74d30d8a94cd1d9584125e2178d7e6c377d8130112d4e52d867995`), local desktop-linux named-pipe Docker context, generated database/owner names and random credentials, loopback publication, and a 384-MiB tmpfs. Persistent/bind mounts are refused; explicit HostConfig.Tmpfs checks supplement the original mount guard. SQLite **3.53.1** used separately owned UUID runtime directories/files. PostgreSQL read-committed isolation and UTC server timezone were recorded. Detailed identity/context/mount metadata is retained per run without credentials.

The two approved migrations remained **byte-for-byte unchanged after canonical UTF-8/LF normalization**:

| Migration | SHA-256 |
| --- | --- |
| accounts/0002_auththrottlebucket_devicesession_user_session_epoch_and_more.py | `238e349a75556bc354d059052f79affff693137ec8af06ca01a3db01eebe2cf6` |
| accounts/0003_session_security_guards.py | `0a1693d44a00f043bc066807056754675700138a71d5ad27a9148b589e7f4c51` |

The harness compares both the original committed blobs and static manifest before execution. Migration plans and actual generated 0002 SQL were captured/reviewed on separate preflight targets; subsequent executions must match those reviewed SQL hashes. Django sqlmigrate cannot render RunPython: the approved guard strings were reviewed separately, then installed definitions were inspected on the real servers. Initial failure evidence is preserved rather than overwritten.

## Actual test outcomes

These are separate suite executions, **not an aggregate of unique tests**; concurrency/business cases intentionally overlap across reruns. Skips never count as passes.

| Final relevant execution | Passed | Failed | Errors | Skipped | Evidence directory under docs/phase1b3_verification/evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| PostgreSQL Phase 1A business suite | 120 | 0 | 0 | 0 | 20261110-144155-postgres-business-73cd9250 |
| PostgreSQL security/session/roles/CSRF/operations | 93 | 0 | 0 | 1 | 20261110-150433-postgres-security-bf7a071d |
| PostgreSQL session + prior business/RBAC concurrency | 28 | 0 | 0 | 0 | 20261110-145954-postgres-concurrency-71e16a88 |
| Previous RBAC sequential suite, explicit V2 fixtures | 21 | 0 | 0 | 0 | 20261110-144556-postgres-rbac-cce877fa |
| PostgreSQL upgrade/schema/backup/reverse/cleanup checks | 28 | 0 | 0 | 0 | 20261110-150447-postgres-schema-2a80069a |
| Real Edge/React/PostgreSQL browser checks | 33 | 0 | 0 | 0 | 20261110-151057-postgres-browser-a027024d |
| SQLite Phase 1A business suite | 103 | 0 | 0 | 17 | 20261110-144607-sqlite-business-27fab103 |
| SQLite security suite, original migration | 67 | 17 | 0 | 0 | 20261110-143457-sqlite-security-f88c2ac7 |
| SQLite focused trigger/debit reproduction | 0 | 1 | 1 | 0 | 20261110-144141-sqlite-diagnostic-b5748ee5 |
| SQLite upgrade/schema/backup/reverse/cleanup checks | 27 | 0 | 0 | 0 | 20261110-150819-sqlite-schema-bbfdb7b5 |
| Frontend utility assertions | 52 | 0 | 0 | 0 | 20261110-150715-frontend-ca4f3d0b |

The one PostgreSQL security skip is a **SQLite-specific stored-DDL formatting test**, not a missing PostgreSQL security/concurrency requirement. SQLite's 17 skips are the existing PostgreSQL-only concurrency/storage cases. SQLite schema checks passing establish installation/preservation, **not correct throttle-trigger semantics**; the separately recorded reproduction proves those semantics fail.

Frontend totals: 14 CSRF transport, 13 operation identity, 10 stock quantity, 10 permissions, 5 auth lifecycle assertions. TypeScript/Vite build and focused lint pass. Existing CSS @import-order and large-bundle warnings remain. No dependency versions changed. Full unrelated lint/dependency remediation is not claimed.

## Original release-blocker outcomes

| Requirement | PostgreSQL real API evidence | SQLite real API evidence |
| --- | --- | --- |
| Copied access JWT invalid after logout | PASS, positive before/logout/401 after, API and browser | PASS in original desired test and new positive-control regression |
| Existing access JWT invalid after password change | PASS, original/new API tests and browser | PASS in original desired test and new regression |
| Repeated incorrect logins reliably throttled | PASS: five failures recorded; subsequent request 429; independent-worker threshold and shared account/IP cases pass | FAIL: valid counter writes rejected; login fails closed with 503 rather than usable throttling |

The original 13 role requirements pass on PostgreSQL and SQLite. All original 26 CSRF assertions pass on PostgreSQL after preserving the existing public authentication_required error code. The SQLite full security suite remains failed because login-related CSRF controls cannot complete while its throttle trigger is broken. Do not declare all blockers resolved across the supported verification environments or call this production-ready.

## Schema, preservation and database guards

Fresh installations applied the two approved new migrations successfully on both engines. Upgrade rehearsals began at the accepted 1B.2 schema, with synthetic historical users, roles, group/direct permissions, category/product/recipe/ingredient records, a tracked sale/item, operation UUID, consumption basis/snapshot, stock movement and signed financial posting. Exact logical snapshots before/after upgrade matched. IDs, prices, ownership and ledger values were preserved; no consumption history or session history was fabricated. Epoch initialization was 1; new security tables began empty.

Actual constraints/indexes/FKs and installed PostgreSQL trigger/function definitions are recorded in schema.json. PostgreSQL installed all five expected triggers with the approved timing; SQLite installed all seven names, but its two throttle bodies contain the formatting defect described below. Reapplying the migration graph produced an empty plan. Account security-field updates advanced epochs exactly once, and revoked existing families. Ordinary last_login changes did not invalidate the new login.

Real negative-write cases reject direct epoch no-ops/decreases, terminal session resurrection, immutable device identity and invalid generation/hash changes, malformed scopes/key versions/digests, booleans/nonordered timestamp arrays and other invalid bucket states. Exact database exception classes/messages are retained in schema.json and the regression logs. Raw SQL and QuerySet security-field mutations are exercised independently of model save hooks.

An actual disabled PostgreSQL device trigger caused private/login admission to return 503; reenabling it restored admission. This is a deliberate negative test on a disposable target, not removal of a verification guard. Missing configuration also fails closed. Security cleanup removes only eligible security rows, preserves users/business ledgers, and never cascades into history.

Backups were synthetic: SQLite page backup to another owned file; PostgreSQL pg_dump into an independently named empty restore database inside the same verified disposable container. Restored database name/user/owner and logical contents were checked. Backup contents remained in disposable memory/runtime storage, not evidence/production. Reverse/reapply ran only on unused synthetic targets, retained business rows, and reinstalled guards. **Dropping security tables/epochs is not a safe production rollback.** Restore fencing, signing-era/key rotation, live HA durability and operational PITR remain separate untested production procedures.

## Session, refresh and failure handling

Passing PostgreSQL integration covers 900-second access expiration, 30-minute idle and eight-hour absolute boundaries, post-lock clock sampling, missing/revoked/epoch-mismatched sessions, current-device logout versus other devices, repeated/expired-cookie cleanup, locator-only denial, unknown/malformed/legacy JWT rejection, account deactivation/reactivation and role/technical-flag changes. An automatic PBKDF2 hash upgrade invalidates older epochs and the new login receives the reloaded current epoch.

Refresh rotates exactly one generation/hash under row locks without extending idle/absolute lifetime. Stale reuse commits family revocation before returning denial; a first successor also becomes unusable after the strict duplicate. Real simultaneous browser tabs use the actual app's origin Web Lock and shared HttpOnly cookie jar; both serialized rotations succeed without reuse. Lost refresh-response recovery still deliberately requires password login. No grace period was introduced.

Actual PostgreSQL permission denial simulates unavailable auth persistence: logout returns 503, does not clear proof cookies and does not falsely claim revocation. After restoring permissions the original session remains usable, demonstrating why the pending-logout warning matters. Browser UI feedback is separately verified with a controlled HTTP 503 response. This is **not** a claim of complete network-partition/primary-failover chaos testing.

## Throttling, quotas and operational effects

PostgreSQL tests verify LA 5/300s, LI 20/300s, LR 60/60s and RR 30/60s. The 60th malformed bounded login submission is recorded; the next is 429. Thirty invalid refresh submissions are counted; the next is 429. Unknown users, correct-password attempts after full failure quota, successful login without reset, account/IP overlap and exact rolling-window expiry are covered. Dual-key HMAC rotation checks both versions and does not reset old failure history.

Proxy tests reject unverified ingress and ignore spoofed forwarding headers in direct mode. Missing signing/HMAC keys, malformed state, denied database access, disabled guards and allocation exhaustion never fall back to an unprotected limiter.

The production-size test filled **50,000** synthetic buckets, confirmed new allocation returns 503 without growth, confirmed count-only cleanup leaves them intact, deleted only a bounded 1,000 stale rows, and then resumed protected login admission. These data existed only in a disposable target and were destroyed.

The shared-office tradeoff is real: four unknown accounts with five failures each fill one IP's 20-failure window, temporarily blocking other people at that IP; correct passwords do not bypass it. No production quota changes are recommended without actual office traffic measurements. Retain provisional limits; review NAT size, shift-change LR/RR bursts, IPv6 rotation, attack-driven row-cap exhaustion and cleanup lag before deployment. No scheduler, log sink, secret manager or Redis was provisioned.

## PostgreSQL concurrency and admin contention

All **28** final concurrency cases passed with independent connections; none was skipped or accepted after timeout/deadlock. They include the eight planned session cases, refresh versus queued logout, password change versus refresh, measured admin contention, and prior inventory/RBAC races. Observed wait events are recorded in concurrency.txt. The observer explicitly clears PostgreSQL's statistics snapshot inside long-lived test transactions so later backend connections cannot disappear from stale observation data.

Cases cover five-failure admission across workers, single refresh successor followed by terminal duplicate reuse, a committed role downgrade before a waiting sale/stock request, expiry sampled after lock contention, admitted sale/stock completion before logout, competing last stock and same actor/request UUID across valid device sessions. Original exact inventory/revision/financial assertions remain.

Exclusive admin User locking **does block ordinary same-user API work**. A controlled 0.200-second admin hold delayed the API by **0.266 seconds**, after an observed lock wait, and both completed below the configured two-second lock timeout. This is a bounded functional measurement, not a production throughput/SLO approval. Slow admin exports or heavy password hashing can still cause honest 503s or delay logout. Real deployment load/NAT/long-export testing remains outstanding; no lock policy was weakened.

## Browser verification and reconciliation

Real headless Edge ran React against a newly migrated disposable backend. External network requests were blocked; JWTs/passwords/cookies were not saved in evidence. Successful owner/staff login, HttpOnly cookies, Web Locks, actual simultaneous tabs, CSRF rotation through login/logout, visible permission denial, readonly staff price/date, operational safe fields, password/role revocation and explicit expiry recovery were verified.

The sale test loses a **committed** HTTP response, retries with expired access (401), observes no automatic refresh/business replay, explicitly renews, then manually resubmits the original UUID/body. The server replays the exact successful result. The stock test loses a committed one-quantum adjustment response, deliberately fails refresh, proves no automatic business retry, explicitly logs in, and resubmits with the same UUID, original revision and body. It returns the original success without another movement. [Browser request evidence](phase1b3_verification/evidence/20261110-151057-postgres-browser-a027024d/browser.json).

Exact controlled example:

| State | Flour (kg) | Milk (l) | Sales / operations / movements / financial entries |
| --- | --- | --- | --- |
| Opening | 20.000000000 | 10.000000000 | 0 / 0 / 0 / 0 |
| One sale, recipe 0.01 per three units | 19.996666667 | 9.996666667 | 1 / 1 / 2 / 1 |
| Lost sale response + 401 + explicit replay | 19.996666667 | 9.996666667 | 1 / 1 / 2 / 1 |
| One +0.000000001 kg stock adjustment | 19.996666668 | 9.996666667 | 1 / 2 / 3 / 1 |
| Failed refresh + login + same revision/UUID replay | 19.996666668 | 9.996666667 | 1 / 2 / 3 / 1 |

Signed gross posting remains PHP 50.00; stock adjustment adds no financial posting. Existing full business tests cover sale edits/cancellation/date reporting and exact reversals. Session tests do not reinterpret cancellation as a cash refund.

Usability observations: strict reuse may require sign-in after a lost committed refresh; unsupported Web Locks cannot renew; failed logout visibly says it is not confirmed and to retry before leaving; role/password changes require fresh login; no background keep-alive was added. The existing owner stock table rounds its display to four decimals whereas the staff table shows nine; the database/modal retain exact values. No redesign was performed. Foreground, animation-complete screenshots were visually inspected: [pending logout](phase1b3_verification/evidence/20261110-151057-postgres-browser-a027024d/02-pending-logout.png), [safe staff stock](phase1b3_verification/evidence/20261110-151057-postgres-browser-a027024d/03-staff.png).

## Defects, corrections and preserved initial evidence

1. **V1 fixture adapter**: attempted to patch a nonexistent APIClient symbol in the inherited 1A.1 compatibility module. Corrected only the fixture target; all 120 PostgreSQL business checks subsequently pass. Initial pre-test crashes remain recorded.
2. **V3 public 401 contract**: preserved authentication_required, adding precise session reason separately, so the unchanged CSRF error assertion passes. No status/authorization/business assertion was relaxed. This and fixture/observer corrections are committed at **c94d20f**.
3. **Observer/selector assumptions**: fixed stale pg_stat_activity observation; used the actual Record Sale label; tested the existing Access restricted screen instead of assuming a redirect. Browser failures and their unexecuted remainder remain preserved; final 33-check run passes. Historical 1B.2 test source was not rewritten; the explicit versioned fixture diff documents V2 credentials, protected-unused-user cleanup, actual middleware and the 26th refresh route.
4. **V2 SQLite DDL defect — OPEN**: schema_editor.execute(sql) with its default empty parameter tuple changes literal strftime('%s', ...) into strftime('?', ...). Actual stored-trigger SQL and direct debit regression prove this. Valid timestamp events are rejected with `IntegrityError: invalid throttle events`; HTTP authentication correctly fails closed with 503. This is not healthy throttling and is not counted as a pass.

The prepared correction is exactly:

```diff
- for sql in SQLITE_TRIGGERS.values(): schema_editor.execute(sql)
+ for sql in SQLITE_TRIGGERS.values(): schema_editor.execute(sql, params=None)
```

It changes no field, quota, revocation or business rule, but **changes migration 0003's hash**. Your mandatory pre-execution requirement says hashes must match the static checkpoint; therefore it has not been edited/applied under an inferred exception. [Exact proposed patch](phase1b3_verification/PROPOSED_SQLITE_MIGRATION_FIX.diff), [full proposed hash](phase1b3_verification/proposed-migration-hash.json): `3b8156d1eee07b1e73affde5898d47888b237e579913c785e99a6652eabe9e2c`. A pending owner question requests explicit authorization for that corrected hash and new disposable targets. No already-migrated target will be patched in place, and no hash/ownership guard will be removed.

SQLite after-correction security/operational/RBAC/browser results are **UNTESTED**. No passing PostgreSQL or schema-installation result substitutes for that work.

## Cleanup, remaining risks and next step

Each database run retains cleanup.json proving removal of its own UUID runtime directory and, for PostgreSQL, its own identity-labelled container. The package summary verifies **23 database cleanup records** and zero remaining owned runtime directories. A final Docker label-filtered query returned no verification containers; frontend/backend ports are checked separately. Browser results record stopped frontend/backend processes. Backup copies were destroyed with their targets. No unrelated container, user database or production resource was removed. Docker Desktop itself is an existing local service and was not globally stopped. See [machine-readable verification summary](phase1b3_verification/verification-summary.json).

Remaining release/operations gates: the SQLite correction/reverification; actual production TLS/Origin/proxy trust and runtime DB privileges; signing/HMAC rotation and secret ownership; retention/monitoring schedules; fenced restore/HA guarantees; real office/load/long-export budgets; unsupported dependency findings; and separately authorized deployment checks. The metadata/exception tests do not prove protection against a privileged database owner replacing trigger bodies. Production remains unauthorized and the application is not represented as secure/production-ready.

**Next step: owner approval of the exact corrected 0003 hash, then fresh SQLite migration/security/operational/RBAC verification and a confirming fresh PostgreSQL schema check.** Retain original failing evidence and report the before/after outcomes. After that, return for owner review before any next package. Do not start demo data, dependency upgrades, redesign, SEO or production work.

**STOPPED at the revised-migration review boundary; current package has an explicit unresolved SQLite failure.**
