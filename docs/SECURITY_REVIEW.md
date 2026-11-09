# Security review — Phase 0

Date: 2026-11-09. Source and isolated tests only; production penetration testing and operational controls were not assessed. No production credentials, configuration, deployments or data were changed.

## Highest priorities

| Priority | Evidence | Recommendation |
| --- | --- | --- |
| Critical | Invalid sale edits and insufficient-stock/delete cycles can inflate stock. Backend audit reproduces this with authenticated requests. | Validate first, use atomic transactions and precise historical movements; establish idempotency and PostgreSQL row locks. |
| High | Cookie JWT writes accept missing CSRF tokens and hostile Origin. Both PATCH and form-encoded expense POST succeed with `enforce_csrf_checks=True`. | Explicit CSRF and Origin protection for cookie-authenticated writes, including login/logout. Restrictive CORS alone does not validate form submissions. |
| High | Staff role has unrestricted authenticated business writes; test creates/deletes an expense as Staff. | Agree a least-privilege matrix, implement backend permissions and role-specific tests. Frontend route guards are only UX. |
| High | Django 5.1.4 is unsupported; pinned/runtime/CLI dependencies have scanner advisories. | Triage actual affected execution paths, then update compatible package groups with tests. Do not run forced automatic remediation. |
| Medium | Refresh cookie issued without refresh route; logout only removes cookies. No login throttle configured. | Define session continuity/revocation and rate-limiting policy; test expiry and revoked/deactivated users. |
| Medium | Model/admin writes bypass cost/stock positivity checks; current API rejects negative ingredient cost. | Add model/DB safeguards after approved existing-data validation; preserve errors rather than clamp. |
| Medium | CSV user fields are not formula-neutralized; unbounded CSV/PDF reporting; upload policy not documented. | Verify export formula behavior, PDF Unicode/wrapping, data-volume limits, image validation/resource limits. These exploit/rendering cases were not exercised. |
| Medium | Deployment check reports missing HTTPS redirect/HSTS; media only routed in DEBUG; static storage setting ineffective. | Verify reverse-proxy TLS/headers and persistent media, then propose environment-specific changes. Never enable HSTS blindly. |

## Existing useful controls

HttpOnly JWTs, environment-sourced SECRET_KEY, secure auth cookie default outside DEBUG, Django password validation/hashing, explicit CORS origins with credentials, authenticated defaults, model FK protection, serializer validation, ORM queries, and React's normal text escaping. No actual secret was found in inspected tracked configuration. This is not a Git-history secret scan or proof that deployment secrets are safe.

## Dependency scan scope and results

- [npm-audit.json](audit/evidence/npm-audit.json): 37 vulnerable package entries (1 critical, 17 high, 18 moderate, 1 low). Includes CLI/development/transitive chains. `proxy-addr` is the critical entry. Axios/router have advisories; applicability varies by browser/Node/RSC/SSR execution path. This project is a client SPA, so advisories specific to server-only APIs require reachability triage.
- [pip-audit.json](audit/evidence/pip-audit.json): **112 advisory entries across seven pinned direct packages**: Django 33, DRF 5, SimpleJWT 2, allauth 2, dotenv 2, Pillow 66, requests 2. Scan used `--no-deps --disable-pip`; transitive dependencies are **not** covered. Auxiliary audit packages are outside the application requirements.
- [npm-outdated.json](audit/evidence/npm-outdated.json): 29 outdated direct packages. [pip-outdated-environment.json](audit/evidence/pip-outdated-environment.json) includes the isolated tooling environment; 14 declared backend packages are outdated. “Latest” is a snapshot, not an upgrade recommendation.
- Raw scans contain advisory identifiers/links and suggested fixes. Counts are scanner matches, not confirmed attacks, unique attack surfaces, or proof of deployed exposure. Several npm suggestions include major changes/downgrades; review them manually.

## Environment and operational unknowns

Configured DB credentials/environment files were not requested or loaded from a production service. No deployment owner or current Render/Railway state was verified. Confirm database TLS, least-privileged DB user, backups and restore, media persistence, log redaction/retention, HTTPS redirects at edge, host/origin allowlists, proxy header trust, secret rotation, incident handling and account provisioning in an authorized environment.

There is no domain movement/audit log or sale actor today. Django admin logging does not replace API/business-event auditing. Custom User is not registered in admin; account-management and role assignment need a documented path.

## References and interpretation

The custom authenticator lacks the CSRF enforcement used for cookie/session-based unsafe requests. See [DRF authentication guidance](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication) and [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). HttpOnly protects cookie confidentiality from script access but does not independently prevent cookie-backed request forgery.

Support status and upgrade evaluation should follow [Django supported versions](https://www.djangoproject.com/download/) and its [security archive](https://docs.djangoproject.com/en/5.1/releases/security/). Configuration review follows the [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/). Re-check advisories when implementation begins.

This review supports selected risk-based practices requested under ISO/IEC 27001:2022. It is not an organizational ISMS audit, certification, or statement of complete compliance.
