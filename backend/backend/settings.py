from pathlib import Path
from datetime import timedelta

from decouple import config
import dj_database_url
from accounts.origin_config import exact_origins
import json

BASE_DIR = Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------------------
# SECURITY
# ------------------------------------------------------------------------------

SECRET_KEY = config("SECRET_KEY")

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1"
).split(",")

CSRF_TRUSTED_ORIGINS = exact_origins(config(
    "CSRF_TRUSTED_ORIGINS",
    default=""
), 'CSRF_TRUSTED_ORIGINS')

# ------------------------------------------------------------------------------
# APPLICATIONS
# ------------------------------------------------------------------------------

DJANGO_APPS = [
    "accounts.admin_config.BusinessAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
]

LOCAL_APPS = [
    "accounts",
    "ingredients",
    "products",
    "recipes",
    "expenses",
    "sales",
    "dashboard",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ------------------------------------------------------------------------------
# MIDDLEWARE
# ------------------------------------------------------------------------------

MIDDLEWARE = [
    "backend.request_context.RequestIdMiddleware",
    "accounts.middleware.APIResponsePrivacy",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "accounts.session_middleware.SessionTransactionMiddleware",
    "accounts.admin_sessions.AdminSessionMiddleware",
]

ROOT_URLCONF = "backend.urls"

# ------------------------------------------------------------------------------
# TEMPLATES
# ------------------------------------------------------------------------------

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

# ------------------------------------------------------------------------------
# DATABASE
# ------------------------------------------------------------------------------
if DEBUG:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME"),
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5433"),
        }
    }
else:
    DATABASES = {
        "default": dj_database_url.config(
            default=config("DATABASE_URL")
        )
    }

# ------------------------------------------------------------------------------
# PASSWORD VALIDATION
# ------------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# ------------------------------------------------------------------------------
# INTERNATIONALIZATION
# ------------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Manila"

USE_I18N = True

USE_TZ = True

# ------------------------------------------------------------------------------
# STATIC & MEDIA
# ------------------------------------------------------------------------------

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"

# Uploaded photos go to Cloudinary when its keys are set (production); otherwise
# to MEDIA_ROOT on local disk, which Django serves only in DEBUG.
CLOUDINARY_CLOUD_NAME = config("CLOUDINARY_CLOUD_NAME", default="")
CLOUDINARY_API_KEY = config("CLOUDINARY_API_KEY", default="")
CLOUDINARY_API_SECRET = config("CLOUDINARY_API_SECRET", default="")
CLOUDINARY_FOLDER = config("CLOUDINARY_FOLDER", default="rowszein")
USE_CLOUDINARY = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])

# STORAGES replaced STATICFILES_STORAGE, which Django 5.1 removed. Compression
# without a manifest, so pages never fail if collectstatic was skipped.
STORAGES = {
    "default": {
        "BACKEND": (
            "backend.media_storage.CloudinaryMediaStorage"
            if USE_CLOUDINARY
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Server-side photo limits; the app also checks these before uploading.
PHOTO_MAX_BYTES = 5 * 1024 * 1024
PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}

# ------------------------------------------------------------------------------
# DEFAULT PRIMARY KEY
# ------------------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

# ------------------------------------------------------------------------------
# DJANGO REST FRAMEWORK
# ------------------------------------------------------------------------------

REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "accounts.security.api_exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "accounts.permissions.BusinessPermission",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_METADATA_CLASS": None,
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}

# ------------------------------------------------------------------------------
# JWT
# ------------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_REFRESH": "refresh_token",
    "AUTH_COOKIE_SECURE": config(
        "AUTH_COOKIE_SECURE",
        default=not DEBUG,
        cast=bool,
    ),
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SAMESITE": config(
        "AUTH_COOKIE_SAMESITE",
        default="Lax" if DEBUG else "None",
    ),
}

# No fallback to SECRET_KEY or a per-worker in-memory limiter. Missing verified
# configuration fails authentication closed; bootstrap/cleanup remain separate.
AUTH_SESSION_SIGNING_KEY = config('AUTH_SESSION_SIGNING_KEY', default='')
AUTH_SESSION_ENV = config('AUTH_SESSION_ENV', default='')
AUTH_RATE_KEYS = json.loads(config('AUTH_RATE_KEYS', default='{}'))
AUTH_RATE_LIMITS = json.loads(config('AUTH_RATE_LIMITS', default='{"LA":5,"LI":20,"LR":60,"RR":30}'))
AUTH_MAX_BUCKET_ROWS = config('AUTH_MAX_BUCKET_ROWS', default=50000, cast=int)
AUTH_PROXY_MODE = config('AUTH_PROXY_MODE', default='direct' if DEBUG else 'unconfigured')
AUTH_TRUSTED_PROXY_CIDRS = [value.strip() for value in config('AUTH_TRUSTED_PROXY_CIDRS',default='').split(',') if value.strip()]

# ------------------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = exact_origins(config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173",
), 'CORS_ALLOWED_ORIGINS')

CORS_ALLOW_CREDENTIALS = True

# Cookie JWTs use Django's cookie/header CSRF mechanism, not session storage.
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_DOMAIN = None
CSRF_USE_SESSIONS = False

# ------------------------------------------------------------------------------
# SECURITY (PRODUCTION)
# ------------------------------------------------------------------------------

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    SESSION_COOKIE_SECURE = True

    CSRF_COOKIE_SECURE = True

    # Send plain-HTTP requests to HTTPS. Can be switched off from the
    # environment if a host health check only speaks HTTP.
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)

    # Tell browsers to use HTTPS for a year (HSTS). Not on the preload list,
    # so it can be undone by lowering the value.
    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Joining the browser HSTS preload list is effectively permanent, so it is
# deliberately not requested (security.W021).
SILENCED_SYSTEM_CHECKS = ["security.W021"]

# LOGGING
# ------------------------------------------------------------------------------
# One JSON line per event on stdout, where the host (Render) collects it. Sign-in
# events are kept at INFO so there is a record of who signed in and of failed
# attempts; every line carries the request ID sent back in X-Request-ID.

LOG_LEVEL = config("LOG_LEVEL", default="WARNING")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {"()": "backend.request_context.RequestIdFilter"},
    },
    "formatters": {
        "json": {"()": "backend.log_format.JsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        },
    },
    "loggers": {
        "accounts.security": {"level": "INFO", "filters": ["request_id"]},
        "django.request": {"level": "WARNING", "filters": ["request_id"]},
        "django.security": {"level": "WARNING", "filters": ["request_id"]},
    },
    "root": {"level": LOG_LEVEL, "handlers": ["console"]},
}
