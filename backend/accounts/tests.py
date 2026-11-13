import json
import logging
import re

from django.conf import settings
from django.middleware.csrf import _get_new_csrf_string
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from rest_framework.test import APIClient

from accounts.models import User
from backend.log_format import JsonFormatter

REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class RequestIdTests(TestCase):
    def test_every_api_response_carries_a_request_id(self):
        response = self.client.get("/api/auth/csrf/", secure=True)
        self.assertRegex(response["X-Request-ID"], REQUEST_ID)

    def test_a_safe_request_id_from_the_proxy_is_kept(self):
        response = self.client.get("/api/auth/csrf/", secure=True, HTTP_X_REQUEST_ID="render-1a2b3c4d")
        self.assertEqual(response["X-Request-ID"], "render-1a2b3c4d")

    def test_an_unsafe_request_id_is_replaced(self):
        response = self.client.get("/api/auth/csrf/", secure=True, HTTP_X_REQUEST_ID="evil\nid; drop")
        self.assertRegex(response["X-Request-ID"], REQUEST_ID)
        self.assertNotIn("evil", response["X-Request-ID"])


class SecurityEventLoggingTests(TransactionTestCase):
    """Sign-in events must be kept, and traceable to the request that caused them."""

    def login(self, password):
        client = APIClient(enforce_csrf_checks=True)
        secret = _get_new_csrf_string()
        client.cookies[settings.CSRF_COOKIE_NAME] = secret
        return client.post(
            "/api/auth/login/",
            {"username": "log-owner", "password": password},
            format="json",
            secure=True,
            HTTP_X_CSRFTOKEN=secret,
            HTTP_ORIGIN="https://testserver",
            REMOTE_ADDR="192.0.2.10",
        )

    def setUp(self):
        User.objects.create_user(username="log-owner", password="correct-horse-battery", role="admin")

    def test_security_loggers_keep_informational_events(self):
        self.assertLessEqual(logging.getLogger("accounts.security").getEffectiveLevel(), logging.INFO)

    def test_failed_sign_in_is_logged_with_the_request_id(self):
        with self.assertLogs("accounts.security", level="INFO") as captured:
            response = self.login("wrong-password")
        self.assertEqual(response.status_code, 401)
        record = next(r for r in captured.records if r.getMessage() == "Credential verification failed")
        self.assertEqual(record.request_id, response["X-Request-ID"])

    def test_successful_sign_in_is_logged_with_the_actor(self):
        with self.assertLogs("accounts.security", level="INFO") as captured:
            response = self.login("correct-horse-battery")
        self.assertEqual(response.status_code, 200)
        record = next(r for r in captured.records if r.getMessage() == "Device login committed")
        self.assertEqual(record.actor_id, User.objects.get(username="log-owner").pk)

    def test_django_error_responses_carry_the_request_id(self):
        with self.assertLogs("django.request", level="WARNING") as captured:
            response = self.login("wrong-password")
        self.assertEqual(captured.records[-1].request_id, response["X-Request-ID"])


class JsonFormatterTests(SimpleTestCase):
    def record(self, **extra):
        record = logging.LogRecord("accounts.security", logging.INFO, __file__, 1, "Device login committed", None, None)
        for key, value in extra.items():
            setattr(record, key, value)
        return record

    def test_one_json_object_with_the_allowed_fields(self):
        line = JsonFormatter().format(self.record(request_id="abc12345", actor_id=7))
        entry = json.loads(line)
        self.assertEqual(entry["message"], "Device login committed")
        self.assertEqual(entry["level"], "INFO")
        self.assertEqual(entry["logger"], "accounts.security")
        self.assertEqual(entry["request_id"], "abc12345")
        self.assertEqual(entry["actor_id"], 7)
        self.assertIn("time", entry)

    def test_fields_outside_the_allow_list_are_never_written(self):
        line = JsonFormatter().format(self.record(password="hunter2", token="secret", request=object()))
        for leaked in ("hunter2", "secret", "password", "token", "request"):
            self.assertNotIn(leaked, json.loads(line))
        self.assertNotIn("hunter2", line)
