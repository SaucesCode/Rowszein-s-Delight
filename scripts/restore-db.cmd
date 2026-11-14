@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Disaster recovery: loads a checked backup into a NEW, EMPTY database.
rem Refuses a database that already has tables, so it can't overwrite live data,
rem and runs as one transaction, so a failure leaves the target unchanged.
rem
rem   set ROWSZEIN_RESTORE_DB_URL=<new Supabase project's session pooler connection string>
rem   scripts\restore-db.cmd "C:\...\Rowszein backups\rowszein-20261114-0900.dump"
rem
rem Optional: ROWSZEIN_PG_IMAGE (default: postgres:17)
rem See docs\BACKUP_AND_RESTORE.md, "Restore after a disaster".

if "%~1"=="" goto usage
if not "%~2"=="" goto usage
if not defined ROWSZEIN_RESTORE_DB_URL (
    echo Set ROWSZEIN_RESTORE_DB_URL to the NEW database's connection string first.
    exit /b 2
)
if not exist "%~f1" (
    echo No backup file at "%~f1".
    exit /b 2
)
if not defined ROWSZEIN_PG_IMAGE set "ROWSZEIN_PG_IMAGE=postgres:17"
set "SCRIPTS_DIR=%~dp0"
set "SCRIPTS_DIR=%SCRIPTS_DIR:~0,-1%"
set "BACKUP_DIR=%~dp1"
set "BACKUP_DIR=%BACKUP_DIR:~0,-1%"
set "BACKUP_FILE=%~nx1"

docker info >nul 2>&1 || (
    echo Docker is not running. Open Docker Desktop, wait for it to start, then try again.
    exit /b 1
)

echo Restoring "%BACKUP_FILE%" into the database in ROWSZEIN_RESTORE_DB_URL ...
rem The connection string is passed by name (-e VAR), so it never appears on a command line.
docker run --rm -e ROWSZEIN_RESTORE_DB_URL -e BACKUP_FILE -v "%BACKUP_DIR%:/backup:ro" -v "%SCRIPTS_DIR%:/scripts:ro" "%ROWSZEIN_PG_IMAGE%" sh -c "RESTORE_TARGET=\"$ROWSZEIN_RESTORE_DB_URL\" sh /scripts/pg-restore-app.sh \"/backup/$BACKUP_FILE\""
if errorlevel 1 (
    echo.
    echo The restore FAILED and nothing was changed. Read the message above.
    exit /b 1
)

echo.
echo Restored. Next: point DATABASE_URL on Render at this database, run migrations,
echo and check the app by hand (docs\BACKUP_AND_RESTORE.md, steps 6 and 7).
exit /b 0

:usage
echo Usage: set ROWSZEIN_RESTORE_DB_URL=... then scripts\restore-db.cmd "path\to\backup.dump"
exit /b 2
