# Pink revision verification

Run from the repository root with the installed virtual environment, Node dependencies, Edge and local Docker. The browser runner reads the schema and only the three framework metadata tables from the verified local `rowszein_dev` database. It restores them into a new tmpfs PostgreSQL database, generates synthetic records there, then cleans up the database and both loopback servers. It does not execute Django migrations, copy any application rows, or load the local dotenv into the test servers.

```powershell
backend/.venv/Scripts/python.exe -B docs/phase2a_pink/run_browser.py after
backend/.venv/Scripts/python.exe -B docs/phase2a_pink/run_static.py
```

The `before` capture was made before changing the application files at `5a840d9`. See [the route inventory and revision report](../PHASE2A_PINK_BRANDING_AND_PAGE_INVENTORY_REPORT.md).
