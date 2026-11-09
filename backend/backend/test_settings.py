"""Isolated regression settings. Never select the application's database.

Default: in-memory SQLite. PostgreSQL is opt-in through the disposable-container
runner; it uses a generated database name/password and loopback port only.
"""
import os
import re

os.environ.update(
    SECRET_KEY="local-regression-tests-only-not-a-deployment-key-1234567890",
    DEBUG="False",
    DATABASE_URL="sqlite:///:memory:",
    ALLOWED_HOSTS="localhost,127.0.0.1,testserver",
    CSRF_TRUSTED_ORIGINS="http://localhost:5173",
    CORS_ALLOWED_ORIGINS="http://localhost:5173",
    AUTH_COOKIE_SECURE="False",
    AUTH_COOKIE_SAMESITE="Lax",
)
from .settings import *  # noqa: E402,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

if os.environ.get("ROWSZEIN_TEST_POSTGRES") == "1":
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
