# Package 1B.1 — CSRF implementation review checkpoint

Date: 2026-11-09. Branch: `codex/phase-1b1-csrf`, isolated from audit commit `d88f8c7`.

**CSRF controls are implemented and verified locally. STOPPED for owner review before Package 1B.2.** This is not a production-readiness claim. AUTH-02, session revocation, login throttling, dependency findings and deployment verification remain open. The approved D1–D4 role policies have not been implemented in this package. D6 still requires exact session schema/infrastructure approval.

## Implementation

`GET /api/auth/csrf/` uses Django `get_token()` to return a 64-character masked token in `data.csrf_token`. The corresponding host-only, root-path CSRF cookie is HttpOnly, SameSite=Lax and Secure when DEBUG is false. Bootstrap ignores malformed/expired JWT cookies, issues no JWT, and uses `Cache-Control: no-store` and `Vary: Cookie`. No persistent token/session record is introduced.

Cookie JWT authentication validates the access token/current user, then explicitly calls DRF's `CSRFCheck` using Django's Origin, Referer and cookie/token validation before entering a write view. POST/PUT/PATCH/DELETE require verification; safe reads do not require a token. An Authorization header cannot bypass CSRF for an authenticated cookie. Missing/invalid/expired authentication still produces 401 before business writes. Existing inactive/deleted-user checks remain in the JWT authenticator.

Anonymous login and logout explicitly enforce CSRF independently of JWT authentication. This prevents an expired or malformed access cookie from blocking a legitimate login or cookie cleanup. Successful login rotates the CSRF secret; logout clears both existing JWT cookies, rotates CSRF and can be repeated with the updated token. Both return a masked token in top-level `csrf_token`, which the transport adopts. JWTs remain in HttpOnly cookies, never response JSON or browser storage. Auth responses are non-cacheable. Logout still does **not** revoke copied tokens server-side.

Same-origin requests are checked against Django's request host; explicitly trusted Origins use exact configured scheme/host/port. HTTPS without Origin uses Django's strict Referer checks. HTTP loopback writes require an explicit valid Origin; a missing Origin fails closed. Configuration strips empty entries and rejects wildcard origins, credentials, paths, query/fragment, malformed ports and remote HTTP origins. No production origin was invented. CORS remains credential-aware and separately restricted; it is not a CSRF bypass.

Axios continues using browser-relative `/api` and credentials. The new transport:

- Bootstraps masked tokens into memory with one shared pending bootstrap for concurrent requests; no JWT/CSRF token persistence.
- Adds `X-CSRFToken` to unsafe requests, including JSON and multipart callers. Rejects destinations outside the same-origin `/api/` path before dispatch.
- Adopts login/logout rotation and prevents a late bootstrap from replacing an already adopted newer token.
- Allows **one** recovery attempt only for a 403 explicitly marked `csrf_failed, retryable: true`. Origin/Referer failures are non-retryable. Recovery reuses the original Axios config, serialized body, operation UUID and revision.
- Never automatically replays writes after 401, generic 403, 429, network failure or 5xx. The CSRF retry is justified because the server check precedes write handlers; the existing durable business identities remain the duplicate-write defense.
- Preserves pending sale/stock UUIDs across first and subsequent 401/403/429 failures. Successful login clears cached account/business data, while actor-scoped operation intents survive for explicit same-user recovery. Existing 400/404/non-identity-conflict 409 handling remains conservative about earlier attempts.

API errors distinguish 401 `authentication_required` (or login `invalid_credentials`), 403 `csrf_failed`/`forbidden`, and 429 `rate_limited`, with no-store/Vary headers. A future DRF Throttled response retains Retry-After and includes `retry_after`; **no rate limiter was installed**. Existing business validation/stale-conflict UI messages are preserved. Native browser form requests may receive DRF's negotiated HTML 403; JSON API clients receive the structured JSON envelope. This was tested without changing browser form Origin or Accept headers.

## Actual before/after results

The original `docs/phase1b/security_cases.py` and all 13 desired assertions are unchanged. Fresh pre-implementation reproductions failed **13/13 with zero errors on each engine**:

- [PostgreSQL before](phase1b1/evidence/20261109-225742-postgres-before-33f7a5ca/original-security-13-before.json)
- [SQLite before](phase1b1/evidence/20261109-225734-sqlite-before-4c5a05c3/original-security-13-before.json)

Both engines now give identical outcomes:

| Original desired security check | After | Scope |
| --- | --- | --- |
| Invalid CSRF cookie write denied | Pass | 1B.1 |
| Missing CSRF cookie write denied before persistence | Pass | 1B.1 |
| Expired cookie permits valid re-login | Pass | 1B.1 |
| Expired-cookie logout clears browser authentication | Pass | 1B.1 |
| Hostile Origin denied even with matching token | Pass | 1B.1 |
| HTTPS missing both Origin and Referer denied | Pass | 1B.1 |
| Hostile-Origin login denied | Pass | 1B.1 |
| Missing-token login denied | Pass | 1B.1 |
| Logout invalidates copied access cookie | **Fail** | Deferred 1B.3 revocation; copied cookie still returns 200 |
| Hostile-Origin logout denied | Pass | 1B.1 |
| Missing-token logout denied | Pass | 1B.1 |
| Password change invalidates existing access cookie | **Fail** | Deferred 1B.3 revocation; old cookie still returns 200 |
| Repeated bad logins are rate limited | **Fail** | Deferred 1B.3; twelve attempts still return 401, not 429 |

Actual after evidence: [PostgreSQL 10 pass/3 fail](phase1b1/evidence/20261109-230345-postgres-all-657c19c2/original-security-13-after.json), [SQLite 10 pass/3 fail](phase1b1/evidence/20261109-230340-sqlite-all-4709171c/original-security-13-after.json). These three failures remain visible, unskipped release issues; the overall backend runner returns exit 1. They have not been marked resolved or replaced by passing arithmetic/transport tests.

| Suite | PostgreSQL | SQLite |
| --- | --- | --- |
| New real-cookie CSRF/API/transport regressions | **26 pass**, 0 failures/errors | **26 pass**, 0 failures/errors |
| Existing complete Phase 1A business suite | **120 pass**, 0 failures/errors/skips | **103 pass**, 0 failures/errors, **17 concurrency skips** |
| Unimplemented role requirements | **13 fail**, 0 errors | **13 fail**, 0 errors |

Logs and per-test results: [PostgreSQL selected run](phase1b1/evidence/20261109-230345-postgres-all-657c19c2/summary.json), [SQLite selected run](phase1b1/evidence/20261109-230340-sqlite-all-4709171c/summary.json). The PostgreSQL suite includes the existing competing-sale, duplicate-operation, stale-revision, exception-injection, changed-recipe, fractional allocation, legacy and financial contracts. No business fixture or assertion was changed for this package. These are real PostgreSQL 17.11 tests under READ COMMITTED, not SQLite concurrency claims.

The 26 new checks include bootstrap/cache/cookie flags; rotation; login/logout with invalid cookies; every unsafe method; missing/malformed cookie/header; null/lookalike/hostile Origin; secure Referer fallback and failures; explicit HTTP Origin; form tokens versus unsupported JSON-body token; bearer-header non-bypass; unauthenticated/invalid-JWT 401; and exact same-UUID/revision recovery for sales and stock adjustments. Rejection assertions compare all rows/values across Sale, SaleItem, Product, Recipe, RecipeIngredient, Ingredient, Expense and all five ledger models, and check that auth cookies were not issued on rejected authentication.

Frontend: **14 transport + 13 identity + 10 stock utility checks pass**. TypeScript/Vite build and affected-file lint pass. Full-project lint remains **12 pre-existing errors/16 warnings**, exit 1; existing CSS import-order and bundle-size build warnings remain. [Final frontend logs](phase1b1/evidence/20261109-231430-frontend-e0b74bc3/summary.json).

The previous 12-case identity script/evidence is preserved verbatim. Its first-attempt 401/403-clears-identity expectation is superseded by the explicitly approved D5 retention policy. The versioned 13-case script retains the other assertions and adds first-attempt authentication/CSRF/rate-limit retention; this strengthens retry safety. Historical audit characterization tests that assert insecure behavior are also preserved as audit evidence, not reused as acceptance criteria.

## Browser evidence and reconciliation

**44 checks pass, zero uncaught page errors**, in real headless Edge through React → same-origin local Vite proxy → Django → fresh PostgreSQL. [Checks, HTTP outcomes and database reconciliation](phase1b1/evidence/20261109-231541-postgres-browser-a897ef0a/browser.json), [readable log](phase1b1/evidence/20261109-231541-postgres-browser-a897ef0a/browser.txt). Expected console HTTP errors from deliberate negative tests and a simulated connection reset are retained, not misreported as a clean console. External requests were blocked; no external request was attempted in this successful run.

Verified behavior includes:

- Real login, masked-token handling, rotation, valid-cookie logout, expired-access logout clearing both JWT cookies, expired-access re-login and malformed-access re-login.
- Missing-token cookie-authenticated expense POST → **403**, exact business snapshot unchanged.
- Native HTML forms from a separate untrusted loopback Origin submit a **valid token with an attached JWT cookie** to logout and expenses → **403**; cookies and all business state remain unchanged. This proves Origin rejection rather than relying on CORS, absent cookies or a bad token.
- A deliberately corrupted first sale CSRF header → **403 before writes**. The real Axios client bootstraps and retries the same UUID/payload → 201. The test then loses that 201 response after server commit. Reload, conflicting-payload rejection, invalid-cent rejection and exact retry still produce just one sale/deduction.
- Real sale edit, independent concurrent edit, stale revision rejection, cancellation, one-quantum stock adjustment and insufficient-stock rejection continue working.
- An expired access token on a first sale attempt → **401, no writes, pending UUID retained**. Re-login does not auto-replay. Explicit same-owner resubmission uses the original UUID and creates one sale, followed by exact cancellation for reconciliation.

Concrete unchanged inventory/financial behavior from that browser run:

| Action | Flour stock, kg | Financial effect |
| --- | --- | --- |
| Synthetic opening stock | 20.000000000 | None |
| Missing/hostile/stale-CSRF rejections | 20.000000000 | No sale, movement, operation or posting |
| Sale 1, recipe 0.01 kg / 3, quantity 1 | 19.996666667 | Gross +50.00 |
| Lost-response replay/conflict/validation rejection | 19.996666667 | No additional posting/deduction |
| Edit quantity 2 at 45.25 | 19.993333333 | Adjustment +40.50, current total 90.50; original 50.00 retained |
| Cancel sale 1 | 20.000000000 | Cancellation −90.50; net 50.00 + 40.50 − 90.50 = **0.00** |
| Explicit stock adjustment | 20.000000001 | +0.000000001 kg observed correction; no refund |
| Expired-auth sale rejection | 20.000000001 | No business write |
| Same-UUID recovered sale 2 and exact cancellation | 20.000000001 finally | Gross +50.00 and cancellation −50.00 |

Both sales and original line items remain retained. Final signed postings total **100.00 gross + 40.50 adjustments − 140.50 cancellations = 0.00 net**; cancellation is not a cash refund. The existing `assert_reconciled` database checks pass. No historical allocation was redistributed or reconstructed.

Screenshots reviewed: [reconciled dashboard](phase1b1/evidence/20261109-231541-postgres-browser-a897ef0a/browser-dashboard-reconciled.png), [retained cancellation](phase1b1/evidence/20261109-231541-postgres-browser-a897ef0a/browser-cancelled-history.png). No page redesign was performed.

## Isolation, preservation and unsuccessful attempts

Only newly owned SQLite files and generated PostgreSQL containers/databases were used. The harness validates ownership markers, loopback ports, database/user identity, container labels, no persistent mounts and an empty dotenv repository before database access. PostgreSQL data lives in tmpfs. Existing additive migrations were applied **only to these disposable targets**; no new migration was created or changed. HTTP loopback cookie overrides and fast password hashing belong exclusively to the ownership-verified test profile; application CSRF checks stay enabled. The reused safety marker retains its Phase 1A.3 profile label, while each run's environment records `package: 1B.1 CSRF only` separately.

All completed targets were removed; [PostgreSQL cleanup](phase1b1/evidence/20261109-230345-postgres-all-657c19c2/cleanup.json), [SQLite cleanup](phase1b1/evidence/20261109-230340-sqlite-all-4709171c/cleanup.json), [browser cleanup](phase1b1/evidence/20261109-231541-postgres-browser-a897ef0a/cleanup.json). Browser processes were hidden, exclusive loopback ports were checked, and only owned process trees/targets were removed. No production data or credentials were accessed; no deployment/push occurred.

Read-only static provenance checks compare all prior evidence/reports, migrations and inventory/business source files to `d88f8c7`. Only the living project status/changelog are intentionally updated. [Machine-readable summary](phase1b1/verification-summary.json) links the selected runs and static result. Both approved ledger migration SHA-256 hashes remain unchanged:

```
ingredients/0004_inventory_integrity.py
6b16f329b58d1dd2385c053f8bda98466f77f2483eafa275a6d66f810ef4843c
sales/0003_inventory_integrity.py
56b12876f54896011f31b8c089bf0553e6f5c047481eaddba7eb25d6502cff14
```

Unsuccessful attempts are retained under `phase1b1/evidence/`: initial backend import-cycle startup failures; browser test-server Windows environment failure; test-only ORM use in Playwright's event loop; an existing stale-error message mismatch; and JSON parsing of a correctly rejected native form's negotiated HTML. The import cycle was fixed using a lazy exception-handler import. The browser harness uses a synchronous ORM worker without disabling Django's async guards. Business message behavior was preserved and tests distinguish native forms from JSON mutation tracing. One failed trace's synthetic CSRF form value was redacted; its failed outcome is unchanged. Final selected runs above are complete; no partial run is counted as passing.

## Changed files

Application backend:

- `backend/accounts/security.py` — explicit CSRF enforcement and API exception envelope.
- `backend/accounts/origin_config.py` — exact-origin configuration validation.
- `backend/accounts/authentication.py` — cookie-authenticated write enforcement.
- `backend/accounts/views.py` — bootstrap, independent login/logout checks, rotation, cache policy.
- `backend/accounts/urls.py` — bootstrap route.
- `backend/backend/settings.py` — handler, host-only CSRF cookie and exact origin configuration.

Application frontend:

- `frontend/src/lib/csrfTransport.ts` — memory token lifecycle, same-origin transport, bounded recovery, readable security errors.
- `frontend/src/services/api.ts` — relative bootstrap with same-origin credentials/no-store/no redirects.
- `frontend/src/lib/operationIdentity.ts` — retain pending UUIDs across authentication/CSRF failures.
- `frontend/src/hooks/useAuth.ts` — account cache transition and structured errors.
- `frontend/src/hooks/useSales.ts`, `useIngredients.ts` — security error display while retaining intent.

Verification: `docs/phase1b1/{csrf_regressions.py,test_csrf_transport.mjs,test_operation_identity.mjs,browser_checks.py,run_checks.py,run_frontend.py,verification_settings.py,result_runner.py,static_review.py,summarize_results.py,README.md}`, `verification-summary.json` and timestamped evidence. Documentation: this report, `README.md`, `docs/PROJECT_STATUS.md`, `docs/CHANGELOG.md`. No model, field, constraint, index, migration, dependency, lockfile, business command or reporting formula changed.

## Remaining risks and next review

1. **AUTH-02 is unresolved.** All 13 role contracts remain red. D1–D4 are approved policies, not deployed permissions. After owner review of 1B.1, Package 1B.2 should enforce active `role=admin` owner identity, staff own-sale scoping, no staff edits/cancellation, catalog/current-Manila-date rules, sensitive-field projections, public-safe exceptions and default denial across APIs/admin/exports/replays. Authorize before returning sensitive stored replay data, but preserve successful same-intent replay after catalog changes. Adapt privileged business fixtures explicitly only when RBAC implementation is authorized; retain all integrity assertions.
2. **Session revocation/throttling remain unresolved.** Access remains 60 minutes; unused refresh cookie remains 7 days; no refresh endpoint was added. Logout only removes browser cookies; password changes do not revoke copied access JWTs. Deactivated/deleted users are rejected on subsequent authenticated requests by existing checks. Role changes have no new session revocation. Present the exact durable device-session schema/concurrency/retention/rollback and shared atomic rate-limit infrastructure separately before 1B.3. No in-memory throttle is represented as distributed protection.
3. **Deployment topology remains unverified.** Before any later deployment, verify actual public scheme/host/port, Host preservation and trusted TLS termination. Prefer the approved same-origin proxy. Do not add wildcard trust or spoofable forwarded-header trust. Confirm Secure/HttpOnly/SameSite flags and repeat browser tests using the real HTTPS topology. Local Vite with `changeOrigin` requires the exact browser Origin configured; e.g. a chosen localhost development port may be explicitly trusted, not inferred. Non-browser cookie writers must acquire/send CSRF and satisfy source checks.
4. **Other prior security/dependency and code-quality findings remain open.** Installed Django 5.1 is unsupported; no unrelated dependency update was authorized. Existing lint/build warnings, XSS/upload/export and operational risks are not resolved by CSRF. Neither production data reconciliation nor production security verification occurred.
5. Maintain the risk register and review responsibilities: AUTH-01 local treatment evidence is ready for owner acceptance; maintainer/QA must preserve it through RBAC; owner/operator must accept verified topology and future session controls. Log CSRF denial categories without tokens/passwords. Define retention, monitoring, access reviews and incident procedures as separate operational work.

The implementation uses [Django's supported CSRF mechanism](https://docs.djangoproject.com/en/5.1/ref/csrf/), explicit login protection following [DRF's authentication guidance](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication), and framework tokens plus source validation consistent with [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). The documented risk treatment/review approach follows the purpose of [ISO/IEC 27001:2022](https://www.iso.org/standard/27001); this is not a certification or full ISMS assessment.

**Next action is owner review of Package 1B.1. Package 1B.2 has not begun.**
