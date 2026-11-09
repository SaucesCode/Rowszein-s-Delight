# Phase 1B — security audit and permission design

Date: 2026-11-09. Branch: `codex/phase-1b-security-audit`, based on reviewed Phase 1A.3 commit `dcf2500`.

**AUDIT/DESIGN ONLY — STOPPED FOR APPROVAL.** AUTH-01 and AUTH-02 remain open. No application authentication, authorization, frontend, dependency, schema or migration was changed. New files are audit tests/harness/evidence and documentation. No production environment was contacted, modified or deployed. Existing migrations were used only to construct owned disposable test databases. No new migration was generated; no session/revocation table or field was implemented.

## 1. Audit scope and actual results

Inspected CookieJWTAuthentication, login/logout/me, cookie issuance/deletion, User roles and Django flags, DRF defaults and all API permission declarations, routing, Axios/auth hooks, frontend route guards, current installed SimpleJWT behavior, refresh/expiry/revocation and throttling. The repository declares a browser-relative `/api` Vercel rewrite to a Render backend; no live site or production configuration was queried. The actual public frontend origin, proxy header trust and deployed cookie attributes remain unverified.

Tests use real signed **test-only cookie JWTs**, `APIClient(enforce_csrf_checks=True)`, HTTPS request metadata, valid and hostile Origins, matched/invalid/missing CSRF tokens and real database writes. They do not use force_authenticate or substitute the authenticator/permissions. Normal trusted-owner requests are positive controls. Existing Phase 1A business tests retain their own fixtures unchanged. A bounded twelve-attempt login probe runs only against synthetic local accounts.

| Suite | PostgreSQL 17.11 | SQLite |
| --- | --- | --- |
| Current-behavior controls/reproductions | 15 pass, 0 fail/error/skip | 15 pass, 0 fail/error/skip |
| Desired CSRF/session/throttle security contracts | **13 fail**, 0 pass/error/skip | **13 fail**, 0 pass/error/skip |
| Draft proposed role contracts, awaiting business approval | **13 fail**, 0 pass/error/skip | **13 fail**, 0 pass/error/skip |
| Existing Phase 1A regression suite | **120 pass**, 0 fail/error/skip | **103 pass**, 0 fail/error, **17 skip** |

The red suites are genuine failures, not expectedFailure tests or security passes. Their combined runner exits nonzero deliberately. Draft role failures demonstrate absent restrictions under the proposed matrix; they do not make unapproved business choices authoritative. [Selected results and source provenance](phase1b/audit-summary.json), [PostgreSQL evidence](phase1b/evidence/20261109-221807-postgres-29538fc4/summary.json), [SQLite evidence](phase1b/evidence/20261109-221803-sqlite-5fe6a85a/summary.json).

The unchanged frontend stock and pending-identity utilities also pass **10 + 12 checks** ([stock](phase1b/stock-regressions.txt), [identity](phase1b/identity-regressions.txt)). Browser/build were not rerun in this test-only audit; Phase 1A.3's build and 28 browser checks remain preserved, not claimed as new results. Future implementation must rerun them with the new authentication handshake.

Isolation reuses the Phase 1A.3 ownership-verified disposable profile unchanged: generated identities/credentials, loopback PostgreSQL, no persistent business-data mounts, dotenv discovery disabled and explicit target/owner verification before migration. Its marker label identifies that retained safety profile; the new metadata records **Phase 1B audit/design only**. New result capture writes only `docs/phase1b/`; no earlier evidence was overwritten. Both owned targets and their test databases were removed. Evidence excludes production credentials, database passwords, ownership tokens and raw JWTs; fixture accounts use synthetic test-only credentials.

## 2. Findings and existing protections

### AUTH-01 — confirmed high priority

`backend/accounts/authentication.py` reads an access cookie and validates the JWT/user, but never invokes CSRF validation. CsrfViewMiddleware is installed, yet the installed DRF APIView marks its callback csrf_exempt; the custom cookie authenticator must explicitly enforce CSRF. Login is AllowAny with no separate CSRF guard; logout has authentication but no CSRF guard. Axios sends credentials without an explicit Django CSRF handshake/header; its default XSRF cookie naming also does not match Django's csrftoken convention.

Observed: a hostile-Origin multipart/form expense POST without a CSRF token returns **201 and persists the expense**, despite no Access-Control-Allow-Origin response. Hostile login issues auth cookies; hostile logout clears them. Matched CSRF tokens do not cause hostile Origin rejection, and invalid/missing tokens are ignored. Browser SameSite/third-party-cookie behavior can affect delivery; these tests prove absent **server-side** checks when cookies arrive, not a penetration test of every deployed browser. Idempotency/revision headers incidentally complicate some cross-origin requests but are not a general CSRF control.

DRF explicitly distinguishes login CSRF from authenticated-only session checks. Django provides token validation, Origin checking and HTTPS Referer fallback; CORS does not replace these controls. [DRF authentication guidance](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication), [Django CSRF mechanism](https://docs.djangoproject.com/en/5.1/ref/csrf/), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### AUTH-02 — confirmed high priority

Business endpoints use IsAuthenticated or IsAuthenticatedOrReadOnly, without role-aware action permissions. `User.role` is admin/staff; neither Django is_staff nor is_superuser is the business role. The frontend ProtectedRoute only checks whether a user exists; no server-side business role matrix is enforced.

Observed staff requests successfully change product prices/recipes, adjust stock, edit/cancel their sales, create expenses, read financial summaries/margins/dashboard and export sales. Unknown roles and an admin downgraded to staff still reach owner-level operations. No unsafe business action should be authorized solely because a request is authenticated. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### Session/lifecycle review

| Area | Current source and observed behavior |
| --- | --- |
| Access/refresh | Access lifetime 60 minutes; refresh cookie 7 days. Both HttpOnly, Path=/, no explicit Domain. Source production defaults are Secure and SameSite=None; actual deployment was not read. Local test profile intentionally uses non-Secure/Lax. |
| Refresh | ROTATE_REFRESH_TOKENS=True but no refresh endpoint. Blacklist app is absent and BLACKLIST_AFTER_ROTATION remains false. Posting to `/api/auth/refresh/` returns 404. A refresh token placed in the access cookie is correctly rejected. |
| Logout | Correctly expires browser cookies but does not invalidate copied access tokens; copied cookie still accesses `/me`. |
| Expiry | Expired access tokens are correctly rejected. The same expired cookie also blocks valid re-login and logout before their handlers run, because default authentication runs even on AllowAny login. |
| Revoked users | Database user lookup already rejects inactive/deleted users. Preserve this. Existing tokens survive password change because CHECK_REVOKE_TOKEN is false. There is no durable logout/session revocation state. |
| Role changes | Current database user is fetched per request, a useful base for immediate permission changes; role is currently unused. Privilege promotion/reactivation needs a policy to avoid reusing an older still-valid UID token. That resurrection scenario is a source-based concern, not an additional executed case. |
| Throttling | No configured authentication throttle. Twelve wrong-password attempts all return 401, never 429. Default local-memory/non-atomic throttles would not be a complete multi-worker brute-force defense. |
| Account management | No public user/role-management route found; User is not registered in Django admin. Do not infer API owner rights from superuser status or silently promote existing accounts. |

Installed versions inspected: Django 5.1.4, DRF 3.15.2, SimpleJWT 5.3.1. The installed refresh serializer does not itself fetch/check the current database user; any future refresh flow must add active-user/session checks. Current upstream settings describe rotation/blacklisting, but configuration alone does not create a refresh route or revoke access JWTs. [SimpleJWT settings](https://django-rest-framework-simplejwt.readthedocs.io/en/stable/settings.html), [DRF throttling limitations](https://www.django-rest-framework.org/api-guide/throttling/).

## 3. Proposed CSRF and Origin design — not implemented

1. **Preserve cookie JWT architecture.** Continue HttpOnly auth cookies; do not put JWTs in JSON responses, localStorage or sessionStorage. Keep cookie-only authentication unless another transport is separately approved. An Authorization header must not silently bypass cookie CSRF rules.
2. **Bootstrap:** add safe GET `/api/auth/csrf/`, independent of JWT authentication so an expired cookie cannot block it. Use Django get_token/ensure_csrf_cookie, return a masked token as JSON, and use no-store/Vary: Cookie. Proposed CSRF cookie: host-only, Secure in HTTPS environments, HttpOnly, SameSite=Lax, Path=/. Token masking is framework-generated, not a custom token algorithm.
3. **Cookie-authenticated unsafe methods:** after token/user validation, reuse DRF's explicit CSRF enforcement (or equivalent Django CSRFCheck with a non-exempt callback), before permissions proceed to business logic, serializers or ledger writes. Simply adding middleware again or passing the csrf_exempt APIView callback to it is insufficient. Reject missing/mismatched tokens with structured **403 csrf_failed**.
4. **Login:** no access-cookie authenticator on the login view; explicitly apply CSRF/Origin checks to anonymous login before password validation. Valid expired-cookie re-login remains possible. Rotate the CSRF secret on successful login and return a fresh masked token (not JWTs), or immediately fetch bootstrap again. Active/known-role checks and throttling still apply.
5. **Logout:** explicitly CSRF-protect an idempotent logout path that can clear auth cookies even when access is expired/invalid. Do not let default authentication reject before cleanup. Revoke the current session when the selected lifecycle design supports it; clear cookies with matching paths/domains and rotate CSRF. Anonymous access to this cookie-clearing endpoint is not permission to perform business writes.
6. **Origin rules:** validate full scheme/host/port against a small exact allowlist. If Origin is present, reject foreign or null Origin even with a matching token. For HTTPS without Origin, use strict trusted Referer fallback; missing both fails closed. Development HTTP exceptions must be explicitly local and tested. Verify proxy TLS/Host handling before trusting forwarded headers. No wildcard deployment-preview or sibling-domain trust.
7. **Axios:** retain relative `/api` and credentials. Store only the masked CSRF token in memory; fetch bootstrap before login and unsafe cookie requests, add X-CSRFToken to approved API targets, and update it after rotation. HttpOnly CSRF cookies intentionally cannot be read directly by Axios. Never forward the token to arbitrary URLs.
8. **Failure/retry semantics:** distinguish 401 unauthenticated, 403 csrf_failed, 403 forbidden_role and 429 rate_limited. Only a proven pre-write csrf_failed may trigger one token-bootstrap retry, with the **same payload, UUID and revision**. No blind unsafe-request replay on generic 401/403/timeouts. Preserve Phase 1A's uncertain-request identity protection through login expiry, CSRF rotation and permission denial.

Preferred topology is the existing browser-relative same-origin `/api` proxy, with precise frontend Origin trust at the backend. Use host-only Secure/HttpOnly auth cookies and SameSite=Lax where this topology permits it. A genuinely cross-site deployment might require SameSite=None; that requires explicit topology approval and real-browser testing, not a blanket configuration change. If names/paths/prefixes change later, expire legacy cookies explicitly to avoid duplicate-name ambiguity.

CORS remains restricted and credential-aware; it does not grant authorization. Safe GET/HEAD/OPTIONS must not mutate business records, logout is POST, and TRACE remains unsupported. Apply no-store to auth and sensitive private responses. CSRF controls do not solve XSS or replace TLS and appropriate proxy trust.

## 4. Proposed owner/admin versus staff matrix — approval required

“Owner/admin” means active `role=admin`. It does **not** automatically grant Django admin-site access. Django is_staff/is_superuser must not silently grant business API owner rights. Unknown roles fail closed. The following is a conservative proposal, not an implemented policy:

| Resource/action | Anonymous | Staff — proposed | Owner/admin — proposed |
| --- | --- | --- | --- |
| Existing public product/category lists | Public-safe fields only | Read | Read/manage |
| Product/category detail | Deny, preserving current private detail boundary | Read | Read/manage |
| Create sale | Deny | Allow, current catalog price/current business date | Allow, including explicit historical/custom pricing under existing validators |
| Read sales | Deny | Own tracked sales only, across dates | All sales/history, including legacy |
| Edit sale / notes / cancel | Deny | Deny after recording; ask owner | Allow through existing transactional commands only |
| Sales/expense CSV/PDF exports | Deny | Deny | Allow |
| Stock/low-stock lookup | Deny | Operational projection: ID/name/unit/quantity/status; no costs/supplier/private notes | Full read |
| Create/edit/delete ingredient; adjust stock | Deny | Deny | Allow through existing safeguards/adjustment service |
| Recipes and ingredient costing | Deny | Deny | Read/manage; historical snapshots remain independent |
| Catalog/category writes, price, availability, images | Deny | Deny | Allow |
| Expenses | Deny | Deny | Read/manage/export |
| Dashboard, financial summary, margins | Deny | Deny | Allow |
| Self identity/login/logout | CSRF-protected login/logout/bootstrap as specified | Self only | Self only |
| User provisioning/role change | Deny | Deny | Controlled owner/technical-admin procedure; no new public route assumed |

Staff ownership can use the trustworthy InventoryOperation(sale_create).actor relationship; it must never be inferred for legacy sales. List/queryset filtering and object authorization both apply; unauthorized IDs should not leak another user's sale or count. Redacting UI buttons or applying permissions only to detail views is insufficient. Ingredient fields require an explicit staff serializer/projection and matching frontend handling; current full serializers must not leak private cost fields.

Price/date restrictions are **new staff-policy proposals**, not changes to original historical pricing. Validate new staff pricing/date intent inside the existing locked command path **after successful-operation replay checks**. A previously committed exact retry must still replay after catalog price/date changes; it must not rewrite history or re-deduct stock. Authorization for the current actor/action must precede returning stored sensitive replay results. No owner role bypasses legacy safeguards, stock sufficiency, revision checks, cancellation uniqueness or financial rules.

Public-list methods need explicit read-only permissions, private methods explicit role/action checks, staff list scoping and field-level projection. Read permissions also cover HEAD; CORS preflight must not expose sensitive schema or execute writes. Frontend navigation/guards reflect the same approved capabilities for usability; the backend remains authoritative.

The proposed global policy must deny **unmapped private actions**, rather than leave IsAuthenticated as an accidental permission fallback for a newly added endpoint. Public/auth exceptions must be enumerated explicitly. Review Django admin as an alternate business-data write path: normal business staff must not gain those writes through mismatched Django flags. Require approved business-admin identity plus the existing technical-admin permissions, or a separately documented break-glass policy. Keep ledger/history admin views read-only; owner status never authorizes raw stock/history rewrites.

## 5. Session/revocation and rate-limit choices

**Recommended lifecycle for approval:** access JWT 15 minutes; inactivity 30 minutes; absolute session 8 hours; logout current device; password change/account disable/role change revoke all sessions. No “remember me” in the first package. These durations are proposed operational choices, not OWASP/ISO mandates.

| Option | Behavior | Cost/approval implication |
| --- | --- | --- |
| A — minimal stateless JWT | Short access lifetime, no automatic refresh, stop issuing the unused refresh cookie; password-change validation can use the installed library facility | No new session schema, but copied access tokens remain valid until expiry after logout. Requires explicit risk acceptance; it would not satisfy the immediate-logout-revocation red contract. |
| B — recommended revocable device sessions | JWT linked to a durable per-device session; checked active/revoked/idle/absolute limits; refresh rotates with reuse detection and a bounded absolute deadline | Requires a separately reviewed exact session/revocation schema and migrations, cleanup/retention, backup/rollback and concurrency tests. No such model/field/migration is authorized or created by this audit. |

An all-device token-version field is a smaller possible alternative if logout-all-devices is acceptable, but cannot implement independent device logout. That business choice and any schema require approval. Refresh blacklist settings alone do not revoke already issued access tokens. A future refresh endpoint must be CSRF/Origin-protected, check the current active user/session, prevent token-family reuse and avoid extending the absolute session indefinitely. No automatic replay of a sale merely because refresh succeeded. Revocation applies to subsequent requests; already-running business transactions must finish atomically or roll back, never be partially “undone” by logout.

**Proposed login protection:** start with 5 failed attempts/account per 5 minutes plus 20 failures/IP per 5 minutes, progressive backoff, uniform invalid-credential responses and Retry-After on 429; no permanent account lockout. Confirm shared-terminal/NAT needs before implementation. Use normalized/HMACed account identifiers, verified client IP extraction and shared atomic counters/edge controls. Redis/edge infrastructure is a proposal requiring approval, not a deployed change. DRF throttles may supplement these controls but its cache-based non-atomic defaults are not a brute-force security boundary. CSRF/bootstrap/refresh endpoints need separate bounded limits and cache-outage behavior tests. [DRF throttling guidance](https://www.django-rest-framework.org/api-guide/throttling/).

## 6. Implementation packages after approval

1. **1B.1 CSRF transport:** implement explicit cookie/login/logout checks, safe bootstrap, Origin/Referer handling, structured JSON failures and Axios token lifecycle. No inventory model/math change. Cookie/topology decisions first.
2. **1B.2 approved RBAC:** central explicit capability/action permissions, known-role checks, staff query/field scopes, price/date policy and minimal route/navigation handling. No automatic promotion of existing Django superusers. Read-only account mapping/preflight before any approved role assignments; preserve user IDs referenced by audit records.
3. **1B.3 lifecycle/throttling:** implement the selected session/revocation design only after its separate schema checkpoint where needed; verify expiry, password/role/disable revocation, refresh reuse, logout and rate counters. Keep tokens/secrets out of logs.
4. **1B.4 controlled verification:** all approved security contracts green, unapproved draft rules revised transparently to the agreed policy, all Phase 1A tests preserved, real browser adversarial-origin tests, migration/rollback rehearsals only when authorized, build/lint and a final review stop. No deployment by implication.

## 7. Test strategy and protection of Phase 1A

- Test trusted Origin with good token, missing/invalid tokens, hostile/null Origin, HTTPS Referer fallback, missing both, simple form/JSON/multipart POST and PUT/PATCH/DELETE. Verify every rejection occurs before an operation identity, financial posting, inventory change or business row is committed.
- Test anonymous login CSRF, expired-cookie login/logout, rotation across tabs, protected bootstrap, logout cookie paths and optional refresh with expired access. Assert no auth tokens in JS-readable storage or JSON. Real browsers must exercise same-origin proxy and any separately approved cross-origin topology.
- Parameterize anonymous/staff/admin/unknown/inactive/deleted users, Django flag mismatches and role changes across every endpoint/method. Test own/other/legacy sale IDs, list/count/export leakage and staff cost-field omission; test valid owner actions as positive controls.
- Add an unmapped-endpoint deny test and alternate Django-admin write-path tests. Public catalog reads need explicit expired/invalid-cookie availability tests; do not make private failures fall back to anonymous authentication globally.
- Test staff price/date policy against stale product prices and exact idempotent replay; never recalculate historical sale prices from current catalog/recipes. Ensure CSRF/bootstrap/re-auth retries retain original UUID/revision/body through network loss and subsequent 400/401/403.
- Maintain the existing 120 Phase 1A regressions. Some current business fixtures default to staff while exercising owner-level edits/cancellation. **After matrix approval**, make their privileged fixture role explicitly admin without weakening stock/atomicity/history assertions, and add independent staff-denial/allowed-action coverage. Do not turn old assertions off to make RBAC pass.
- Repeat PostgreSQL races/exception injection with real cookie auth and valid CSRF, including revocation/permission denial versus sale and refresh races. Check exact ledger/basis/snapshot/financial invariants. Unauthorized idempotent replays must not disclose data; no owner bypass of invariants.
- Test rate-limit concurrency, distributed/shared counter behavior, spoofed forwarded IP, known/unknown users, shared NAT and cache outages. Capture 401/403/429 outcomes and no credential/token logs. No claim that one successful local throttle proves production attack resistance.

Audit reproduction: `backend/.venv/Scripts/python.exe -B docs/phase1b/run_audit.py --backend sqlite` or `--backend postgres`. These use existing schema only and create new evidence directories. A nonzero overall exit is expected while the unimplemented security contracts remain red. Do not run the old evidence-overwriting runners.

## 8. Risk-based security practices and residual risks

Following the risk-management approach described by [ISO/IEC 27001:2022](https://www.iso.org/standard/27001), maintain an owner-reviewed risk register rather than claiming compliance from a code patch:

| Risk | Asset/impact | Treatment and acceptance evidence | Responsible review |
| --- | --- | --- | --- |
| AUTH-01 | Financial/inventory integrity and account context | Mandatory CSRF + trusted origins; negative API/browser tests with zero writes | Technical maintainer implements; QA verifies; owner accepts topology |
| AUTH-02 | Unauthorized stock/pricing/financial actions and disclosure | Approved least-privilege matrix, object/field scopes, deny tests and periodic access review | Owner defines privileges; maintainer enforces; QA verifies |
| Token/session replay | Account access after logout/password/role changes | Explicit revocation/lifetime choice; session reuse and concurrency tests | Owner accepts UX/risk; separate schema approval if required |
| Credential guessing | Account confidentiality and service availability | Layered atomic/shared limits, monitored failures, bounded backoff | Operator validates infrastructure/NAT/proxy configuration |

Plan security events for login success/failure, CSRF/Origin denial, permission denial, role changes, session revocation and throttling, with bounded retention and access controls. Log reason/category, timestamp, actor/request correlation where appropriate; never passwords, JWTs, auth cookies or CSRF tokens. Define provisioning/deprovisioning, break-glass access, review responsibility and incident handling. This is project risk treatment, **not** an ISMS certification or full Annex A assessment.

Existing unsupported-dependency/security findings, full-project lint failures, TLS/proxy/deployment unknowns, XSS/upload/export issues and production data reconciliation remain separate backlog items. No unrelated dependency was upgraded, no production secret was requested and no migration/deployment was performed. Passing Phase 1A business tests does not close AUTH-01/AUTH-02.

## 9. Decisions requested before implementation

| Decision | Recommended proposal to approve or amend |
| --- | --- |
| D1 — owner identity | Business role=admin only; no implicit is_staff/is_superuser API promotion; explicitly review existing account mappings/provisioning. |
| D2 — staff sales authority | Create sales and read own tracked history; owner handles every recorded edit/cancellation, including notes. Decide if shared/all-sales visibility or staff corrections are required. |
| D3 — staff pricing/date | Current catalog price and current business date only; owner can make explicit custom/historical entries. Decide whether staff discounts/backdating are needed. |
| D4 — operational/financial access | Staff get limited stock quantities; no recipes/costs/suppliers/expenses/dashboard/margins/exports. Decide whether staff expense capture or broader reads are necessary. |
| D5 — browser topology | Keep relative same-origin `/api`; confirm exact public frontend/API origins and proxy TLS handling before final cookie/Origin settings. Public URLs only, no credentials. |
| D6 — session and login policy | Prefer revocable device sessions, 15-minute access/30-minute idle/8-hour absolute, current-device logout and all-device security-event revocation; approve initial rate limits/infrastructure or choose bounded-risk stateless option. Any new schema needs its own exact approval. |

**STOP:** approve or amend these decisions and the CSRF design before implementation. No security fix or business-role policy has been applied during this audit/design package.
