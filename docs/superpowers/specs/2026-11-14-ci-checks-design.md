# Automatic checks and the PostgreSQL tests: design

## Intent

Every push and pull request should run the same checks we run by hand before calling work done, so a broken build or failing test is caught before anything reaches `my-website` or a deploy.

The 17 backend tests that need a real PostgreSQL database have been skipped since the original disposable-database runner left the repository. They cover concurrency, locking and decimal precision, which are exactly what matter on the live Supabase database, so they should run again.

## Goals

1. A GitHub Actions workflow runs on every push and every pull request:
   - **Backend:**
     - the Django system check;
     - a check that no model change is missing a migration;
     - the full test suite on the in-memory SQLite settings.
   - **Backend on PostgreSQL:** the full suite against a throwaway PostgreSQL, so the 17 skipped tests run.
   - **Frontend:**
     - `npm ci`, then `tsc -b`, `eslint .` and `vite build`;
     - every `tests/regression/*.mjs` script.
   - **Dependency audit:** `pip-audit` on `backend/requirements.txt` and `npm audit --audit-level=high` in `frontend/`.
2. A local script runs the PostgreSQL suite the same way on the owner's PC, using Docker. CI and local runs use one code path.
3. If any of the 17 tests fail once they actually run, the code they guard is fixed test-first.

## Non-goals

- Deploying from CI, or deploy previews. Nothing deploys until the owner says so.
- Browser tests in CI. The Playwright checks stay a local step for UI work.
- Branch protection rules on GitHub. Those are a repository setting the owner can turn on later.

## Anti-goals

- **CI touching a real database or secret.** The tests must never read `backend/.env` or connect to Supabase. Every database is created by the run and destroyed after it.
- **Weakening the safety switch in `backend/test_settings.py`.** PostgreSQL tests stay refused unless the runner created the database itself.
- **A flaky gate that people learn to ignore.**

## Constraints

- **Versions:** Python 3.12 (matches the local venv) and Node 24. The regression scripts import `.ts` files directly, which needs Node's built-in type stripping.
- **The test-settings guard:**
  - PostgreSQL mode requires `ROWSZEIN_TEST_POSTGRES=1`;
  - the database name must match `rowszein_phase1a_[0-9a-f]{32}`;
  - the port must be 1024–65535;
  - the database runs on 127.0.0.1;
  - the test command is refused when `test` is in `sys.argv`, so the runner calls Django's test runner from code instead.
- **Scripts:**
  - Windows `.cmd` files keep CRLF and `.sh` files LF (per `.gitattributes`).
  - The new runner is Python so it works on both Windows and the Linux CI machines.
- **Repository:** github.com/SaucesCode/Rowszein-s-Delight. Workflows only run once pushed, and pushing waits for the owner.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **One Python runner, `scripts/test_postgres.py`, that starts its own throwaway Docker PostgreSQL in CI and locally.** | One code path. The guard's "only a database the runner created" promise holds everywhere. GitHub's Ubuntu machines include Docker. | **Chosen.** |
| A PostgreSQL service container in the workflow, plus a separate local script | Two ways to run the same thing that can drift apart, and a fixed database name in CI. | Dropped. |
| Remove the guard and point tests at any PostgreSQL | Easy, but one wrong environment variable could run tests against a real database. | Dropped: it breaks the anti-goal. |

## Design

### `scripts/test_postgres.py`

1. **Create the database.**
   - Generate the database name `rowszein_phase1a_<32 random hex>` and a random password.
   - Choose a free loopback port.
   - `docker run -d --rm` a container named `rowszein-test-<hex>`:
     - image `postgres:16-alpine` (the local playground uses Postgres 16);
     - `POSTGRES_PASSWORD` and `POSTGRES_DB` set to the generated values;
     - published on `127.0.0.1:<port>`.
2. **Wait up to 60 seconds** for `pg_isready` inside the container.
3. **Run the suite.** Start the backend venv's Python, or `python` in CI, with:
   - environment `ROWSZEIN_TEST_POSTGRES=1`, `ROWSZEIN_TEST_DB_NAME`, `ROWSZEIN_TEST_DB_PORT`, `ROWSZEIN_TEST_DB_PASSWORD` and `DJANGO_SETTINGS_MODULE=backend.test_settings`;
   - a small inline program that calls `django.setup()` and Django's `DiscoverRunner().run_tests([])`, so `test` never appears in `sys.argv`;
   - optional test labels passed through, so one app's tests can be run.
4. **Clean up.** Always stop the container, in a `finally` block, even after a failure or Ctrl+C.
5. **Exit** with the test run's exit code.
6. **Docker missing or not running:** say so plainly and exit non-zero. Don't hang.

### `.github/workflows/checks.yml`

- **Trigger:** `on: [push, pull_request]`. Running both on a pull request from the same repository is accepted.
- **Settings:**
  - `concurrency` cancels an older run on the same branch;
  - `permissions: contents: read`.
- **Jobs**, each on `ubuntu-latest` with a timeout:
  - `backend`: setup-python 3.12 with pip cache, `pip install -r backend/requirements.txt`, `manage.py check`, `manage.py makemigrations --check --dry-run`, then `manage.py test` (all with `--settings=backend.test_settings`).
  - `backend-postgres`: setup-python, pip install, `python scripts/test_postgres.py`.
  - `frontend`: setup-node 24 with npm cache, `npm ci`, `npx tsc -b`, `npx eslint .`, `npx vite build`, then a loop over `tests/regression/*.mjs` that fails on the first failure and names it.
  - `audit`: `pip install pip-audit && pip-audit -r backend/requirements.txt`, and `npm audit --audit-level=high` in `frontend/`. This job is separate, so a newly published advisory shows as its own red check without hiding the test results.
- **Actions** are pinned to major versions (`actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`).

### Docs

- README "Running the tests" gains the PostgreSQL command and a line about the checks.
- `docs/LOCAL_DEVELOPMENT.md` gets the Docker requirement for the PostgreSQL suite.

## Left to the builder

- How to choose the free port and how the runner script is internally structured.
- The exact workflow step names.
- How each of the 17 tests is fixed if it fails, test-first and within its original intent.
