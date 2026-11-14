# Database backup and restore

The live database is PostgreSQL on **Supabase**. Everything the shop knows (donuts, boxes, pantry, recipes, sales, expenses, staff accounts) is in its `public` schema. Donut and ingredient photos are on Cloudinary, not in the database.

This procedure covers ISO/IEC 27002 control 8.13 (information backup): backups are taken on a schedule, kept away from the thing they protect, and **tested by restoring them**.

## What Supabase does and doesn't do

* **Free plan:** no automatic backups you can rely on. Supabase's own advice for free projects is to export the data regularly and keep it off-site. Until the project is on a paid plan, the backups below are the only ones.
* **Pro plan and up:** a daily backup, kept 7 days on Pro (14 on Team), restorable from the dashboard. Point-in-time recovery (down to about two minutes) is a paid add-on. A dashboard restore **replaces** the whole database and the project is offline while it runs.
* **Never in a Supabase backup:** files in Supabase Storage. This app doesn't use Storage, so nothing is missed.

Even on a paid plan, keep your own copies too: they survive a lost Supabase account and can be restored anywhere.

## Schedule

| When | What |
| --- | --- |
| Every Monday morning, before opening | Take a backup and check it (about two minutes) |
| Before every deploy that includes a database migration | Take a backup and check it |
| First Monday of the month | Copy that week's backup to the second location |

Keep the last 8 weekly backups and the last 12 monthly ones; delete older files.

**Where to keep them.** The script saves to `Documents\Rowszein backups` on this computer. Once a month, copy the newest `.dump` and `.counts.txt` to a second place you control that isn't this computer (an external drive or a private cloud folder). Backups hold customer names and sales, so never put them in the repository, a shared folder or chat.

## Take a backup

You need Docker Desktop running. The scripts use PostgreSQL's own tools inside Docker, so nothing else is installed.

1. In Supabase, open the project, then **Connect** → **Session pooler**, and copy the connection string. It looks like `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`. Put the database password in place of `[YOUR-PASSWORD]`; if you don't have it, reset it in **Database Settings** (then update `DATABASE_URL` on Render too).
   Use the **session** pooler (port 5432). The transaction pooler (port 6543) doesn't work for backups.
2. Open **Command Prompt** in the repository folder and run:

   ```cmd
   set ROWSZEIN_BACKUP_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   scripts\backup-db.cmd
   ```

   This only reads from the database. It saves two files, for example `rowszein-20261116-080012.dump` (the backup) and `rowszein-20261116-080012.counts.txt` (rows per table at that moment). If it says **data changed while the backup ran**, someone recorded a sale or stock change at the same moment; just run it again.
3. Close the Command Prompt window when you're done, so the password doesn't stay in it.

If the script fails with a "server version mismatch" message, run `set ROWSZEIN_PG_IMAGE=postgres:<N>` with the server's major version from that message (for example `postgres:18`) and try again.

## Check the backup (every time)

```cmd
scripts\check-backup.cmd "%USERPROFILE%\Documents\Rowszein backups\rowszein-20261116-080012.dump"
```

This restores the backup into a temporary database inside Docker, compares every table's row count with the `.counts.txt` file, and deletes the temporary database. It never touches the live database. Only a backup that says **PASSED** counts. If it fails, take a new backup and check that one.

## Restore after a disaster

Use this when the live data is lost or damaged. Do it calmly, and in this order, so the damaged database is kept until the restore is proven.

1. **Stop changes.** In Render, suspend the backend service so no one records sales into a broken database. The shop can't load donuts while it's suspended.
2. **Pick the backup.** Use the newest backup that passed its check from **before** the damage. Run `check-backup.cmd` on it again.
3. **If on a paid plan and the damage is recent,** restoring from the Supabase dashboard (daily backup or point in time) may lose less. It replaces the whole database. Otherwise continue.
4. **Create a new, empty Supabase project** (keep the old one for now) and copy its **Session pooler** connection string with the password filled in.
5. **Load the backup into it:**

   ```cmd
   set ROWSZEIN_RESTORE_DB_URL=postgresql://postgres.<new-project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   scripts\restore-db.cmd "%USERPROFILE%\Documents\Rowszein backups\rowszein-20261116-080012.dump"
   ```

   It refuses any database that already has tables, so it can't overwrite live data by mistake, and it loads everything in one go: if anything fails, the new project is left empty and you can simply run it again. It must end with **Restored**.
6. **Point the backend at it.** On Render, set `DATABASE_URL` to the new project's connection string, then resume the service. Make sure `python manage.py migrate` runs (it should be in the build command, see the README's Deployment section); it applies any database changes made after the backup was taken.
7. **Check by hand.** Sign in as the owner, open Home, the Sales register and the Pantry, and confirm the last sales and stock levels you expect from the backup's date. Sales made after that backup are gone and must be re-entered from receipts.
8. **Clean up** after a week of normal running: delete the old Supabase project, and record what happened (date, cause, backup used, what had to be re-entered).

## Restore test (twice a year)

Once in spring and once in autumn, do steps 4–7 for real with a throwaway Supabase project and a local copy of the backend, then delete the project. This proves the full disaster procedure still works, not just the backup file. Note the date and result below.

| Date | Backup used | Result | By |
| --- | --- | --- | --- |
| | | | |

## How the scripts were tested

On 14 November 2026 the scripts were run against a throwaway PostgreSQL 17 database built from the app's real migrations, including the five sign-in guard triggers, with Supabase-style extra roles and an `extensions` schema. Results:
* A backup was taken and its check **PASSED**.
* A backup whose saved counts were altered **failed** its check, showing the difference.
* A wrong password **failed**, and earlier backups were kept.
* Writes during the backup were caught ("data changed") and earlier backups were kept.
* A disaster restore into a new empty database matched every table's row count, and brought back all five guard triggers and the correct ID counters.
* A restore aimed at a database that already had data was **refused**, and that database was unchanged.

Not yet done: a backup of the real Supabase project. Do the first one with the steps above, and fill in the first row of the restore-test table.
