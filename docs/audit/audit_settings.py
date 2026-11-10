"""Phase 0 evidence only: never use an existing database or real credentials."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
os.environ.update(
    SECRET_KEY="phase-zero-local-audit-only-not-a-deployment-secret-1234567890",
    DEBUG="False",
    DATABASE_URL="sqlite:///:memory:",
    ALLOWED_HOSTS="localhost,127.0.0.1,testserver",
    CSRF_TRUSTED_ORIGINS="http://localhost:5173",
    CORS_ALLOWED_ORIGINS="http://localhost:5173",
    AUTH_COOKIE_SECURE="False",
    AUTH_COOKIE_SAMESITE="Lax",
)
from backend.settings import *  # noqa: F403,E402

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

