@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Proves a backup restores: loads it into a temporary local PostgreSQL that
rem is never published to the network, compares every table's row count with
rem the counts taken at backup time, then deletes the temporary database.
rem Never touches the live database.
rem
rem   scripts\check-backup.cmd "C:\...\Rowszein backups\rowszein-20261114-0900.dump"
rem
rem Optional: ROWSZEIN_PG_IMAGE (default: postgres:17)

if "%~1"=="" goto usage
if not "%~2"=="" goto usage
if not exist "%~f1" (
    echo No backup file at "%~f1".
    exit /b 2
)
if not exist "%~dpn1.counts.txt" (
    echo Missing "%~dpn1.counts.txt", the row counts saved with the backup.
    exit /b 2
)
if not defined ROWSZEIN_PG_IMAGE set "ROWSZEIN_PG_IMAGE=postgres:17"
set "SCRIPTS_DIR=%~dp0"
set "SCRIPTS_DIR=%SCRIPTS_DIR:~0,-1%"
set "BACKUP_DIR=%~dp1"
set "BACKUP_DIR=%BACKUP_DIR:~0,-1%"
set "BACKUP_FILE=%~nx1"
set "COUNTS_FILE=%~n1.counts.txt"

docker info >nul 2>&1 || (
    echo Docker is not running. Open Docker Desktop, wait for it to start, then try again.
    exit /b 1
)

for /f %%R in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N').Substring(0,12)"') do set "CHECK=rowszein-backup-check-%%R"

echo Restoring "%BACKUP_FILE%" into a temporary database ...
rem No port is published, so trust authentication is reachable only inside the container.
docker run -d --name "%CHECK%" -e POSTGRES_HOST_AUTH_METHOD=trust -v "%BACKUP_DIR%:/backup:ro" -v "%SCRIPTS_DIR%:/scripts:ro" "%ROWSZEIN_PG_IMAGE%" >nul || exit /b 1

rem Wait for the real server (TCP), not the temporary one the image runs during setup.
docker exec "%CHECK%" sh -c "for i in $(seq 60); do pg_isready -q -h 127.0.0.1 && exit 0; sleep 1; done; exit 1" || goto failed
docker exec -e BACKUP_FILE -e RESTORE_TARGET=postgresql://postgres@127.0.0.1/postgres "%CHECK%" sh -c "sh /scripts/pg-restore-app.sh \"/backup/$BACKUP_FILE\"" || goto failed
docker exec -e COUNTS_FILE "%CHECK%" sh -c "psql -h 127.0.0.1 -U postgres -d postgres --no-psqlrc --quiet --tuples-only --no-align --field-separator=' ' --set=ON_ERROR_STOP=1 --file=/scripts/table-counts.sql | diff -u \"/backup/$COUNTS_FILE\" -" || goto failed

docker rm -f "%CHECK%" >nul
echo.
echo PASSED: the backup restores, and every table has the same number of rows as when it was taken.
exit /b 0

:failed
docker rm -f "%CHECK%" >nul 2>&1
echo.
echo FAILED: this backup did not restore cleanly (details above). Take a new backup and check it.
exit /b 1

:usage
echo Usage: scripts\check-backup.cmd "path\to\rowszein-YYYYMMDD-HHMM.dump"
exit /b 2
