# Rowszein’s Delight local development on Windows

Use [the React app](http://127.0.0.1:5174/) and [sign in](http://127.0.0.1:5174/login) with the local owner or staff credentials in `backend/.env`. Look for `ROWSZEIN_LOCAL_OWNER_*` and `ROWSZEIN_LOCAL_STAFF_*`. Keep this Git-ignored file on this machine. It contains the development database password, Django secret, session signing key, and rate-limit key.

## Start

Open Docker Desktop and wait for the local Linux engine. In one **Command Prompt** window, start PostgreSQL and Django.

```cmd
cd /d "C:\Users\CARE MBA\Desktop\Rowszein-s-Delight"
docker --context desktop-linux start rowszein-playground
docker --context desktop-linux exec rowszein-playground pg_isready -h 127.0.0.1 -p 5432 -d rowszein_dev
scripts\django-local.cmd
```

If PostgreSQL reports it is starting, repeat `pg_isready` until it accepts connections, then start Django. In a second **Command Prompt** window, start React.

```cmd
cd /d "C:\Users\CARE MBA\Desktop\Rowszein-s-Delight\frontend"
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://127.0.0.1:5174` with that exact host and port. Vite proxies `/api/` to Django on port `8000`. The existing listener on port `5173` is separate from this startup.

### If PostgreSQL reports `YOUR_POSTGRES_USERNAME`

A plain `manage.py` invocation gives process environment variables priority over `backend/.env`. An older CMD window can still pass placeholder credentials. Run `scripts\django-local.cmd --check` from this checkout to verify the connection and account migrations with the saved local configuration. The launcher clears inherited Django database and auth settings for its own process. Your current CMD and Windows environment settings keep their values.

For routine startup, run `scripts\django-local.cmd` without `--check`. Git ignores `backend/.env`. Share the launcher and this guide through Git, and keep the dotenv file local.

## Stop

Press **Ctrl+C** in the React and Django windows. If CMD asks whether to terminate the npm batch job, enter `Y`. Then run this in either window.

```cmd
docker --context desktop-linux stop rowszein-playground
```

Stopping the container takes both Rowszein databases offline and preserves their data in the existing Docker volume. Use the same container on the next start. Removing the container or pruning its volume is unnecessary for normal development.

## Database and security setup

| Item | Verified configuration |
| --- | --- |
| Docker | Local `desktop-linux` engine, existing `rowszein-playground` container, PostgreSQL 17.11 |
| PostgreSQL address | `127.0.0.1:55433`, published on loopback only |
| Current development target | `rowszein_dev`, owned by `rowszein_dev_app` in the `public` schema. The role has no superuser, database creation, or role creation privilege. |
| Earlier target | `rowszein_playground` was stopped and retained 23 tables, 33 migrations and one existing staff account. It lacked the two Phase 1B.3 account migrations. The setup preserved that database and created a separate empty target in the same persistent container. |
| Local session policy | Dedicated environment name and stable generated signing and rate-limit secrets, default limits `LA=5, LI=20, LR=60, RR=30`, 50,000 bucket ceiling, and direct peer addressing |
| Local HTTP | Loopback only. Cookies are HttpOnly with SameSite Lax. CSRF and CORS use the exact React origin `http://127.0.0.1:5174`. |

Django applied 35 approved migrations after confirming the development database’s identity, ownership, empty schema and zero applied migrations. All three account migrations remained applied after restarting the container. PostgreSQL reported the five enabled Phase 1B.3 session guards. A rolled-back probe confirmed that a direct epoch update is rejected and that a role change increments the epoch and revokes the device session.

Edge verified the React-to-Django proxy and both local logins. The owner opened Dashboard and Recipes. Staff landed on Sales, could read stock, and received HTTP 403 from Dashboard and Recipes. The smoke check also rejected a login without a CSRF token, rejected logout from the wrong origin, and confirmed that logout invalidates a copied access cookie. The existing Vite CSS import-order warning remains visible during startup.

To recheck the account migration state, run this from the repository root with PostgreSQL running.

```cmd
scripts\django-local.cmd --check
```

The original playground and the other Supabase projects remain separate from the development target. Phase 2B is the next UI/UX implementation phase.
