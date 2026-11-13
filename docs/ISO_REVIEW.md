# ISO standards review: Rowszein's Delight

**Date:** 13 November 2026 · **Branch:** `codex/phase-b2-products-ingredients` · **Scope:** online shop, management app, Django API

This is a technical self-review of the system against four standards, based on evidence gathered from the code, automated tools and browser testing. It is not a certification. Two standards in particular cannot be "passed" by software alone:

* **ISO/IEC 27001** certifies an organisation's information security management system (policies, risk assessment, people, suppliers). This review covers only the technical controls in its Annex A / ISO/IEC 27002 that software can provide.
* **ISO/IEC 25010** and **ISO 9241-11** are normally scored with real users (for example a questionnaire with owners, staff and customers). This review covers what can be checked technically; the user evaluation is listed under "Still to do".

## Summary

| Standard | Result | Main reasons |
| --- | --- | --- |
| ISO/IEC 40500 (WCAG 2.0, checked to WCAG 2.2 AA) | **Strong: 1 issue** | Automated scan of 18 screens found one contrast failure; keyboard, focus, motion and touch targets verified |
| ISO 9241 (usability) | **Good, not yet user-tested** | Dialogue principles largely met; no testing with real users yet |
| ISO/IEC 25010 (software quality) | **Mixed** | Well structured and maintainable; photo storage, failing sales tests and outdated packages pull reliability and security down |
| ISO/IEC 27001 / 27002 (security controls) | **Needs work before launch** | Good sign-in and access design, but 115 known vulnerabilities in backend packages, an end-of-life Django version, and missing production hardening |

## Evidence collected

| Check | Result |
| --- | --- |
| Accessibility scan (axe-core 4.10, WCAG 2.0/2.1/2.2 A and AA) on 18 screens: shop (desktop and phone), sign-in, 13 owner screens, 2 staff screens | 1 violation (contrast of the shop's box-lid lettering, 3.26:1, needs 4.5:1). 20–28 rules passed per screen |
| Frontend type check, lint, production build | All pass; lint has zero problems |
| Frontend regression scripts (`tests/regression/*.mjs`, 8 files) | All pass |
| Backend box tests (16) on a temporary in-memory database | All pass |
| Full backend test suite (137) | 52 failures and 5 errors, all in older sales tests (HTTP 401). They fail the same way without recent changes |
| `npm audit` (frontend) | 10 known vulnerabilities (9 high) in axios, react-router, vite, zod, postcss and others; all have non-breaking fixes |
| `pip-audit` (backend `requirements.txt`) | 115 known vulnerabilities in 7 packages: Pillow 10.4.0 (69), Django 5.1.4 (33), djangorestframework (5), requests, python-dotenv, simplejwt, django-allauth (2 each) |
| `manage.py check --deploy` (production-style settings) | 2 warnings: no HSTS (`SECURE_HSTS_SECONDS`), no HTTPS redirect (`SECURE_SSL_REDIRECT`) |
| Unused backend packages | django-allauth, django-filter, requests and python-dotenv are installed but not used |
| Production bundle | Main JavaScript 333 kB (104 kB compressed); pages load on demand (shop 44 kB) |

## ISO/IEC 40500 · WCAG accessibility

**Meets, apart from one issue.**

* Contrast: colour tokens were chosen for 4.5:1 text and 3:1 controls; the scan confirms this everywhere except the gold lettering on the raspberry box lid in the shop hero.
* Keyboard: every control is reachable in a logical order with a visible focus ring; dialogs trap focus and return it on close; a "Skip to the donuts" link is provided.
* Touch targets: all buttons and links are at least 44×44 px (WCAG 2.2, 2.5.8).
* Motion: every animation is turned off or reduced when the visitor asks for reduced motion (2.3.3), and content never stays hidden if animation does not run.
* Forms: every field has a label; errors appear next to the field in plain words and are linked to it; input is never lost.
* Status messages: additions to the order, box progress and saves are announced through live regions (4.1.3).
* Language: the page declares English (`lang="en"`).

**Not yet checked:** a session with a real screen reader (NVDA or VoiceOver) and with 200–400 % zoom.

## ISO 9241 · usability (parts 11, 110 and 210)

Against the interaction principles of ISO 9241-110:

| Principle | How the system meets it | Gap |
| --- | --- | --- |
| Suitability for the task | Each screen is built around its job (register, pantry, box builder); the main action is visible without scrolling | None found |
| Self-descriptiveness | Plain English labels and status ("7 of 12: tap 5 more", "Not full: shop hides it") | — |
| Conformity with user expectations | Consistent buttons, wording and back links; prices in pesos and Manila time | English only; no Filipino option for customers |
| Learnability | Short help text next to fields; "How ordering works" on the shop | — |
| Controllability | Undo and "Put it back" after clearing; cancel and back everywhere | — |
| Use error robustness | Inline validation; save disabled until a box is full; "Leave without saving?" guard; confirmation before deleting | — |
| User engagement | Pâtisserie styling, purposeful motion | — |

**Gaps:** ISO 9241-210 (human-centred design) expects real users to be involved and the design evaluated with them, and ISO 9241-11 measures effectiveness, efficiency and satisfaction. Neither has been done with Rose, staff or customers yet.

## ISO/IEC 25010 · software product quality

| Characteristic | Rating | Evidence and gaps |
| --- | --- | --- |
| Functional suitability | Good | Shop, boxes, register, pantry, recipes, expenses and analytics work end to end in browser tests. **Gap:** donut photos are not served in production (see Reliability) |
| Performance efficiency | Good (not measured live) | Pages load on demand; lists are paginated; ready-made boxes load their donuts in two queries. **Gap:** Core Web Vitals (LCP, INP, CLS) not yet measured on the live site |
| Compatibility | Good | Standard React and Django; newer effects (scroll-linked animation) are skipped by browsers without support |
| Interaction capability (usability) | Good | See the ISO 9241 section |
| Reliability | Needs work | Idempotency keys and revision checks protect sales and stock from double submits. **Gaps:** uploaded photos are saved to the server's own disk and only served when `DEBUG` is on, so they do not load in production and may be lost on redeploy; 52 sales tests fail; no confirmed database backup plan |
| Security | Needs work | See the ISO/IEC 27002 section |
| Maintainability | Good | Typed frontend, zero lint problems, design tokens in one file, small modules, documentation in `README.md` and `docs/`. **Gap:** the repository's own test runner was removed, so backend tests cannot be run the approved way |
| Flexibility (portability) | Fair | Configuration through environment variables; Vercel + Render. **Gap:** no repeatable deploy script in the repository (for example running migrations on Render) |

## ISO/IEC 27001 Annex A / ISO/IEC 27002 · technical controls

| Control | Status | Evidence |
| --- | --- | --- |
| 5.15 / 8.3 Access control | Meets | Every API action maps to an explicit capability checked on the server; anything unmapped is refused, even for the owner. Staff get read-only projections without costs |
| 8.5 Secure authentication | Meets | HttpOnly, SameSite cookies; CSRF tokens on writes; exact allowed origins; login rate limits; device sessions with revocation and refresh-reuse detection; Django password validators |
| 8.24 Use of cryptography | Partly | HTTPS on Vercel and Render. **Gap:** HSTS and HTTPS redirect not set in Django |
| 8.8 Technical vulnerability management | **Does not meet** | 115 known vulnerabilities in backend packages and 10 in frontend packages. Django 5.1 is past its end of security support |
| 8.9 Configuration management | Partly | Secrets come from environment variables and `.env` is not committed. **Gaps:** unused packages installed; admin at the default `/admin/` address |
| 8.12 / 8.11 Data leakage, masking | Meets | Public and staff responses omit costs and supplier data; the public shop never sends credentials |
| 8.13 Information backup | Not evidenced | No backup or restore procedure documented for the Render database |
| 8.15 / 8.16 Logging and monitoring | Partly | Security events (sign-ins, lockouts, session revocation) are logged in code. **Gap:** no `LOGGING` setting, so informational events may not be kept anywhere |
| 8.26 Application security requirements | Partly | Inputs validated on the server (prices, box fills, stock). **Gaps:** uploaded photos have no server-side size or type limit; no Content-Security-Policy header |
| 8.28 Secure coding | Meets | Parameterised ORM queries, no raw SQL in new code, validation at the API boundary |
| 8.29 Security testing | Partly | Permission and validation tests exist. **Gap:** 52 sales tests failing; no automated dependency audit |
| 8.31 Separation of environments | Meets | Local development database separate from production |

## What to fix, in order

**Before launch**

1. Upgrade backend packages: Django to the current 5.2 LTS release, Pillow, Django REST Framework, simplejwt and requests. Remove the four unused packages. Re-run all tests.
2. Run `npm audit fix` in the frontend (non-breaking fixes) and rebuild.
3. Store donut photos in cloud storage (for example Cloudinary or S3) so they survive redeploys and load in production.
4. Make sure Render runs `python manage.py migrate` on every deploy.
5. Turn on HSTS and the HTTPS redirect in production settings.
6. Fix the box-lid lettering contrast in the shop hero.

**Soon after**

7. Add a `LOGGING` setting so security events are kept.
8. Limit photo uploads on the server (size and image type).
9. Add a Content-Security-Policy header on Vercel.
10. Repair or retire the 52 failing sales tests, and restore a supported way to run backend tests.
11. Write down the database backup and restore steps.

**With real users**

12. Usability test with Rose, a staff member and two or three customers (ISO 9241-210 and -11), and record task success, time and satisfaction.
13. Test with a screen reader and at 200–400 % zoom.
14. Measure Core Web Vitals on the live site.

## Progress

* **Fix 1 done (13 November 2026):** Django 5.1.4 → 5.2.19 (LTS, supported to April 2028), djangorestframework 3.15.2 → 3.18.3, djangorestframework-simplejwt 5.3.1 → 5.5.1, Pillow 10.4.0 → 13.0.0. Removed unused django-allauth, django-filter, requests and python-dotenv. `pip-audit` now reports no known vulnerabilities; `manage.py check` is clean; no new migrations are needed; the full test suite gives the same result as before the upgrade (box tests pass; the 52 older sales failures and 5 errors are unchanged).
* **Fix 2 done (13 November 2026):** `npm audit fix` updated axios (1.21.1), react-router-dom (7.18.5), vite (8.3.8), zod (4.6.7), postcss and others within their current major versions. Production dependencies: **0 known vulnerabilities**. Ten moderate advisories remain in ESLint and typescript-eslint, which run only on developers' machines and are not shipped; npm's suggested fix would downgrade ESLint, so they are accepted for now. Type check, lint, build, the 8 regression scripts and a browser check of the shop, sign-in and owner pages all pass.
* **Fix 3 done (13 November 2026):** Uploaded donut and ingredient photos are stored on Cloudinary when its three keys are set, through a small storage adapter built on Cloudinary's official SDK (`backend/media_storage.py`); photos are served over HTTPS in the visitor's best format at up to 800 px wide. Upload failures return a plain 503 message instead of an error page. The server now rejects photos over 5 MB or not JPG, PNG or WEBP (also closes part of fix 8). The removed `STATICFILES_STORAGE` setting (ignored since Django 5.1) was replaced with `STORAGES`, so WhiteNoise compression applies again. `backend/.env.example` now documents every setting. Eight new tests pass; the full suite result is otherwise unchanged. **Still needed:** a Cloudinary account and its keys on Render; photos uploaded before this change need uploading again.
* **Fix 5 done (13 November 2026):** production now redirects HTTP to HTTPS (`SECURE_SSL_REDIRECT`, on by default, can be switched off from the environment if a health check needs plain HTTP) and sends HSTS for one year including subdomains. Preloading is deliberately not requested because it is effectively permanent (`security.W021` silenced with that reason). `manage.py check --deploy` with production defaults: no issues. Test settings turn the redirect off so tests keep using plain HTTP.
* **Fix 6 done (13 November 2026):** the shop's box lid is now deep raspberry (`--color-accent-pressed`), so its gilt lettering has 5.03:1 contrast. axe-core on the shop: 0 WCAG 2.2 AA violations.
* **Fix 10 done (13 November 2026):** the 52 failing and 5 erroring backend tests had one root cause. Sales and stock commands re-check the caller's live device session (`require_session`, added in Phase 1B.3), but the older tests signed in with DRF's `force_authenticate`, which creates no session, so every request was refused with 401 before reaching the code under test. The tests now sign in through `accounts/session_fixtures.py`, which creates a real device session, cookies and CSRF token as the project's original Phase 1B.3 adapter intended; no test assertion changed. `backend/test_settings.py` now allows tests on its in-memory SQLite database (still refusing `migrate` and PostgreSQL), carries test-only signing keys instead of reading `.env`, and documents the command. Result: **144 tests pass**, 17 PostgreSQL-only tests skipped.
