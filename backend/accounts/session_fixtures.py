"""Signed-in test clients that use real device sessions, never a bypass.

Sales and stock commands re-check the caller's live device session
(``require_session``), so DRF's ``force_authenticate`` cannot reach them.
These helpers create the same session row and cookies a real sign-in would.
"""
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.middleware.csrf import _get_new_csrf_string
from rest_framework.test import APIClient

from accounts import session_tokens
from accounts.models import DeviceSession
from accounts.session_database import database_time, lock_users
from accounts.session_policy import ABSOLUTE, jti_digest

TEST_ORIGIN = "https://testserver"


def bind_session(user):
    """Create a live device session for ``user`` and return its cookie tokens."""
    with transaction.atomic():
        current = lock_users([user.pk]).get(user.pk)
        now = database_time()
        jti = "test-fixture-" + uuid4().hex
        row = DeviceSession.objects.create(
            user=current,
            user_epoch=current.session_epoch,
            created_at=now,
            last_activity_at=now,
            absolute_expires_at=now + ABSOLUTE,
            refresh_jti_hash=jti_digest(jti),
        )
        return session_tokens.pair(row, now, jti)


class SessionClient(APIClient):
    """APIClient whose ``force_authenticate`` signs in with real session cookies and CSRF, over HTTPS."""

    def __init__(self, **defaults):
        super().__init__(enforce_csrf_checks=True, **defaults)

    def force_authenticate(self, user=None, token=None):
        if token is not None:
            raise AssertionError("Use a real session, not a bypass token.")
        super().force_authenticate(user=None, token=None)
        self.cookies.clear()
        if user is None:
            return
        tokens = bind_session(user)
        for key, name in [
            ("access", settings.SIMPLE_JWT["AUTH_COOKIE"]),
            ("refresh", settings.SIMPLE_JWT["AUTH_COOKIE_REFRESH"]),
            ("locator", "device_session"),
        ]:
            self.cookies[name] = tokens[key]
        secret = _get_new_csrf_string()
        self.cookies[settings.CSRF_COOKIE_NAME] = secret
        self.defaults.update(HTTP_X_CSRFTOKEN=secret, HTTP_ORIGIN=TEST_ORIGIN, REMOTE_ADDR="192.0.2.10")

    def generic(self, method, path, data="", content_type="application/octet-stream", secure=False, **extra):
        return super().generic(method, path, data, content_type, secure=True, **extra)
