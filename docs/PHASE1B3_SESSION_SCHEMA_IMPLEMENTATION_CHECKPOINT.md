# Phase 1B.3 — STATIC implementation and schema checkpoint

Baseline `f4ee98d`; accepted RBAC `8d8fe47`. Branch `codex/phase-1b3-static-implementation`.

**New migrations MUST NOT be executed, including by tests.** This checkpoint implements supporting code and generates additive migrations for review only. The three release blockers remain open until separately authorized integrated verification passes. No production access, deployment, Redis, dependency upgrade or business-history repair is authorized.

## D7–D16 reconciliation before implementation

| Decision | Original proposal | Selected implementation policy | Unresolved tradeoff / effect |
| --- | --- | --- | --- |
| D7 | DeviceSession, AuthThrottleBucket, User epoch, database guards | Retain two security models and one epoch field; trigger-controlled epoch; no ledger FK/schema changes | Generated exact schema/SQL needs approval. Schema/security |
| D8 | Revoke all on encoded-password/role/status/technical-flag changes, including hash upgrades | All persisted encoded-hash changes conservatively revoke; login detects/logs automatic hash upgrade separately and reloads epoch before minting. No bypass flag. Direct epoch writes prohibited, including +1 | Hash upgrades can sign out other devices. Security/usability/schema |
| D9 | Successful-business activity only, per-session serialization, bounded transactions | UTC DB time after locks; no idle renewal by auth polling/refresh/bootstrap or denial; User→session→business lock order; per-session serialization | Export/parallel-request contention requires PostgreSQL load tests. Security/usability |
| D10 | Strict refresh reuse, no grace, cross-tab mutex | One successor generation; any signed stale refresh revokes family; Web Locks plus in-tab single flight; no automatic retry of refresh or unsafe business writes | Lost responses/unsupported multi-tab coordination can require login. Security/usability |
| D11 | Signed non-auth locator, same-origin cookies, revocation-confirmed logout | Locator only identifies logout; access/refresh required independently for grants. No cookie clearing/success claim on failed revocation; proof retained for retry | HTTPS/proxy topology remains unverified; outage may leave terminal signed in. Security/usability |
| D12 | PostgreSQL counters, LA5/5m, LI20/5m, LR60/min, RR30/min | Same configurable defaults; exact bounded windows under locks. Schema ceiling 1000 events/bucket permits reviewed configuration within bounds; global allocation cap 50,000 rows, fail closed at cap | NAT/account targeting can deny legitimate attempts. Hard caps/retention are availability gates. Schema/security/infrastructure |
| D13 | Throttle-only NFKC/casefold; verified IP; no proxy fail-open | Preserve authentication semantics; HMAC bucket identities; direct mode ignores headers, proxy mode validates configured peer/chain; no unprotected fallback | Actual deployment trust must be proven; no inferred provider CIDRs. Security/infrastructure |
| D14 | Session absolute+30d, bucket24h, events90d; scheduler/keys | Retention parameters and cleanup command only; no scheduler/service provisioned; no raw credential/identifier logging | Log sink, secret ownership and operational scheduling need review. Infrastructure/privacy |
| D15 | Strict legacy cutover, forced re-login, admin epoch/deadline guard, compatible rollback | V2-only JWT binding, separate configured key/issuer/audience; current admin sessions also epoch/deadline checked; no legacy-token upgrade | Live downgrade now needs reauthentication before readonly staff view; original RBAC denial statuses retained. Security/usability/schema |
| D16 | Implementation + generation/static inspection, then another authorization before application | This checkpoint only. No migrate, DB-backed tests, SQL execution, production or infrastructure actions | Await explicit disposable PostgreSQL/SQLite application authorization. Schema/security/infrastructure |

The conditional approval overrides the design's earlier operator “increment epoch” option: direct writes to the epoch are rejected. Bulk revocation must revoke session records; security-sensitive account writes alone advance the epoch. No historical user IDs or operation ownership change.

## Exact schema implemented, not installed

The machine-readable field/constraint/index inventory is [schema-manifest.json](phase1b3_static/evidence/schema-manifest.json). Rendered SQL files are review artifacts, **not executed SQL**: [PostgreSQL](phase1b3_static/evidence/postgresql-guards.sql), [SQLite](phase1b3_static/evidence/sqlite-guards.sql). They are rendered directly from the migration constants without invoking a database, migration executor or `sqlmigrate`.

### User: existing `accounts_user`

One new column: `session_epoch`, Django PositiveBigIntegerField / PostgreSQL bigint, NOT NULL, Python default **1**, persistent DB default **1**, noneditable. `acct_session_epoch_pos` checks 1..9223372036854775807. Existing IDs, passwords, roles and ownership are preserved. No new index: lookups use the existing user PK. No other User fields or relationships change.

Only the protected-field trigger advances the epoch. A new account must start at 1. All direct epoch UPDATE statements, including unchanged values, +1 and decreases, are rejected on PostgreSQL; overflow aborts the protected account change. User.save omits the epoch from ordinary full saves and rejects explicit update_fields containing it. After a change, callers needing the new epoch must reload it.

### DeviceSession: new `accounts_devicesession`

| Field | Exact definition/default |
| --- | --- |
| id | UUID PK, Python uuid4, noneditable; no DB UUID-generation dependency |
| user | NOT NULL FK → existing User PK, PROTECT, related_name=device_sessions, db_index=False; covered by composite index below |
| user_epoch | PositiveBigInteger, NOT NULL, noneditable, supplied from locked current User; no default |
| created_at | UTC-aware timestamp, NOT NULL, noneditable; supplied from DB clock |
| last_activity_at | UTC-aware timestamp, NOT NULL; initially created_at |
| absolute_expires_at | UTC-aware timestamp, NOT NULL, noneditable; exactly created_at + 8h |
| refresh_generation | PositiveBigInteger, NOT NULL, Python default 0; no persistent DB default |
| refresh_jti_hash | varchar(64), NOT NULL; lowercase SHA-256 of random refresh jti; no default, no raw token |
| revoked_at | nullable UTC timestamp, default NULL |
| revocation_reason | varchar(24), NOT NULL, Python default empty string, blank allowed; enumerated choices below |

Reasons: logout, credentials_changed, role_changed, status_changed, refresh_reuse, idle_expired, absolute_expired, security_cutover, operator_revoked. Authentication rejects expired rows without relying on a cleanup job to mark them expired.

Named checks:

- `ds_epoch_pos`: epoch 1..9223372036854775807.
- `ds_gen_nonneg`: generation 0..9223372036854775807.
- `ds_time_bounds`: created_at ≤ last_activity_at < absolute_expires_at.
- `ds_abs_8h`: absolute_expires_at = created_at + 8h.
- `ds_jti_hex`: entire string matches `\A[0-9a-f]{64}\Z`, including on SQLite; no trailing-newline acceptance.
- `ds_revocation_pair`: either NULL revoked_at and empty reason, or non-NULL revoked_at and a listed reason.
- `ds_revoked_after_start`: revoked_at NULL or ≥ created_at.

Indexes: UUID PK uniqueness; `ds_user_created` (user_id, created_at DESC); `ds_abs_expiry` (absolute_expires_at); partial `ds_active_idle` (last_activity_at) WHERE revoked_at IS NULL. There is no refresh-hash index or uniqueness requirement: requests identify the family by UUID and bind its user/epoch/generation/hash. Random JTIs do not authorize a different UUID family.

There is **no FK to or from the five business ledger models**. Security cleanup deletes only DeviceSession rows, never users or business history. PROTECT prevents ORM deletion of a user with retained sessions; the database FK also protects referential integrity. This is an intentional stronger deletion boundary requiring an updated deletion fixture during future verification.

### AuthThrottleBucket: new `accounts_auththrottlebucket`

| Field | Exact definition/default |
| --- | --- |
| id | BigAutoField PK / existing Django backend identity behavior |
| scope | varchar(2), NOT NULL, choices LA/LI/LR/RR, no default |
| key_version | PositiveSmallInteger, NOT NULL, no default |
| subject_digest | varchar(64), NOT NULL; HMAC-SHA256, no raw username/IP |
| event_times | JSONField / PostgreSQL jsonb, NOT NULL, Python callable list default; no persistent DB default |
| updated_at | UTC timestamp, NOT NULL, supplied from authoritative DB time |

Checks: `at_scope_valid` (LA/LI/LR/RR); `at_keyver_pos` (1..32767); `at_digest_hex` (entire 64 lowercase hex characters); `at_events_shape` (JSON array, length ≤1000). `at_scope_key_unique` is a database UNIQUE constraint on (scope, key_version, subject_digest), with its supporting unique index. `at_cleanup_time` indexes updated_at. No FK: nonexistent accounts are throttled identically and account deletion cannot reset a counter through cascading.

`BucketEventsShape` compiles a vendor-specific CASE expression; JSON element type, chronological ordering, future timestamps and nondecreasing updated_at are additionally checked by triggers and application code. Event values are exact integer UTC microseconds, not floating-point timestamps.

### Trigger enforcement

PostgreSQL migration installs **five invoker functions and five triggers**, requiring reviewed `public` tables. Function search_path is pinned to public, pg_temp; no SECURITY DEFINER and no new extension/service/role. Production must deny untrusted CREATE in public and DDL/trigger-disable privileges to the runtime principal. DDL permissions are not provisioned here.

| Trigger / table / timing | Enforcement |
| --- | --- |
| accounts_security_epoch_direct / User / BEFORE UPDATE OF session_epoch, statement | Reject every direct epoch UPDATE, even a no-op or zero matching rows |
| accounts_security_epoch_guard / User / BEFORE INSERT OR UPDATE, row | INSERT starts at 1; changed encoded password, role, active, staff or superuser fields advance once; bigint exhaustion aborts |
| accounts_security_epoch_revoke / User / AFTER UPDATE, row | Same transaction revokes every unrevoked family for that user; credentials → role → status reason priority; terminal older revocations retained |
| accounts_device_guard / DeviceSession / BEFORE INSERT OR UPDATE, row | INSERT captures an eligible locked user/epoch, generation 0, active state, nonfuture creation; immutable identity/user/epoch/start/absolute; terminal revocation; monotonic activity; same generation requires same hash, successor exactly +1 requires changed hash; revocation preserves applied activity/generation/hash |
| accounts_throttle_guard / AuthThrottleBucket / BEFORE INSERT OR UPDATE, row | Immutable bucket identity; updated_at cannot decrease; bounded array of nonnegative integer microseconds, sorted and no later than updated_at |

SQLite has **seven** equivalent vendor triggers: accounts_security_epoch_insert, accounts_security_epoch_guard, accounts_security_epoch_bump, accounts_device_insert, accounts_device_update, accounts_throttle_insert, accounts_throttle_update. SQLite cannot assign NEW fields in the same manner as PostgreSQL: its named AFTER trigger revokes families and advances the epoch. The Django connection authorizer permits epoch-column writes **only when originating in that named trigger**. A guarded-connection UDF is required for account updates; an ordinary external SQLite connection lacks it and fails closed. Database-file owners or Python code capable of replacing the authorizer remain trusted. SQLite is a local sequential verification backend, not a substitute for PostgreSQL concurrency evidence.

Each auth/private transaction checks enabled guard names/table associations, without a positive cache. Missing/disabled guards or an unsupported vendor produce 503 rather than admitting a partial installation. This does not defend against a privileged database owner replacing function bodies or disabling SQLite connection protections. No guard query was executed at this checkpoint.

## Ordered migrations and static inspection

1. `accounts/0002_auththrottlebucket_devicesession_user_session_epoch_and_more.py`, generated by installed Django 5.1.4. Dependencies: accounts/0001_initial and auth/0012_alter_user_first_name_max_length. Twenty-one additive operations, in order:

| # | Operation |
| --- | --- |
| 1–2 | Create AuthThrottleBucket, then DeviceSession scalar fields |
| 3–4 | Add User.session_epoch, then acct_session_epoch_pos |
| 5 | Add at_cleanup_time index |
| 6–10 | Add at_scope_valid, at_keyver_pos, at_digest_hex, at_events_shape, at_scope_key_unique |
| 11 | Add DeviceSession.user protected FK |
| 12–14 | Add ds_user_created, ds_abs_expiry, ds_active_idle indexes |
| 15–21 | Add ds_epoch_pos, ds_gen_nonneg, ds_time_bounds, ds_abs_8h, ds_jti_hex, ds_revocation_pair, ds_revoked_after_start |

2. `accounts/0003_session_security_guards.py`, dependent only on accounts/0002 above. One atomic RunPython operation selects the vendor and installs the exact guard strings listed above. PostgreSQL installs functions in dictionary order, then triggers in table order; SQLite installs its seven triggers in dictionary order. Reverse drops triggers in reverse order, then PostgreSQL functions in reverse order. No migration-time session minting, token conversion, business data repair or epoch manipulation is performed by this operation.

No old migration was edited. The generated 0002 was refined before any application to use exact whole-string hex anchors. Migration state and current models agree (`makemigrations --check --dry-run`: no changes). MigrationLoader(None) resolves the accounts leaf to 0003 without a database. The manifest records file hashes and ordered operations. **Neither schema checks nor stored trigger bodies have been executed on a database server.** Python syntax checks do not establish PostgreSQL/SQLite SQL correctness.

## JWT, request, refresh and logout flow

Login validates bounded input and CSRF/Origin before credential persistence, charges the LR budget, and enters shared LI/LA quotas. It locks all resolved account/proven-cookie users in sorted order with FOR UPDATE before hashing. A username resolving to a different, unlocked account after a concurrent rename fails closed. Successful authentication reloads the trigger-updated epoch, revokes identified old browser families, creates one DeviceSession and mints its tokens in the same credential transaction. Failure to create/sign/commit returns an error and no tokens. Wrong credentials, unknown accounts, inactive/unknown roles and admin-ineligible logins receive a generic failure and consume both failure quotas.

V2 JWTs use the installed PyJWT codec with a separate explicitly configured HS256 key (≥32 characters), exact issuer `rowszein-auth:{environment}:v2`, strict single-string audience `rowszein-api:{environment}`, algorithm allowlist and version `sv=2`. Claims: sid, se, user_id, iat, exp, jti, token_type; refresh also carries integer rg. JWT inputs are bounded to 4096 characters and locators to 512. CookieJWTAuthentication retains its SimpleJWT authentication interface/settings, but no longer accepts its unbound legacy token shape. There is no raw bearer storage or SimpleJWT refresh endpoint fallback.

Access expiry = floor(min(DB admission time + 15m, absolute expiry)) in UTC seconds; refresh expiry = floor(absolute expiry). Integer seconds can shorten effective validity by less than a second; they never extend the session. All server grants compare JWT times and session timestamps to DB time after locks, including future iat and captured start/absolute bounds. No application-wall-clock iat check overrides DB authority. A subsecond remaining lifetime unable to produce a valid integer-second token is rejected.

Private API request: outer atomic transaction → current User FOR SHARE → DeviceSession FOR UPDATE → current epoch/revocation/idle/absolute/JWT checks → existing RBAC/queryset/field/object validation → original business locks and writes → render response → record qualifying activity → commit. Forbidden capabilities fail before any grant or business response; original owner-only 403 denials remain. A capability allowed after a role change still needs a new session; the old epoch receives 401. Denials and rendered API errors roll back business writes. Session validity is checked again before an idempotent stored business response is disclosed.

Only a successful business GET/write (2xx or 304) renews activity to its **admission** time. Auth me, CSRF bootstrap, refresh, anonymous requests, HEAD/OPTIONS/TRACE and failures do not. No keep-alive traffic is added. A request admitted before expiry must finish before absolute expiry; access expiry is checked at admission, with a bounded transaction duration. Long/streaming private responses fail closed.

Refresh requires CSRF/Origin, RR admission, a signed refresh JWT, live User/DeviceSession, correct epoch and current generation/hash. User/share then session/update locks serialize workers. One transaction increments generation exactly once, changes the hash and signs one successor pair without touching idle or absolute. A stale generation/hash marks the family refresh_reuse and **commits the revocation before returning 401**. Two old-token refreshes can yield one 200 then a terminal 401; the first successor is then revoked too. Lost committed responses require password login. The locator never authorizes refresh; a conflicting signed locator stops renewal.

Frontend login/logout/explicit renewal share an origin-wide Web Lock; renewal is also single-flight inside a tab. Cookies are read by the browser when the locked request dispatches. Browsers lacking Web Locks may login/logout, but renewal fails closed with a sign-in instruction. No JWT enters JS/storage and no refresh or uncertain business write is automatically retried. The existing narrowly identified pre-auth CSRF retry preserves original UUID/body/revision. Simulated multi-tab mutex tests are not real-browser evidence.

Logout independently enforces CSRF without relying on an unexpired access grant. Signed V2 access/refresh claims (including expired JWTs) or a signed eight-hour locator identify cleanup targets only. It locks identified users in sorted order, then sessions, marks only those families revoked and flushes the current Django session in the same transaction. Commit precedes cookie clearing. Repeated logout is safe; no identifiable proof returns server_session_identified=false, not a copied-token invalidation claim. Persistence failure returns 503 and retains proof cookies for explicit retry. UI feedback says logout is not confirmed; hiding a view is never reported as server revocation.

## Account changes and Django admin

Changed password **encoding**, role, is_active, is_staff or is_superuser advances the epoch once and revokes old families within the account write transaction, including QuerySet.update and ordinary SQL. Reversing a role/status/password change cannot restore an old epoch. last_login/email/name changes alone do not advance it. Direct epoch manipulation is prohibited, including the former operator +1 proposal.

Genuine set_password saves are logged as explicit changes without password values. During login, a changed encoding after authenticate is classified as an automatic hash upgrade; it follows the same conservative revocation policy. The new epoch is re-read before issuing a session. Password verification never preserves an old captured epoch. Application log classification does not substitute for database enforcement and cannot classify arbitrary raw-SQL encoding writes as a plaintext password change versus rehash.

Admin still requires active role=admin **and** Django staff/model permissions. Technical superuser flags do not grant a business role. Existing django_session payload receives _business_auth_epoch, _business_started_at, _business_last_activity_at, _business_absolute_at (exact integer UTC microseconds). Every private admin callback verifies current user, locked session row, auth hash, epoch and deadlines. Missing legacy metadata requires login. Activity excludes admin static/JS and safe probe methods. Cookies are bounded to remaining idle/absolute time and saved under the lock; SessionMiddleware does not perform a later unlocked resave.

Admin credential forms share LA/LI/LR with API login. Self password change validates the old password inside the quota/user/session lock order, distinguishes an incorrect old password from new-password validation failure, and flushes the current session after save. It deliberately omits Django's usual update_session_auth_hash keep-current-session behavior. No new public password/user-management API is introduced. API/admin logout both clean cookie-proven API families plus only the browser's Django session. Existing read-only business-history admin registrations are unchanged.

**Conservative implementation deviation:** admin callbacks take an exclusive User lock even for reads, avoiding implicit shared-to-exclusive upgrades in admin callbacks/signals. This can block concurrent owner API traffic; PostgreSQL load tests must determine whether a more explicit read/write classifier is needed before release. This is not a concurrency-performance claim.

## Throttle implementation and availability

| Scope | Default quota | Window / debit |
| --- | --- | --- |
| LA | 5 | Failed credentials per NFKC(trim(username)).casefold(), 300s |
| LI | 20 | Failed credentials per verified canonical client IP, 300s |
| LR | 60 | Login/current-password submissions per verified IP, 60s; includes malformed bounded payloads after CSRF succeeds |
| RR | 30 | Refresh submissions per verified IP, 60s |

AUTH_RATE_LIMITS permits integer counts 1..1000 per scope; windows stay fixed. Normalizing identifiers affects throttling only, never account lookup/IDs. HMAC purpose includes scope; no raw identity is retained. AUTH_RATE_KEYS holds one or two explicit numeric versions, each with a ≥32-character secret. During reviewed dual-key rotation both buckets are checked/debited; no worker may silently use a different key ring. Removing the old version before all workers/windows overlap can reset protection and is prohibited operationally.

Bucket allocation is a separate short transaction, protected by PostgreSQL advisory transaction lock (182731,31), before counter/user/session locks. The application globally caps rows at configurable AUTH_MAX_BUCKET_ROWS (1..50000, default 50000). A full cap refuses new allocations with 503; existing buckets can continue subject to limits. This bounds random-identifier growth through the application; a privileged direct SQL writer is outside that allocator boundary. No background infrastructure was provisioned.

LR/RR atomically debit exact timestamp arrays. Login first checks LI before allocating LA; the final transaction rechecks LI/LA and holds both locks **across password hashing and the outcome**. LI locks precede LA; key versions/digests are deterministic. Events in (now-window, now] remain; exact-boundary events expire. Failure appends one event to each bucket; success does not reset failure history. Full quotas reject even correct passwords, with generic 429 and ceil Retry-After. Unknown names follow the same rule and dummy hashing. Blocked attempts do not extend the window. Corrupt arrays, clock regression, timeouts, missing keys/guards or infrastructure failure produce 503, with no unprotected fallback.

Direct mode uses REMOTE_ADDR and ignores XFF; production defaults unconfigured, requiring a verified selection. Proxy mode requires a trusted immediate peer and configured CIDRs, validates a bounded chain, strips only trusted rightmost hops and uses the first untrusted hop. No provider's headers/CIDRs are guessed. End-to-end HTTPS/proxy proof remains outstanding.

**NAT consequences:** one five-failure account can be targeted across IPs; twenty failures across four accounts can temporarily block a whole office IP. Successful office logins do not reset that IP's failures. IPv6 address rotation is not a subnet quota. LR=60/min can affect shift-change sign-in bursts; RR=30/min can affect offices with many tabs. A distributed attack can fill 50000 rows and deny new subjects until retention cleanup. These are explicit availability tradeoffs, not reasons to bypass limits. Production quotas, monitoring and allocation-cap sizing need owner review after measured tests.

## Lock ordering, cleanup and monitoring

Allocation advisory lock (separate transaction) → LR/RR bucket(s), or LI→LA ordered buckets → sorted User IDs → ordered DeviceSession/Django-session rows → unchanged sale/product/recipe/ingredient/basis locks. API grants use User FOR SHARE; login/logout/account mutations use exclusive User locks. Account-change triggers therefore wait for admitted business work to commit, or complete first so the waiting request sees the new epoch. Per-session exclusivity serializes requests across workers. Different device sessions for the same actor still converge on the existing actor/request-UUID uniqueness, not a new idempotency namespace.

Resource bounds: 2s row-lock timeout, 3s individual SQL timeout, 10s idle-in-transaction timeout and elapsed Python deadline checks for private/credential callbacks before commit. These are rollback checks, not preemptive termination of Python hashing/export work; total request/CPU ceilings and throughput still require load validation. Refresh/logout use bounded SQL transactions; hard wall-clock request limits must be measured at the approved serving stack. No retry can downgrade enforcement.

cleanup_auth_security is an operator-invoked command, default count-only; --execute deletes at most a bounded batch of DeviceSession rows older than absolute+30d and buckets older than 24h. It follows User→session locks and PostgreSQL skip_locked, with no business cascade. It does not run automatically; no command was executed. Existing clearsessions and 90-day security-log retention/scheduler/sink need separate operational setup. Expiry remains enforced if cleanup is stopped.

Code emits bounded security outcomes for credential failure, device login, explicit/automatic password events, quota denial, committed browser revocation and refresh reuse, without raw credentials/tokens/cookies/CSRF/username/IP. Device rows retain epoch and revocation reason/time. Arbitrary SQL account-change audit classification, centralized collection, retention enforcement, clock/guard/replication monitoring and alerts are not yet operationally proven or provisioned. Restrict ordinary access/request logs and APM to prevent header/body capture.

## Preservation, cutover, backup and rollback

No historical sale, stock balance, consumption snapshot, financial posting, price, recipe, operation UUID/revision, account ID or ledger owner is rewritten. Only security metadata is added. The sole business-service edit revalidates the current session before normal/recovered idempotent response handling; original authorization, math and transaction assertions remain. No current recipe is used to invent history.

Cutover proposal (NOT executed): fence private/login traffic; verify encrypted backup/restore and separate secret manifest; apply both additive migrations during reviewed maintenance; inspect every enabled trigger/constraint/index and runtime privileges; configure new environment-specific signing/HMAC keys and trusted ingress; deploy compatible code; require all legacy API/admin sessions to sign in again. There is no legacy-token-to-session conversion. Missing config/schema fails closed. Public storefront DTOs/RBAC/CSRF rules remain unchanged; the implementation branch must not be run against an unmigrated environment.

PostgreSQL ADD COLUMN constant default initializes existing users' security metadata to 1 without changing identity/business data; the check/FK/index creation and trigger installation can still lock/scan tables. Measure version-specific lock duration in a restored isolated copy. SQLite may rebuild the User table while adding its check: verify IDs, FKs, groups/permissions and all ownership counts after application before trusting compatibility. No actual database was inspected or backed up here.

Preferred rollback is compatible code correction while retaining new tables, epochs, counters and enabled guards. Never reopen an old unbound-JWT application as a live downgrade. Migration reverse functions exist for reviewed **offline disposable** rollback rehearsal; reversing 0002 would remove security metadata and is not an authorized production recovery strategy. Backup contains credential-sensitive password hashes/Django session keys even though the new DeviceSession stores no raw bearer.

After restore/failover that may have lost revocations/rotations, fence traffic, rotate the V2 signing/locator secrets, revoke restored families, invalidate Django sessions and wait the longest failure window if counter history was lost. Do **not** use the original design's superseded direct epoch increment. An arbitrary point-in-time restore cannot prove global monotonicity against later lost state; a fresh signing era prevents old JWT reuse. Recovery/fencing and HA durability must be demonstrated separately before release. No backup, restore, key rotation or production operation was performed.

## Verification actually executed

Modified-file inventory: [changed-files.txt](phase1b3_static/evidence/changed-files.txt). Changes are limited to accounts/session security modules, the two additive accounts migrations, one pre-replay session check in the existing ledger service, focused frontend auth handling, static/gated test tooling and project documentation. The [verification summary](phase1b3_static/evidence/checkpoint-verification.json) also checks protected historical source/evidence and the unchanged CSRF enforcement function.

| Check | Actual result / limitation |
| --- | --- |
| Static backend/unit runner | **76 passed**, 0 failures/errors/skips; **0 connection/cursor attempts**; dummy backend; application/new-test Python AST checks |
| Included Phase 1A checks | 46 existing database-free allocation/financial/schema/storage tests passed within the 76; not the 120 real-DB business suite |
| CSRF checks | 2 existing transport/configuration backend units passed within the 76; 24 API regressions deferred |
| Original security/role contracts | Source-function identity verified for original 13 security, 13 role and 24 API CSRF test methods; this is assertion preservation, **not test execution** |
| Django system check | No issues, using dummy backend |
| Migration generation/drift/graph | 0002 generated; 0003 guard migration authored; no changes detected; accounts leaf/dependencies/additive operations inspected without DB |
| Frontend build | Passed TypeScript/Vite; existing CSS @import-order and chunk-size warnings remain |
| Frontend checks | **42 passed**: 14 existing CSRF transport + 13 operation identity + 10 RBAC + 5 new lifecycle/refresh checks |
| Focused frontend lint | Passed for the four modified frontend files; full pre-existing lint debt is outside this package |
| PostgreSQL/SQLite migrated API/concurrency/admin/browser | **NOT RUN — not authorized**; no claim of release readiness |

Evidence: [static-tests.json](phase1b3_static/evidence/static-tests.json), [test log](phase1b3_static/evidence/static-tests.txt), [schema manifest](phase1b3_static/evidence/schema-manifest.json). Static tools monkeypatch BaseDatabaseWrapper.connect/cursor to raise before any access and use the dummy backend; they never invoke Django's test runner. No migration executor, database schema editor, SQL server parser or disposable container was used.

New written tests include copied-token logout/password denial with working-before controls; current-device and repeated logout; locator-only rejection and expired-cookie recovery; outage cookie retention; ORM/raw-SQL account changes; direct-epoch denial; automatic-hash upgrade/current-epoch login; strict refresh reuse; no auth-poll idle renewal; controlled time boundaries and lock sampling; private replay denial; same-actor fresh-session exact replay without repricing; stock/financial reconciliation; CSRF/Origin/legacy-cookie zero business writes; exception rollback; missing-guard denial; row caps/NAT/spoofed headers; shared API/admin quotas; admin password re-login. PostgreSQL races cover failed-logins, duplicate refreshes, same actor UUID across devices, committed role change versus a waiting sale, expiry after a lock wait and admitted sale versus logout. These tests have only been syntax-parsed, not run.

The business_compatibility context manager changes old business **fixtures** to real V2 cookies while preserving force_authenticate call sites and every stock/financial assertion; it does not install an auth bypass or alter production behavior. security_compatibility versions original 13+13+26 requirements with real V2 fixtures/TransactionTestCase and unchanged test methods. The original files/evidence remain intact. Further 1B.2 fixture updates are needed for the newly protected user-deletion case, its 25→26 route inventory and role-change read/replay tests now requiring fresh authentication. These differences must be explicit in the future report; do not suppress historical failures or convert them into production exemptions.

## Proposed disposable verification — requires new explicit authorization

1. Reuse the ownership-verified Phase 1A.3 disposable harness after review: generated DB/container identity, verified labels/loopback endpoint, random credentials, no ambient DATABASE_URL, isolated SQLite file and PostgreSQL database. Add test-only V2/HMAC/ingress settings and a uniquely named 1B.3 evidence directory. Confirm the exact approved migration hashes before allowing any runner to create a schema.
2. Back up a synthetic pre-0002 database containing representative users, permissions and verified Phase 1A ledger fixtures; record row/ID/ownership/balance/posting hashes. Apply 0002 then 0003 explicitly, inspect enabled triggers/functions/constraints/indexes/defaults/FKs, and assert preservation. Also test failure inside each migration and reverse/reapply **only offline in the disposable copy**. Deny login/private requests with 0002 alone or a disabled guard.
3. Run written SessionAPIContracts, versioned original security 13, role 13 and all 26 CSRF tests; all 120 Phase 1A tests under the real-cookie fixture adapter; retain original stock, legacy, idempotency and signed-finance assertions. Update only reviewed fixture/API-inventory changes for the 1B.2 suite, retaining all earlier authorization assertions.
4. Run all eight independent-connection PostgreSQL races (including both sale and stock), existing business/RBAC races, then repeat under real password hashing and measured office/NAT workloads. Add refresh/logout/password races in both commit orders, user deletion protection, epoch-max boundary injection on a deliberately privileged **disposable** fixture, terminal-device mutation, trigger disablement, corrupt buckets, dual-key rotation, retention cleanup versus requests, cookie-loss/reordering and injected commit failures. No production guard disablement is proposed.
5. Exercise controlled UTC boundaries to the microsecond after observed lock waits, absolute lifetime during response generation, backwards clock behavior, stale cached sessions and no activity renewal by me/bootstrap/refresh/HEAD/OPTIONS/static assets or denials. Verify successful activity renews once, streaming is rejected, and ordinary concurrent endpoints cause no stock/financial drift.
6. Repeat sequential API/constraint/compatibility tests on isolated SQLite with the authorizer active; report PostgreSQL-specific concurrency skips explicitly. Compare exact stock and signed financial reconciliation before/after every denied/auth-failed attempt. No SQLite pass substitutes for PostgreSQL locking proof.
7. Only then run a loopback browser against the migrated disposable DB: owner/staff routes, CSRF recovery, access expiry → explicit renewal, true simultaneous tabs/Web Locks, no API heartbeat, session expiry, confirmed/pending logout, password/role/deactivation re-login and unchanged pending sale UUID/revision. Never point the browser at the existing remote production rewrite.
8. Record actual totals, failures, skips, SQL/lock evidence, no-secret logs and disposal evidence. Keep the three blockers OPEN until these API tests pass; obtain a separate review before further packages or any deployment.

## Remaining owner checkpoint / risks

- Approve/amend the exact two-model/epoch schema and two migrations, including trigger-controlled direct-write prohibition and SQLite authorizer dependency, **before any application**.
- Confirm the bounded configurable quota/event/row-cap behavior and stricter admin User serialization; provisional office/NAT and timeout settings need measured acceptance.
- Confirm strict refresh lost-response consequences and the explicit renewal/Web Locks fallback; browser verification is pending.
- Review trusted ingress topology, production secret ownership/rotation, runtime database privileges, retention scheduler/log sink and fenced restore/rollback procedure separately. None is inferred or provisioned.
- PostgreSQL/SQLite SQL correctness, migrated compatibility, old-fixture changes, admin forms, commit failures and concurrency remain unproven. No SQL parse/body-install claim is made from Python/static tests. Full historical RBAC/CSRF/business suites and browsers have not been re-run on this implementation.
- Code/config is intentionally staged on an isolated branch; do not run it on the accepted 1B.2 database before migration approval. No production data, dependency versions, historical evidence or ledger architecture changed.

**Release blockers remain OPEN:** copied access token after logout; existing access/session after password change; reliable repeated-login throttling. There is no production-ready or security-complete claim.

**STOP: await explicit authorization for applying these reviewed migrations in disposable PostgreSQL/SQLite and executing the gated tests. Production remains unauthorized.**

## Reference guidance

The session expiry/revocation and login-defense choices follow [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Strict rotation applies the replay-detection principle in [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2); this application is not being represented as an OAuth authorization server. Trigger timing and whole-string constraints were checked against [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html) and [PostgreSQL regex constraint escapes](https://www.postgresql.org/docs/17/functions-matching.html#POSIX-CONSTRAINT-ESCAPES-TABLE). Runtime/version-specific verification is still required. The risk treatment supports the earlier ISO/IEC 27001:2022 access-control, authentication, logging and change-management goals; this is not certification evidence.
