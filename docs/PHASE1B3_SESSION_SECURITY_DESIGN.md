# Phase 1B.3 — session revocation and login rate-limiting design

Date: 2026-11-10, Asia/Shanghai. Baseline: accepted `8d8fe47`. Design branch: `codex/phase-1b3-session-design`.

**DESIGN ONLY — implementation, new migrations and infrastructure are not authorized.** No application code, database, dependency or existing test is changed by this document. The three security requirements remain release blockers. Production access and deployment remain unauthorized.

## 1. Recommendation and accepted baseline

Recommend **two new PostgreSQL-backed security models, one account epoch field, and database enforcement for security changes**:

1. `DeviceSession`: one revocable API login/token family, with authoritative idle/absolute deadlines and a current refresh generation/digest.
2. `AuthThrottleBucket`: bounded rolling-window counters shared by every application worker, including Django admin login.
3. `User.session_epoch`: monotonic invalidation of every earlier login after password, role, active-status or technical-privilege changes. Database triggers also mark device sessions revoked.

This uses the existing PostgreSQL service. Redis is an alternative, **not a new approved dependency or provisioned service**. Existing Django admin sessions stay in `django_session`; their session payload gains an epoch and deadlines, rather than introducing another session model. Existing business ledger models, allocation arithmetic, pricing history, financial reports and actor/request UUID namespace remain unchanged.

Also recommend a third **signed, HttpOnly locator cookie**, which can identify a session for logout when both JWT cookies are damaged. It cannot authenticate or refresh a user. The exact cookie and failure behavior require owner approval below.

Current source facts, inspected without initializing Django or connecting to a database:

- Cookie JWT authentication validates signatures/current users and explicitly enforces CSRF. RBAC uses current database roles; Django flags do not grant business-owner capabilities.
- Access lifetime is currently **60 minutes** and refresh cookie lifetime **7 days**. There is no refresh route, durable device session or login limiter.
- The installed SimpleJWT **5.3.1** refresh serializer creates an access token/rotates refresh values without a durable device-session check. `CHECK_REVOKE_TOKEN` defaults to false. Its password-revocation facility alone would not implement device logout, role revocation or idle deadlines.
- Django's installed `check_password()` can save an upgraded password hash during authentication. A change to the encoded password therefore needs an explicit revocation policy, even when the plaintext password is unchanged.
- The accepted 1B.2 evidence reports PostgreSQL **194 passes/3 failures**, SQLite **173 passes/3 failures/21 skips**, 68 browser checks and 47 frontend utility checks. These are **inherited results, not newly executed tests** for this design.
- Remaining failures are `test_logout_invalidates_copied_access_cookie`, `test_password_change_invalidates_existing_access_cookie`, and `test_repeated_bad_login_is_rate_limited`. Existing evidence/assertions stay intact.

## 2. Security and timing contract

All server deadlines are UTC, stored as timezone-aware database timestamps. Sample PostgreSQL `clock_timestamp()` **after acquiring locks**; transaction-start timestamps must not let a waiting request use stale time. JWT NumericDate claims are integer seconds, rounded down. Client clocks and cookie expiration are not authorization authorities.

| Rule | Exact proposed behavior |
| --- | --- |
| Access validity | `exp = floor(min(issue_time + 900 seconds, absolute_expires_at))`; validate signature/type and `db_now < exp` at admission |
| Idle deadline | Reject at `db_now >= last_activity_at + 1800 seconds` |
| Absolute deadline | Fixed `created_at + 28800 seconds`; reject at equality; login is required afterward |
| Session eligibility | Existing row, matching user/epoch, not revoked, active known-role user, valid deadlines |
| Activity | Successful authorized business-resource requests only; use their admitted time as the new `last_activity_at` |
| Non-activity | Bootstrap, `/me`, refresh, logout, static assets, anonymous storefront reads and failed/denied requests do not renew idle time |
| Remember me | None; no longer-lived browser option |
| Refresh | Can renew access only within the existing idle/absolute deadlines; never renews either deadline by itself |

“Idle” means absence of qualifying server requests, not proof of physical user presence. An authorized business poll can count; the frontend must not add keep-alive polling. Editing an unsent form for 30 minutes can require reauthentication. A stolen bearer used for valid activity can remain active until revocation/absolute expiry; the design does not claim otherwise. Auth status polling must not keep unattended terminals signed in.

Use zero JWT expiration leeway and synchronized application/database clocks; additionally enforce database deadlines regardless of JWT-library checks. A node may reject slightly early if its clock is ahead. Clock drift beyond a proposed 2-second operational tolerance, or database time earlier than a session's recorded activity, is a security-health failure, not permission to extend time. Final clock monitoring and timeout thresholds require operational verification.

Example: login 08:00 → absolute 16:00, first access expires 08:15. Business activity at 08:12 → idle 08:42. Refresh at 08:20 → access expires 08:35, **idle remains 08:42**. Without another qualifying request, a refresh at 08:42 fails. With continued real activity, refresh at 15:55 yields access ending at 16:00, never 16:10. Expiry does not create an inventory reversal or financial cancellation.

## 3. Exact proposed persistence schema

All names below are proposals, not Django classes or migration files created in this package. PostgreSQL is the security/concurrency reference; SQLite supports sequential development with separately tested trigger/check implementations.

### 3.1 Existing `accounts.User`: one added field

| Field | Definition | Purpose |
| --- | --- | --- |
| `session_epoch` | `PositiveBigIntegerField`, NOT NULL, initial/application/database default **1**, non-editable | Monotonic account-wide invalidation version |

Constraint `acct_session_epoch_pos`: `1 <= session_epoch <= 9223372036854775807`. No separate index: every check already finds User by its primary key. Do not modify user IDs, role values, password values or existing historical relationships. Initialization to 1 is security metadata, not a reconstructed historical session.

### 3.2 New `accounts.DeviceSession`, table `accounts_devicesession`

| Field | Exact proposed definition/initial value |
| --- | --- |
| `id` | UUID primary key, application `uuid4`; immutable |
| `user` | FK to `settings.AUTH_USER_MODEL`, NOT NULL, `on_delete=PROTECT`, `related_name='device_sessions'`, `db_index=False` |
| `user_epoch` | PositiveBigInteger, NOT NULL, copied from locked current User at login; immutable |
| `created_at` | DateTime, NOT NULL; explicitly set from sampled database UTC time; immutable |
| `last_activity_at` | DateTime, NOT NULL, initially `created_at`; monotonic accepted activity |
| `absolute_expires_at` | DateTime, NOT NULL, exactly `created_at + 8 hours`; immutable |
| `refresh_generation` | PositiveBigInteger, NOT NULL, initially **0**, increment only; no wraparound |
| `refresh_jti_hash` | CharField(64), NOT NULL; lowercase SHA-256 hex of the current random refresh JTI |
| `revoked_at` | Nullable DateTime, initially NULL; once set, never cleared |
| `revocation_reason` | CharField(24), NOT NULL, initially empty string; terminal reason code |

Reason choices: `logout`, `credentials_changed`, `role_changed`, `status_changed`, `refresh_reuse`, `idle_expired`, `absolute_expired`, `security_cutover`, `operator_revoked`. Multiple security-field changes use reason priority credentials → role → status; structured events record the changed field categories without values/password hashes.

Constraints:

- `ds_epoch_pos`: `1 <= user_epoch <= 9223372036854775807`.
- `ds_gen_nonneg`: `0 <= refresh_generation <= 9223372036854775807`.
- `ds_time_bounds`: `created_at <= last_activity_at < absolute_expires_at`.
- `ds_abs_8h`: `absolute_expires_at = created_at + 8 hours`.
- `ds_jti_hex`: digest matches exactly `[0-9a-f]{64}`.
- `ds_revocation_pair`: either revoked_at NULL and reason empty, or revoked_at non-NULL and reason is an enumerated nonempty code.
- `ds_revoked_after_start`: revoked_at NULL or `revoked_at >= created_at`.

Indexes, in addition to the UUID primary key:

- `ds_user_created`: `(user_id, created_at DESC)`; covers user FK lookup, account-wide revocation and support investigation. No duplicate single-column FK index.
- `ds_abs_expiry`: `(absolute_expires_at)`; absolute expiry/retention batches.
- `ds_active_idle`: `(last_activity_at) WHERE revoked_at IS NULL`; idle-expiry maintenance.

There is **no** FK from a sale or ledger record to DeviceSession. Business ownership remains `InventoryOperation.actor`; deleting expired security records cannot erase or orphan business history. Do not retain raw JWTs, refresh tokens, passwords, password hashes, raw client IPs or user-agent fingerprints in this model. A “device” is a login family, not hardware fingerprinting or a promised one-session-per-physical-browser identity.

### 3.3 New `accounts.AuthThrottleBucket`, table `accounts_auththrottlebucket`

| Field | Exact proposed definition |
| --- | --- |
| `id` | BigAutoField primary key |
| `scope` | CharField(2), NOT NULL; `LA`, `LI`, `LR`, `RR` only |
| `key_version` | PositiveSmallInteger, NOT NULL, initially configured version 1; immutable |
| `subject_digest` | CharField(64), NOT NULL; lowercase keyed HMAC-SHA-256 hex; immutable |
| `event_times` | JSONField, NOT NULL, default empty list; bounded sorted integer UTC epoch-microsecond values |
| `updated_at` | DateTime, NOT NULL; explicitly sampled database time, not client input |

Scopes and exact rolling windows:

| Scope | Meaning | Proposed cap/window |
| --- | --- | --- |
| LA | Failed login/current-password checks per normalized account identifier, across IPs and API/admin surfaces | **5 / 300 seconds** |
| LI | Failed login/current-password checks per verified canonical client IP, across accounts/surfaces | **20 / 300 seconds** |
| LR | Login/current-password submissions per verified IP, including malformed submitted credentials after CSRF succeeds | **60 / 60 seconds** |
| RR | Refresh submissions per verified IP after CSRF succeeds | **30 / 60 seconds** |

Constraints/indexes:

- `at_scope_valid`: scope in the four values.
- `at_keyver_pos`: `1 <= key_version <= 32767`.
- `at_digest_hex`: exactly `[0-9a-f]{64}`.
- `at_events_shape`: JSON array with length at most 5/20/60/30 for its scope, respectively. Use a CASE guard before array-length evaluation. PostgreSQL jsonb checks and SQLite JSON checks require explicit equivalent migration definitions, not an untested portable assumption.
- `at_scope_key_unique`: unique `(scope, key_version, subject_digest)`; this also supplies lookup/upsert index coverage.
- `at_cleanup_time`: index `(updated_at)` for bounded cleanup.

Integer type, ascending order, nonnegative timestamp and window-policy validation also runs under the row lock on every read/write. Compute epoch microseconds using exact integer datetime arithmetic, not float timestamps; reject JSON booleans/floats as event values. Corrupt bucket content fails closed with 503 and an alert; never reinterpret it as an empty counter. No FK to User: unknown account names receive identical protection and can be expired without touching user/business records. There is no redundant stored count; `len(pruned event_times)` is the exact rolling counter.

### 3.4 Database-enforced security changes

Signals or a `User.save()` override alone are insufficient: Django QuerySet updates do not invoke model save/signals. The recommended PostgreSQL migration would install:

1. `accounts_security_epoch_before_update`, BEFORE UPDATE on User. If `password`, `role`, `is_active`, `is_staff` or `is_superuser` is distinct from its old value, set `NEW.session_epoch = OLD.session_epoch + 1`. Otherwise permit unchanged epoch or an explicit exactly-one increment by the approved operator revoke-all command. Reject decreases, skips and overflow. A stale ORM object's old epoch must not overwrite the monotonic value when another protected field changes.
2. `accounts_security_revoke_after_update`, AFTER UPDATE when epoch differs. Mark this user's unrevoked DeviceSession rows revoked in the **same transaction**, assigning current database time and the appropriate reason. Never reset previously revoked rows. An explicit epoch-only increment uses `operator_revoked`.

3. `accounts_device_state_before_write`, BEFORE INSERT/UPDATE on DeviceSession. Insert requires generation 0, initial activity equal to creation, and a matching locked current active known-role User epoch. Update rejects changes to ID/user/captured epoch/creation/absolute deadline, decreasing activity, revival or alteration of a terminal revocation, and refresh jumps other than exactly +1 with a changed digest. An unchanged generation requires an unchanged digest. Once revoked, the row cannot rotate or renew activity. Security-trigger revocation and authorized expiry/logout remain permitted transitions.

The User update already holds an exclusive row lock; all request/session writers must lock User first. Any session-revocation failure rolls back the account change too. Bulk account changes pre-lock target User IDs in sorted order; a raw unordered bulk update can deadlock and must roll back/retry as a whole, never partially bypass guards. Schema-qualify trigger references, use a controlled search_path and invoker privileges, and review function grants. The application account must not own tables or be able to disable triggers in production; the migration role is separate. Privileged SQL that disables triggers/restores old snapshots is an operational trust boundary, not something Django code can secure.

Supply/test equivalent SQLite safety guards in future migrations; do not substitute SQLite for PostgreSQL race proof. SQLite cannot assign NEW fields using PostgreSQL's BEFORE-trigger syntax: its implementation needs explicit guarded AFTER updates/abort conditions, revocation before the internal epoch update, and tests against recursive/double increments. It may reject and require reloading a stale full-object save that PostgreSQL can sanitize; it must never silently keep an old epoch or accept session revival. Document that availability difference. Backend-specific reverse operations must remove triggers before tables/columns. No trigger SQL or migration is executed now.

**Password policy choice:** encoded-hash changes, including automatic Django hash upgrades, invalidate all earlier sessions. This conservative rule catches `.save(update_fields=['password'])`, QuerySet updates, admin changes, unusable passwords and raw SQL. It avoids an unsafe “hash upgrade” bypass flag. A fresh login that upgrades its hash issues its new session only after reloading the trigger-updated epoch. Approve this occasional forced-logout effect explicitly. Application role/status helpers also use this path; re-promotion/reactivation increments again, so old tokens cannot revive.

## 4. JWT binding, cookies and validation

Use SimpleJWT/PyJWT signing/validation with a fixed allowed algorithm, initially HS256 with an independently generated ≥256-bit **JWT signing key**, separate from Django SECRET_KEY and the throttle HMAC key. Distinct keys/issuer/audience per environment. Require configured logical issuer `rowszein-auth:<environment>:v2`, audience `rowszein-api:<environment>`, and a version claim `sv=2`; these are logical identifiers, not invented production hostnames.

Both token types contain `user_id`, `sid` (DeviceSession UUID), `se` (captured user_epoch), `sv`, `iat`, `exp`, `jti`, issuer, audience and explicit `token_type`. Refresh also contains `rg` (generation). Reject missing/wrong-type/out-of-range claims and access/refresh substitution; never trust a JWT role claim. Refresh JTI is 32 cryptographically random bytes, base64url encoded; store only its SHA-256 digest and compare in constant time. Access JTIs remain random; no separate per-access-token table is needed because every token is gated by its session.

Proposed host-only, HttpOnly cookies, preserving the current root Path `/`:

| Cookie | Value | Client lifetime ceiling |
| --- | --- | --- |
| `access_token` | Bound access JWT | Remaining JWT lifetime, at most 15 minutes |
| `refresh_token` | Rotating bound refresh JWT | Remaining fixed session absolute lifetime, at most 8 hours |
| `device_session` | Django TimestampSigner-signed SID with a dedicated purpose salt | Remaining absolute lifetime, at most 8 hours |
| Existing `csrftoken` | Django CSRF secret; masked value returned separately | Existing CSRF cookie policy |

The locator uses Django's signing mechanism, never grants authentication, and cannot mint/refresh tokens. It makes logout identification resilient; access-only copies must still be valid before logout in regression tests, so the locator is **not** an extra required business authentication secret. No tokens go to JSON, localStorage, sessionStorage, logs or traces. Cookie presence/expiry is not a permission authority. Retain no-store/Vary: Cookie and existing anti-cache middleware. These bounded cookies can survive a browser restart within the 8-hour ceiling; “no remember me” means no longer-term renewal. If logout-on-browser-close is desired instead, approve session-only cookies explicitly; browser session restoration still cannot be a substitute for server expiry.

For the approved same-origin topology, recommend Secure + SameSite=Lax for all auth/locator cookies. The current production setting defaults auth cookies to SameSite=None; do not silently assume deployment already matches this proposal. Verify actual HTTPS/Host/proxy topology before changing deployed configuration. Exact development loopback exceptions only; no wildcard Origins. Preserve cookie names/paths to avoid duplicate-name ambiguity, and expire any verified historical path/domain variants explicitly during a future cutover.

### Validation and denial precedence

Keep the existing CSRF enforcement for unsafe cookie requests, login, refresh and logout, including exact Origin/HTTPS Referer checks. Bootstrap remains stateless with respect to JWT/session validity and available to recover from expired/malformed cookies.

After cryptographic JWT checks, use the locked current User and DeviceSession. Require matching SID/user/epoch, known active role, non-revoked session and deadlines. Missing SID/version on a legacy token **does not create a session**. No positive session cache, read replica or stateless `TokenUser` may bypass the authoritative primary-database check.

Preserve accepted RBAC denial assertions: a signed active user's now-forbidden action, including downgraded-owner stock adjustment or unknown-role access, returns **403**; a permitted capability with an ended/invalid session returns **401**. This is error classification only: an invalid session must never be returned as an authenticated principal or reach a handler. The authenticator can consult the existing route/action mapping to classify the denial before returning. `/me` for a revoked formerly valid session is 401; current role/capability enforcement still runs after successful session validation. Inactive/deleted users and invalid JWTs retain 401 behavior. Test this ordering, including CSRF failures, rather than weakening the original role tests to accept arbitrary statuses.

Extend typed error handling deliberately: 401 `access_expired` may offer renewal only for a still-eligible family; 401 `session_ended` must not loop refresh; 403 `forbidden` and `csrf_failed` retain their distinction; 429 retains Retry-After; infrastructure failures use 503 `auth_unavailable`. Do not let the current generic 401 handler erase these intended distinctions. Never expose account existence or detailed revocation reasons to anonymous clients.

Public catalog fallback remains narrowly scoped as in 1B.2: expired/malformed JWTs may receive only the anonymous safe projection. A valid JWT with unknown/inactive user or invalid/revoked session must not receive privileged projection or globally fall back to anonymous. Private reads/writes never use that fallback.

## 5. Transactions, locking and request lifetime

**Recommended correctness-first baseline:** serialize private requests within one DeviceSession. Across different sessions of the same user, retain the existing compatible shared User locks. This avoids a shared-to-exclusive session-lock upgrade deadlock when recording exact idle activity.

Global acquisition order:

1. Auth quota buckets, when needed: short LR/RR debit transaction first; main login LI buckets then LA buckets, each key-version/digest sorted.
2. User rows by ascending primary key. Business requests use FOR SHARE; credential/security changes and login credential verification use FOR UPDATE.
3. DeviceSession UUIDs by deterministic UUID order; FOR UPDATE. Where current Django-admin session rows are also involved, lock them afterward by session key.
4. Existing sale → sorted product → sorted ingredient → sorted basis locks, unchanged.

No command may acquire quota rows after User/session/business locks. Cleanup follows the same User/session order. Do not lock every session on a user's normal request.

A centralized business-API request transaction boundary must cover authentication, permissions, handler writes, response rendering and final deadline check. Include credential-bearing public-catalog reads before returning any privileged projection; anonymous safe reads do not acquire/touch a device session. The existing `_run()` remains nested safely; it must receive/recheck a verified session context (actor/SID/epoch/expiry), including before a saved operation response. Do not add a permissive `session_id=None` production fallback or scope inventory UUIDs by session. Failures roll back all business writes and any tentative activity update; do not commit a partial sale because DRF converted an exception into a 4xx response.

At admission, sample time after locks, check eligibility, and tentatively set activity to admission time for a qualifying business request. Commit that activity only on successful 2xx/304 authorized results. At completion, abort/roll back if the absolute deadline has passed; normal access-token expiration is evaluated at request admission. No streaming private response may escape the transaction before these checks. Existing PDF exports are buffered, but their render duration must be measured.

Login/refresh/logout have their own explicit transactions and are exempt from the generic private-request wrapper so unusable access cookies cannot block them. Return denial result objects after committing required security-state changes; raising an exception inside atomic must not accidentally roll back a refresh-reuse revocation or a failed-login counter.

Proposed starting resource bounds: 2-second row-lock wait, 3-second individual SQL statement timeout, and 10-second total private/auth transaction deadline, tuned only after isolated load tests. A statement timeout alone does not bound Python password hashing or PDF work. Timeout means rollback/503, not a weaker check. Same-device serialization may queue parallel requests or delay logout behind an export; this is an explicit availability tradeoff requiring approval. If measurements fail, redesign activity accounting before release rather than silently relaxing locking.

## 6. Login, logout and security-change flows

### Login

1. Existing Django CSRF/Origin checks; bounded input parsing and LR debit; no account lookup before a reliable limiter is available.
2. Lock LI, prune/check; only then create/lock LA. This avoids creating unlimited random account buckets after an IP is blocked.
3. Resolve the candidate username with existing authentication semantics. Gather any verifiably identified old browser-session users, lock User IDs in order **before** password checking, and authenticate against current state. This also avoids racing a password change or hash upgrade. Unknown users still do Django's dummy password work, within the quota.
4. Failed credentials/inactive/unknown-role or admin-ineligible login: append failure time to both LI/LA; commit counter changes; return the appropriate generic failure without issuing cookies.
5. Success: reload current epoch, revoke verified previous browser families in the same transaction, create a new DeviceSession and signed pair. Different genuine devices stay signed in. Do not invent old-session rows from legacy JWTs.
6. Commit, then emit cookies and rotate Django CSRF as in 1B.1. Signing/construction errors before commit roll back session creation. A lost successful login response can leave a bounded orphan session; no idempotent login-response storage is proposed. It expires under the same rules, and a retry cannot extend its lifetime. No device cap/automatic eviction policy is introduced.

Input bounding is required for hashing/DoS protection: propose a 16-KiB login-body ceiling and the existing model's username length, without logging rejected bodies. Confirm compatibility for any unusually long existing passwords before approving this ceiling; no password strength or case-sensitivity change is implied.

### Current-browser logout

- Keep CSRF protection and independence from ordinary access authentication. Identify only cookie-proven families: current refresh/access JWT, or signed locator. For logout identification only, a narrowly scoped decoder may verify a signed expired JWT while ignoring `exp`; still enforce algorithm, signature, issuer/audience/type/version and SID/user/record consistency. This decoder must never authorize reads, writes or refresh. Do not accept a body-supplied UID/SID as proof.
- If cookies identify different families because of an interrupted account switch, revoke all verifiably cookie-proven IDs, at most three, under sorted User/session locks. Do not select arbitrary sessions by username.
- Mark only those families revoked and delete the current browser's Django-admin session row if present. Do not increment the User epoch for ordinary device logout. Commit **before** returning confirmed success; then clear all three auth/locator cookies and Django session cookie, clear private query cache, and rotate CSRF.
- Repeated logout is safe. No identifiable family means browser cleanup only; return a clear `server_session_identified: false` result, not a claim about an unrelated copied token. If all proof cookies are missing/damaged, no design can identify every earlier token; an authenticated password/administrator revoke-all procedure is the recovery option.
- On a database error, return **503, no confirmed revocation**, and retain the HttpOnly proof cookies/current admin session key so an idempotent retry can still identify every browser session. Show “logout not confirmed; retry before leaving this terminal”; private views/cache may be hidden for privacy, but that is not a server security boundary or a completed local logout. Retry **logout only**, with fresh CSRF if necessary; do not refresh or replay business writes. A failed persistence operation cannot guarantee copied-token invalidation after the database recovers, and the terminal must still be treated as signed in until retry/operator intervention succeeds. This explicit availability/security limitation needs owner acceptance. Never return successful logout merely because the UI hid its data.

If logout wins the session lock, later copied access/refresh tokens are denied. If an authorized business transaction wins first, it commits atomically before logout succeeds. Logout never cancels a sale or restores inventory. A delayed response can replace browser cookies with already-revoked values; server state still rejects them and the client must recover explicitly.

### Password, role and status changes

Any protected User-field change increments epoch and revokes all DeviceSession families atomically, including the current one. Do not keep the password-changing device signed in automatically. Role downgrade/promotion and deactivation/reactivation all invalidate previous epochs; returning a role to its former value does not restore any old session. Normal email/last_login changes do not increment epoch.

Use existing controlled admin/management paths; no public user-management or password-change API is added by this design. Database triggers cover ORM save/update and ordinary SQL paths. Approved operator revoke-all increments epoch once. Django admin login must remain owner-plus-technical-permission gated and share the same login limiter.

## 7. Refresh, replay and browser coordination

Propose `POST /api/auth/refresh/`, CSRF/Origin protected with no default access-cookie authenticator. Refresh is cookie-only; tokens never appear in JSON. Check RR quota, then lock User/session and validate current active role, epoch, fixed absolute deadline, idle deadline, refresh signature/type and claims. Lock/recheck before comparing generation/digest.

| Submitted refresh | Required outcome |
| --- | --- |
| `rg == stored generation`, matching current JTI digest | Atomically increment generation, replace digest, prepare fresh access/refresh cookies; commit once |
| Valid signed old `rg < stored generation` | Proven reuse: revoke the **entire family**, including the winner's access tokens, commit revocation, return 401 |
| Matching generation but different digest, or impossible future generation | Fail closed; revoke family as `refresh_reuse`, alert; no new tokens |
| Invalid signature/type/SID/user binding | Generic 401, no arbitrary family revocation based on attacker input |
| Epoch/idle/absolute/revoked failure | 401 session ended; no renewal |
| Generation exhausted | Fail closed, revoke/require login; never wrap |

Refresh `exp` stays at the original absolute deadline. Access receives at most 15 minutes of validity, clipped by absolute time; database idle checks can end it sooner. Old access tokens may coexist until their individual expiry while the family remains valid. Reuse/logout/epoch change kills all of them together. There is no raw-token history, response replay table or blacklist-only assumption: valid signatures plus the monotonic generation identify older refresh credentials. Keep the existing CSRF secret during ordinary refresh to avoid needless cross-tab invalidation; successful login/logout retain their explicit CSRF rotation. Refresh must still verify the current token and Origin/Referer.

**Recommended strict policy has no grace window.** Two legitimate requests that actually present the same old refresh token race: first rotates, second revokes the family. A lost committed refresh response followed by retry also requires password login. This is the secure availability tradeoff: the server cannot distinguish a stolen old token from an indistinguishable legitimate repeat.

Frontend mitigation: one same-origin auth-lifecycle mutex per tab, and Web Locks across tabs where supported, covering login/refresh/logout and reading current cookies only when dispatching under the lock. Use notification channels only for non-secret state. Never broadcast/store JWTs. Unsupported browsers can use explicit re-login rather than promise cross-tab safety. Cookie mismatches during account switching fail closed; old refresh failures must not clear a newly issued unrelated login's cookies.

Do not add a periodic refresh heartbeat. A safe read may perform one on-demand refresh and retry the safe GET. For unsafe sales/stock operations, preserve 1B.1: **no automatic 401 replay**. Offer renewal/re-login, then an explicit retry with the original actor-scoped UUID, payload and revision. Refresh cannot discard pending intent or recalculate its historical price. Existing CSRF-only recovery remains bounded to one pre-write 403 retry with the same intent.

## 8. Existing Django admin session boundary

Retain the existing database session backend and owner/technical admin restrictions. Add these server-side session-payload keys at a successful admin login: `_business_auth_epoch`, `_business_started_at`, `_business_last_activity_at`, `_business_absolute_at`. Times are UTC epoch microseconds; absolute equals start + 8 hours. These are fields inside the existing signed/encoded session payload, **not new model columns**.

An admin guard after Django authentication rechecks the locked current user, epoch, active role, session row and the same 30-minute/8-hour limits before any admin business page/write. Missing metadata forces re-login at cutover. Use User → existing Django session-key order, and enforce current technical model permissions too. Qualifying successful admin activity may renew idle time; static/login/logout/status polling does not. Django session cookie expiry is bounded by remaining idle/absolute time.

Password change must override Django's normal “keep current session after password change” behavior: clear the current admin session and require reauthentication. Its old-password verification uses the same account/IP failure limiter, so this surface cannot bypass login protection. Classify credential-mutating requests before the generic guard: acquire quota rows, then User FOR UPDATE up front, then session rows; do not upgrade competing shared User locks after password checking starts. Failed new-password quality validation is distinct from an incorrect old password, while LR still bounds submissions. Other admin sessions with old epoch are rejected on their next request without scanning/decoding every django_session row. API logout and admin logout must both revoke cookie-proven API families and flush only the current browser's Django-admin session. Do not delete all other devices on ordinary logout. Missing/failed server revocation retains the explicit outage outcome above. The ledger/history admin registrations stay read-only.

## 9. Atomic login-failure limiting

### Identity and privacy

Account bucket input is `NFKC(trim(username)).casefold()`, used **only for throttling**, followed by purpose-separated HMAC-SHA-256 using `AUTH_RATE_HMAC_KEY`. Authentication retains existing username lookup/case semantics; no account is renamed/merged. Case/normalization-equivalent distinct accounts can share a stricter quota, which is a compatibility decision below. Unknown names are counted identically. Bucket/log data contains no raw username/IP or password.

IP input is the verified canonical address, normalized with a real IP parser, including IPv4-mapped IPv6 normalization. Do not substitute a header string or DNS name. Distinct IPv6 addresses remain distinct initially; /64 aggregate quotas or edge reputation controls are optional later additions, not an implied fix for distributed attackers.

### Admission and rolling-window algorithm

LR/RR debit uses a short transaction with upsert then row lock and prune. For login credential verification, hold **LI and LA locks across password verification and final outcome**, using the existing primary database. There is no unlocked in-flight gap that allows hundreds of concurrent bad passwords to pass a counter check.

1. Upsert LI row(s) with `ON CONFLICT DO NOTHING`; select FOR UPDATE in deterministic order. Sample current database time. Validate structure and retain events in `(now - window, now]`. If now precedes updated_at or a stored event, fail 503/alert rather than dropping future events after a clock rollback. If cleanup won a stale-row deletion race, retry upsert/lock before any User lock or fail 503; a missing bucket never means unlimited admission.
2. If LI is full, return 429 without creating an LA row or running password hashing. Otherwise upsert/lock/prune/check LA.
3. If either is full, return generic 429. `Retry-After = ceil(max(next eligible time of all blocking buckets) - now)`, at least 1 second. Blocked requests do **not** append failure events or extend the lockout.
4. Verify credentials while these rows remain locked. On failure append the final database failure time to each LA/LI row and commit. The fifth account failure itself is 401; a sixth attempt is rejected at admission with 429. IP behaves correspondingly at 20 failures.
5. On success do not clear failure history, particularly not the IP history; prune naturally and create the device/admin session in the same authenticated transaction. No permanent lockout. Correct passwords are also blocked temporarily when the quota is full, rather than revealing a password-dependent bypass.
6. Commit expected failure counters before returning 401. An unexpected backend/database/signing error produces 503 with no session issuance, not a half-success or an uncounted unlimited verification loop. LR already bounds submissions even if the credential transaction aborts.

Counters use exact rolling windows, not fixed-window resets with a boundary burst. Workers serialize hot account/IP rows. A high-traffic NAT or targeted account can experience temporary denial of service; this is why thresholds and measured contention require owner approval. Application quotas do not replace network/edge abuse protection.

Key rotation: keep old/new HMAC versions readable and write both during at least the longest 5-minute window plus maximum transaction time. Lock versions deterministically and enforce each version's limit; do not sum double-written events. Retire the old key only after all relevant history is present in the new version. A worker with an inconsistent key-ring/policy version fails health checks; it cannot silently reset protection. Policy increases beyond the schema's bounded event capacity need another migration/review.

## 10. Client IP and proxy trust

The repository has browser-relative `/api` rewrites to a hosted backend, but its live ingress topology, header sanitization and trusted proxy addresses have **not** been verified. Do not assume Vercel, Render, a private IP range or a fixed number of proxies is trustworthy merely from its name. Existing `SECURE_PROXY_SSL_HEADER` trust also needs validation at that boundary.

Approved modes to propose:

- **Direct local/test:** use socket/WSGI REMOTE_ADDR and ignore Forwarded/X-Forwarded-For/X-Real-IP, including forged values. Loopback profiles stay explicit.
- **Verified production proxy chain:** only a configured, authenticated/sanitizing ingress may assert client information. Validate the immediate peer, parse a bounded chain (proposed maximum 8 IPs/1 KiB), remove configured trusted hops right-to-left and use the first untrusted address. Ignore attacker-prepended values beyond that boundary. Reject malformed/ambiguous chains. If a trusted single canonical-IP header is chosen instead, prove the edge strips client-supplied copies and that direct backend access cannot forge it.

If a trustworthy end-client address cannot be established where proxy mode requires it, fail login/refresh with 503 and alert. Never fall back to trusting arbitrary headers or pretending a shared egress peer is a verified end client. A deliberately selected shared-peer emergency quota is a separate degraded-mode decision; it is **not recommended** as an automatic fallback. Public bootstrap and cookie-cleanup CSRF recovery remain available independently of a login counter failure where feasible.

Before any production authorization, prove allowed paths, direct-backend bypass behavior, TLS scheme/Host handling and canonical client addresses in a controlled environment. No production URL, IP range, credential or infrastructure change is requested by this design turn.

## 11. Infrastructure alternatives and outage policy

| Choice | Assessment |
| --- | --- |
| **Existing PostgreSQL: recommended initial implementation** | Atomic/durable shared counters and sessions in one existing service; bounded JSON windows avoid another counter model. Hot-row/password-hash serialization and DB write load must be measured. No new service required. |
| Redis counters, PostgreSQL sessions | Can improve auth admission throughput, but requires approval for client dependency, TLS/ACLs, capacity, persistence/failover and monitoring. Use atomic Lua reservations/settlement, not INCR-after-failure. Multiple account/IP keys require a proven single atomic domain; Redis Cluster cross-slot scripts are not automatically atomic. Failover/lost reservations cannot silently reset limits. |
| Short JWTs plus SimpleJWT password checks/refresh blacklist | Useful defense in depth, but insufficient alone for current-device access revocation, role/reactivation invalidation, exact idle/absolute limits and refresh-family races. Not the recommended completion of the three blockers. |
| Django server-side sessions for the whole API | Could simplify revocation, but changes the approved JWT architecture; not recommended for this package. |

The Redis alternative would need a separate design against [Redis script atomicity](https://redis.io/docs/latest/develop/programmability/eval-intro/) and [Redis Cluster's key-slot/failover behavior](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/); merely selecting a shared cache does not prove the required counter semantics.

Required outage behavior:

- Primary session store unavailable/corrupt/lock timeout → private auth/read/write/refresh **503 and no business mutation**, never anonymous/private success or stateless JWT fallback.
- Counter table/permission failure while session storage otherwise works → new logins/refresh fail closed; existing valid business sessions may continue only if all their authoritative checks work. No local-memory substitute, permissive feature flag or “unlimited while Redis is down” mode.
- Confirmed quota exhaustion → **429**, not 503; infrastructure error → 503, not “wrong password.” Preserve pending business identities across both.
- Bootstrap retains Django CSRF protection and does not depend on a quota database. Logout cannot claim durable revocation while the database is unavailable; use the explicit pending-revocation recovery described above.
- No authentication reads from lagging replicas or eventually consistent positive caches. Database failover/restore must not resurrect old security state; incident cutover may require signing-key rotation and forced re-login.

## 12. Retention, cleanup, keys and monitoring

Proposed retention: DeviceSession rows until **absolute_expires_at + 30 days**; throttle rows until **updated_at + 24 hours**; structured security events **90 days**, subject to owner/privacy approval. No new event table is proposed; use access-controlled operational logs with approved retention. Session rows do not contain full audit histories, so the log sink must not be represented as a proven durable audit service until its delivery/storage are verified.

After implementation approval, run a bounded cleanup management command every 15 minutes through the operator's approved scheduler. It marks expired sessions where useful, prunes stale quota rows and deletes terminal retained sessions in small batches with skip-locked behavior, following User → session order. Expired sessions are rejected even when the job is stopped. Existing Django `clearsessions` also removes expired admin session rows. Never delete User, InventoryOperation or other business history as session maintenance. Any new scheduler/host configuration requires separate operational approval; no cron/container/service is created now.

Record login outcomes, quota denials/unavailability, logout confirmation/failure, refresh rotation/reuse, epoch changes and cleanup totals. Log bounded correlation IDs, pseudonymous account/IP keys and session-ID digests, not raw cookies/JWTs/passwords/CSRF tokens, full usernames/IPs, request bodies or password hashes. Restrict log access, alert on trigger absence, inconsistent key rings, reuse bursts, limiter outages, clock drift, long locks and cleanup lag. Backup signing/HMAC secrets separately. The new security tables contain no raw bearer JWTs, but a full existing database backup still contains password hashes and Django-admin session keys: treat it as credential-sensitive, encrypt it, restrict access, and invalidate restored admin sessions before reopening traffic.

No perpetual remember-me, device fingerprinting or new device-management UI is included. A copied bearer remains usable until the relevant revocation/expiry; this design closes post-logout/password/role revocation, not XSS or theft prevention itself.

## 13. Future migration, backup, compatibility and rollback plan

**No migration is generated or run now.** If the owner approves the design, use these separately reviewable checkpoints:

1. Implement models/services/tests; generate **additive, unapplied** migrations. Suggested exact operation grouping: accounts `0002_session_security_schema` adds User.session_epoch, creates DeviceSession/AuthThrottleBucket and their constraints/indexes; accounts `0003_session_security_guards` installs backend-specific epoch/revocation functions/triggers using explicit forward/reverse operations. Inspect the actual migration graph and generated SQL before any application authorization. Names are proposed, not files created today.
2. Obtain explicit authorization to apply only in fresh owned PostgreSQL/SQLite verification targets. Test empty creation and upgrade from the accepted schema with synthetic preserved users/business history, trigger installation, raw-update behavior, rollback and backup/restore.
3. Future production work requires a **separate** authorization, verified topology/keys, reviewed backup and maintenance plan. Proposed cutover is a bounded maintenance window, not a mixed old/new rolling deployment: drain all private writes/auth requests, back up consistent PostgreSQL data and verify a restore, apply approved additive schema/guards, start only enforcing workers and health-check them, then reopen.
4. Force fresh login for every legacy JWT/admin cookie. Do not manufacture sessions or upgrade a legacy UID token into a new session. New keys/issuer/version are mandatory; there is no legacy-token bypass. Existing account IDs, ledger rows, original prices, stock quantities and operation keys remain untouched. Old csrf cookies may be rotated safely during re-login.

Backups must include User epochs, security tables, constraints, trigger definitions and policy/key-version manifests, plus all unchanged business tables. Test PITR/restore: an older snapshot can otherwise revive a revoked family or consumed refresh token. After any restore/failover with possible security-state loss, fence private traffic, rotate the auth signing key, increment restored User epochs/revoke restored device sessions and invalidate restored Django-admin session rows before re-login. If counter history may have been lost, keep login admission closed for at least the longest 5-minute window before reopening with verified fresh counters. Do not erase live quota rows during normal restart or unilaterally drop active limits after recovery. Verify synchronous-commit/HA recovery guarantees or require a fenced recovery procedure; transparent asynchronous failover with undetectable lost revocations is not acceptable production assurance. No stronger existing HA guarantee is assumed.

**Preferred rollback is forward repair or a compatible enforcement build**, with new schema retained and fresh login where needed. Reverting to `8d8fe47` reopens the three blockers: it does not understand session state and could accept older unexpired legacy tokens. Never call that a secure rollback. If a downgrade is unavoidable, keep private traffic closed until a separate risk-approved recovery plan exists. Disposable reverse rehearsals may drop triggers first, then new tables/field, only after draining dependencies and taking a backup; security metadata is lost. Production schema reversal/destructive cleanup is not authorized by design approval. Additive columns, JSON backend differences, table locks, trigger privileges, DDL backup restoration and stale workers are explicit upgrade risks.

## 14. Required verification before declaring the blockers closed

Do not change expectedFailure/skip flags or relax existing business/CSRF/RBAC assertions. Retain accepted evidence. New session-aware factories must issue genuine V2 tokens and create security rows instead of letting legacy/missing-SID tokens pass or using a production bypass.

| Area | Required cases and evidence |
| --- | --- |
| Original three blockers | Prove a copied token works **before** logout/password change, then 401 afterward; fifth failure recorded and subsequent login 429; actual API tests must pass |
| Binding | Wrong/missing SID, UID/epoch/version/type/audience/issuer/JTI, changed role, inactive/deleted user, locator-only request and legacy token all fail closed |
| Time boundaries | Frozen clocks just before/equal/after 15m, 30m and 8h; wait on lock before time sample; idle not renewed by `/me`/refresh/bootstrap; new access clipped at absolute cutoff; clock drift handling |
| Revocation | Current device only, other device remains eligible, repeated logout, expired/malformed access with refresh/locator recovery, all proof absent, password save/update/raw SQL/admin changes, role/active changes and reversals, hash upgrades, epoch overflow |
| Refresh | Success; unchanged absolute/idle; old generation, forged digest, expired session, two workers with same refresh, lost committed response, multi-tab coordination, logout/refresh/role/password races and delayed Set-Cookie responses |
| Limiter | API/admin shared account/IP quotas; exact rolling boundaries; concurrent success/failure/unknown users; blocked attempts do not extend cooldown; no success reset; dummy hashes; LR/RR caps; invalid payloads/CSRF; corrupt rows and HMAC key rotation |
| Proxy | Forged Forwarded/XFF/X-Real-IP ignored in direct mode; trusted-chain traversal and prepended spoofing; bypass path, missing canonical identity, malformed IPv4/IPv6/mapped forms, NAT and IPv6 rotation limits |
| Failures | Counter/session DB failure, timeouts, signing failures, crash before/after commit, rollback, unavailable cleanup, pending logout/recovery, response loss; never a stateless fallback or false confirmed logout |
| Preservation | All 120 business assertions, original 13 role requirements, all 26 CSRF regressions, frontend 47 checks and accepted browser invariants; exact stock/financial reconciliation and no unauthorized business writes |
| Operations | Fresh/upgrade migrations, SQLite trigger equivalence, PostgreSQL trigger privileges and absence checks, bounded cleanup, backup/restore/key cutover, query plans/hot-row load, safe rollback and log redaction |

Run PostgreSQL races with independent connections and observed lock waits: business command versus logout/revoke; duplicate actor UUIDs across different device sessions; same-session concurrent operations; concurrent refresh/reuse; failed-login thresholds across workers; password hash upgrade versus login; epoch update versus restore/reactivation; cleanup versus refresh. Include exception injection at each write/commit boundary and preserve zero-write assertions for all existing business models.

Same-SID serialization intentionally prevents disjoint writes in that session from reaching the old forced insert barrier together. Keep that existing **database unique-key race** substantive by giving its two workers separate valid DeviceSessions for the **same user and same request UUID**; retain every conservation/rollback assertion. Add a separate same-session duplicate test. SQLite skips only truly PostgreSQL-dependent races and must execute sequential epoch/expiry/quota behavior; do not present it as concurrency proof.

One accepted browser sequence needs a **stronger D6 version**, not removal: 1B.2's live role downgrade currently continues into a readonly staff workspace with the same token. New design revokes that session; assert ended-session/re-login first, then retain the readonly staff/navigation/no-leak assertions. Keep old evidence and add the versioned stronger flow. The original forbidden-action 403 role assertions remain preserved through denial precedence. No previously committed sale may be recreated, repriced or cancelled merely because reauthentication occurred.

New security-row activity, failure counters and committed revocations are intentional security writes; distinguish them from prohibited Sale/Ingredient/ledger mutations when asserting a denial. Never permit an auth event to alter InventoryOperation, SaleConsumption, StockMovement, SaleFinancialEntry, recipes, expenses or historical user identity.

## 15. Alternatives requiring different approval

- **Graceful refresh retry:** a bounded grace window with durable refresh-attempt identity and encrypted replayable token response could reduce multi-tab/network-loss logouts. It adds fields/records, encryption/key handling and a window in which old-token reuse is accepted. No such storage is in the recommended schema. Do not silently introduce grace after tests become inconvenient.
- **Application-only epoch hooks:** fewer database objects, but raw/QuerySet updates and missed write paths can bypass revocation. Not recommended for the stated password-change blocker without a separately proven restriction of every write path.
- **No locator cookie:** simpler cookie surface; intact refresh or signature-verifiable expired access can identify logout. If both are damaged, the server cannot identify the family. Retain this as an explicit availability/recovery alternative, not a claim of equivalent damaged-cookie recovery.
- **Non-serializing session activity:** can improve concurrent exports/reads, but needs proven atomic activity accounting and revocation ordering without lock-upgrade races. Not an informal optimization before testing the proposed baseline.

## 16. Explicit owner decisions — approval required

| Decision | Recommended approval |
| --- | --- |
| D7 — exact persistence/enforcement | Approve the two models, User.session_epoch, fields/constraints/indexes/FKs and PostgreSQL/SQLite triggers in section 3; no business schema changes |
| D8 — security-change semantics | Revoke all devices, including current, on password/encoded-hash, role, active or technical-flag changes; accept automatic hash-upgrade logout; no token resurrection after reversal |
| D9 — activity/serialization | Approve successful-business-request activity, no heartbeat/refresh renewal, per-session request serialization and measured timeout/load gates |
| D10 — strict refresh | No grace; old refresh use revokes the family, including legitimate concurrent/lost-response repeats; frontend coordinates or requires login |
| D11 — cookies/logout | Approve signed locator cookie, same-origin Secure/Lax target after topology proof, current-browser API/admin cleanup, and explicit pending server revocation on outage |
| D12 — shared counters/limits | PostgreSQL initially; LA 5/5m, LI 20/5m, LR 60/min, RR 30/min; exact rolling windows, no permanent lockout/success reset; approve temporary account/NAT denial tradeoff |
| D13 — identifier/proxy policy | Throttle-only NFKC/casefold normalization, exact-IP quota initially, verified ingress identity required; no header/shared-peer fail-open; confirm trusted chain before production |
| D14 — retention/operations | Session absolute+30d, counters 24h, security events 90d; approved scheduler/monitoring/key ownership; no infrastructure provisioned implicitly |
| D15 — cutover/rollback/admin | Force legacy JWT/admin re-login; bounded maintenance and separate keys; admin epoch/deadline enforcement; forward-compatible rollback; accept stronger role-change browser contract |
| D16 — staged implementation authority | If design is accepted, authorize implementation and **generation/static inspection of unapplied migrations only** first; obtain a further explicit approval for disposable migration/concurrency testing. Production remains separately unauthorized |

The 16-KiB body ceiling, measured transaction limits and any deployment-specific trust/secret configuration also need review within these decisions. Approval of a design does not authorize deploying Redis, applying production migrations or opening production access.

## 17. Guidance and design interpretation

Use [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) for server-enforced expiry, logout and sensitive-event session handling; the exact durations/retention here are project policy. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) informs generic failures and account-focused throttling; the chosen thresholds are proposed operational values. [DRF documents non-atomic default throttles](https://www.django-rest-framework.org/api-guide/throttling/), which is why they are not the security boundary.

The installed SimpleJWT 5.3.1 source was inspected; [current upstream settings documentation](https://django-rest-framework-simplejwt.readthedocs.io/en/stable/settings.html) describes rotation/blacklisting but is not evidence that this installed app implements device revocation. [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html) informs explicit JWT algorithm/claim validation. [RFC 9700 section 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14) informs refresh-reuse/family revocation; this application remains its existing first-party JWT app, not a new OAuth authorization server.

[Django QuerySet.update semantics](https://docs.djangoproject.com/en/5.1/ref/models/querysets/#update) explain the signal-only gap. [Django transaction guidance](https://docs.djangoproject.com/en/5.1/topics/db/transactions/), [PostgreSQL row-lock rules](https://www.postgresql.org/docs/17/explicit-locking.html) and [PostgreSQL trigger documentation](https://www.postgresql.org/docs/17/plpgsql-trigger.html) inform the proposed implementation, which still needs actual tests after approval. Django 5.1 is unsupported; no dependency upgrade is part of this design. The risk-review approach continues the project's ISO/IEC 27001:2022-oriented practices; no security patch or design constitutes certification.

**STOP: approve/amend D7–D16 before implementation. The three blockers are still open; no migration or session/counter persistence has been implemented.**
