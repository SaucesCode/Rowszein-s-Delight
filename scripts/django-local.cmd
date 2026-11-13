@echo off
setlocal EnableExtensions DisableDelayedExpansion

if not "%~2"=="" goto usage
if not "%~1"=="" if /i not "%~1"=="--check" goto usage

pushd "%~dp0.." || exit /b 1
if not exist "backend\.env" (
    echo Missing backend\.env. Restore the Rowszein local configuration before starting Django.
    popd
    exit /b 1
)
if not exist "backend\.venv\Scripts\python.exe" (
    echo Missing backend\.venv\Scripts\python.exe.
    popd
    exit /b 1
)

rem python-decouple prefers process variables. Let backend\.env supply this
rem launch's settings, even when an older terminal still has DB placeholders.
for %%K in (
    DJANGO_SETTINGS_MODULE DEBUG DATABASE_URL DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT
    SECRET_KEY ALLOWED_HOSTS CSRF_TRUSTED_ORIGINS CORS_ALLOWED_ORIGINS
    AUTH_SESSION_SIGNING_KEY AUTH_SESSION_ENV AUTH_RATE_KEYS AUTH_RATE_LIMITS
    AUTH_MAX_BUCKET_ROWS AUTH_PROXY_MODE AUTH_TRUSTED_PROXY_CIDRS AUTH_COOKIE_SECURE AUTH_COOKIE_SAMESITE
) do set "%%K="

if /i "%~1"=="--check" (
    "backend\.venv\Scripts\python.exe" -B "backend\manage.py" showmigrations accounts
) else (
    "backend\.venv\Scripts\python.exe" -B "backend\manage.py" runserver 127.0.0.1:8000 --noreload
)
set "ROWSZEIN_EXIT=%ERRORLEVEL%"
popd
exit /b %ROWSZEIN_EXIT%

:usage
echo Usage: django-local.cmd [--check]
exit /b 2
