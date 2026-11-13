"""Isolated regression settings. Never select the application's database.

Run the backend tests with:

    python manage.py test --settings=backend.test_settings

Default: an in-memory SQLite database that disappears after the run, with
test-only signing keys, so no real database or .env secret is ever used.
PostgreSQL is opt-in through the disposable-container runner only; it uses a
generated database name/password and loopback port.
"""
import os
import re
import sys

# Generic settings cannot verify ownership of a real database, so migrating is
# refused, and PostgreSQL tests need the disposable-container runner. Tests on
# the default in-memory SQLite database touch nothing real and are allowed.
POSTGRES_OPT_IN = os.environ.get("ROWSZEIN_TEST_POSTGRES") == "1"
if 'migrate' in sys.argv or (POSTGRES_OPT_IN and 'test' in sys.argv):
    raise RuntimeError('Generic database execution has no verified disposable ownership. Use the disposable verification runner.')

os.environ.update(
    SECRET_KEY="local-regression-tests-only-not-a-deployment-key-1234567890",
    DEBUG="False",
    DATABASE_URL="sqlite:///:memory:",
    ALLOWED_HOSTS="localhost,127.0.0.1,testserver",
    CSRF_TRUSTED_ORIGINS="http://localhost:5173",
    CORS_ALLOWED_ORIGINS="http://localhost:5173",
    AUTH_COOKIE_SECURE="False",
    AUTH_COOKIE_SAMESITE="Lax",
    SECURE_SSL_REDIRECT="False",
    # Test-only sign-in configuration; never the values in backend/.env.
    AUTH_SESSION_SIGNING_KEY="local-regression-session-key-" + "s" * 40,
    AUTH_SESSION_ENV="regression",
    AUTH_RATE_KEYS='{"1": "local-regression-throttle-key-' + "t" * 40 + '"}',
    AUTH_RATE_LIMITS='{"LA":5,"LI":20,"LR":60,"RR":30}',
    AUTH_MAX_BUCKET_ROWS="50000",
    AUTH_PROXY_MODE="direct",
    AUTH_TRUSTED_PROXY_CIDRS="",
    CLOUDINARY_CLOUD_NAME="",
    CLOUDINARY_API_KEY="",
    CLOUDINARY_API_SECRET="",
)
from .settings import *  # noqa: E402,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

if POSTGRES_OPT_IN:
    test_name = os.environ["ROWSZEIN_TEST_DB_NAME"]
    test_port = int(os.environ["ROWSZEIN_TEST_DB_PORT"])
    if not re.fullmatch(r"rowszein_phase1a_[0-9a-f]{32}", test_name) or not 1024 <= test_port <= 65535:
        raise RuntimeError("Refusing non-disposable PostgreSQL test configuration")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": "127.0.0.1",
        "PORT": test_port,
        "NAME": test_name,
        "USER": "postgres",
        "PASSWORD": os.environ["ROWSZEIN_TEST_DB_PASSWORD"],
        "TEST": {"NAME": "test_" + test_name},
    }}
