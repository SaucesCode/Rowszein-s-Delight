@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Backs up the live database to a dated file outside the repository.
rem
rem   set ROWSZEIN_BACKUP_DB_URL=<Supabase session pooler connection string>
rem   scripts\backup-db.cmd
rem
rem Optional: ROWSZEIN_BACKUP_DIR (default: Documents\Rowszein backups)
rem           ROWSZEIN_PG_IMAGE  (default: postgres:17; must be at least the server's version)
rem See docs\BACKUP_AND_RESTORE.md.

if not "%~1"=="" (
    echo Usage: set ROWSZEIN_BACKUP_DB_URL=... then run scripts\backup-db.cmd
    exit /b 2
)
if not defined ROWSZEIN_BACKUP_DB_URL (
    echo Set ROWSZEIN_BACKUP_DB_URL to the database connection string first.
    echo In Supabase: Connect, Session pooler. See docs\BACKUP_AND_RESTORE.md.
    exit /b 2
)
if not defined ROWSZEIN_BACKUP_DIR set "ROWSZEIN_BACKUP_DIR=%USERPROFILE%\Documents\Rowszein backups"
if not defined ROWSZEIN_PG_IMAGE set "ROWSZEIN_PG_IMAGE=postgres:17"
set "SCRIPTS_DIR=%~dp0"
set "SCRIPTS_DIR=%SCRIPTS_DIR:~0,-1%"

docker info >nul 2>&1 || (
    echo Docker is not running. Open Docker Desktop, wait for it to start, then try again.
    exit /b 1
)

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "BACKUP_NAME=rowszein-%%T"
if not exist "%ROWSZEIN_BACKUP_DIR%" mkdir "%ROWSZEIN_BACKUP_DIR%" || exit /b 1
rem Never reuse a name: the clean-up below must only ever remove this run's files.
if exist "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.*" (
    echo A backup named %BACKUP_NAME% already exists. Wait a second and run again.
    exit /b 1
)

echo Backing up to "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.dump" ...
rem The connection string is passed by name (-e VAR), so it never appears on a command line.
rem Rows are counted before and after the dump; if they differ, data changed during the
rem backup and the counts can't be trusted to check it, so it is treated as failed.
docker run --rm -e ROWSZEIN_BACKUP_DB_URL -e BACKUP_NAME -v "%ROWSZEIN_BACKUP_DIR%:/backup" -v "%SCRIPTS_DIR%:/scripts:ro" "%ROWSZEIN_PG_IMAGE%" sh -ec "count() { psql --no-psqlrc --quiet --tuples-only --no-align --field-separator=' ' --set=ON_ERROR_STOP=1 --file=/scripts/table-counts.sql \"$ROWSZEIN_BACKUP_DB_URL\"; }; count > /backup/$BACKUP_NAME.counts.txt; pg_dump --format=custom --schema=public --no-owner --no-privileges --file=/backup/$BACKUP_NAME.dump \"$ROWSZEIN_BACKUP_DB_URL\"; count > /tmp/after.txt; cmp -s /backup/$BACKUP_NAME.counts.txt /tmp/after.txt || { echo 'Data changed while the backup ran (the shop was busy). Run the backup again.'; exit 1; }"
if errorlevel 1 (
    echo.
    echo The backup FAILED. Nothing was changed on the database.
    if exist "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.dump" del "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.dump"
    if exist "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.counts.txt" del "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.counts.txt"
    exit /b 1
)

echo.
echo Backup saved: "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.dump"
echo Now prove it restores:
echo   scripts\check-backup.cmd "%ROWSZEIN_BACKUP_DIR%\%BACKUP_NAME%.dump"
exit /b 0
