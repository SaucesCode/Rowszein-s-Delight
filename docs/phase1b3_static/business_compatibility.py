"""Future runner adapter; NEVER auto-installed and NOT executed at checkpoint.

Existing Phase 1A assertions/files remain byte-for-byte intact. Replace only
their APIClient fixture binding with real V2 cookies in an explicitly scoped
context. Security/CSRF suites must NOT use this automatic-CSRF adapter.
"""
from contextlib import contextmanager
from importlib import import_module
from unittest.mock import patch
from rest_framework.test import APIClient
from session_api_contracts import bind_fixture, cookie_client


class BusinessSessionClient(APIClient):
    def force_authenticate(self,user=None,token=None):
        if token is not None: raise AssertionError('Use a real V2 cookie fixture, not a bypass token.')
        super().force_authenticate(user=None,token=None)
        self.cookies.clear()
        if user is None: return
        _,tokens=bind_fixture(user)
        fixture=cookie_client(tokens)
        self.cookies=fixture.cookies
        self.defaults.update(fixture.defaults)

    def generic(self,method,path,data='',content_type='application/octet-stream',secure=False,**extra):
        return super().generic(method,path,data,content_type,secure=True,**extra)


@contextmanager
def phase1a_cookie_fixtures():
    modules=['sales.tests','sales.test_phase1a1_compat','sales.test_verification_extended','sales.test_release_blockers']
    patches=[patch.object(import_module(name),'APIClient',BusinessSessionClient) for name in modules]
    try:
        for item in patches: item.start()
        yield
    finally:
        for item in reversed(patches): item.stop()
