"""Real-cookie CSRF/Origin tests; no forced authentication/security exemptions."""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, Throttled
from rest_framework_simplejwt.tokens import AccessToken
from security_cases import CookieFixture, ORIGIN, HOSTILE
from accounts.origin_config import exact_origins
from accounts.security import api_exception_handler
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry


class CSRFRegressionTests(CookieFixture, TestCase):
    def snapshot(self):
        models = [Sale, SaleItem, Ingredient, Product, Recipe, RecipeIngredient, Expense,
                  InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]
        return [list(model.objects.order_by('pk').values()) for model in models]

    def check_denied(self, response, before, *, retryable=None):
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error']['code'], 'csrf_failed')
        if retryable is not None:
            self.assertIs(response.data['error']['retryable'], retryable)
        self.assertEqual(self.snapshot(), before)
        self.assertNotIn(settings.SIMPLE_JWT['AUTH_COOKIE'], response.cookies)

    def test_bootstrap_masked_httponly_host_cookie_and_no_cache(self):
        client = self.cookie_client(csrf=False)
        response = client.get('/api/auth/csrf/', secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertRegex(response.data['data']['csrf_token'], r'^[a-zA-Z0-9]{64}$')
        cookie = response.cookies[settings.CSRF_COOKIE_NAME]
        self.assertEqual(len(cookie.value), 32)
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['domain'], '')
        self.assertEqual(cookie['path'], '/')
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn('Cookie', response['Vary'])
        self.assertNotIn(settings.SIMPLE_JWT['AUTH_COOKIE'], response.cookies)

    @override_settings(CSRF_COOKIE_SECURE=True)
    def test_secure_cookie_when_https_setting_enabled(self):
        response = self.cookie_client(csrf=False).get('/api/auth/csrf/', secure=True)
        self.assertTrue(response.cookies[settings.CSRF_COOKIE_NAME]['secure'])

    def test_bootstrap_ignores_expired_and_malformed_access(self):
        for client in [self.expired_client(), self.cookie_client(token='malformed.jwt.cookie')]:
            with self.subTest(client='invalid-access-cookie'):
                self.assertEqual(client.get('/api/auth/csrf/', secure=True).status_code, 200)

    def test_bootstrap_is_read_only(self):
        before = self.snapshot()
        self.assertEqual(self.owner_client.post('/api/auth/csrf/', secure=True).status_code, 405)
        self.assertEqual(self.snapshot(), before)

    def test_login_rotates_csrf_and_keeps_jwts_out_of_json(self):
        client = self.cookie_client()
        old_secret = client.cookies[settings.CSRF_COOKIE_NAME].value
        response = self.login(client)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(old_secret != client.cookies[settings.CSRF_COOKIE_NAME].value)
        self.assertEqual(set(response.data), {'success', 'data', 'message', 'csrf_token'})
        self.assertRegex(response.data['csrf_token'], r'^[a-zA-Z0-9]{64}$')
        for key in [settings.SIMPLE_JWT['AUTH_COOKIE'], settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]:
            self.assertTrue(response.cookies[key]['httponly'])
        self.assertIn('no-store', response['Cache-Control'])

    def test_rotated_login_rejects_old_csrf_before_business_write(self):
        client = self.cookie_client(self.owner)
        self.assertEqual(self.login(client).status_code, 200)
        before = self.snapshot()
        self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True), before, retryable=True)

    def test_expired_or_malformed_cookie_login_and_logout(self):
        for client in [self.expired_client(), self.cookie_client(token='malformed.jwt.cookie')]:
            response = self.login(client)
            self.assertEqual(response.status_code, 200)
            client.defaults['HTTP_X_CSRFTOKEN'] = response.data['csrf_token']
            # Restore an invalid access cookie to exercise logout's independent CSRF guard.
            client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']] = 'malformed.jwt.cookie'
            before = self.snapshot()
            logout = client.post('/api/auth/logout/', secure=True)
            self.assertEqual(logout.status_code, 200)
            self.assertEqual(logout.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]['max-age'], 0)
            self.assertEqual(self.snapshot(), before)

    def test_logout_is_csrf_protected_idempotent_cookie_cleanup(self):
        client = self.cookie_client(self.owner)
        before = self.snapshot()
        for _ in range(2):
            response = client.post('/api/auth/logout/', secure=True)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]['max-age'], 0)
            client.defaults['HTTP_X_CSRFTOKEN'] = response.data['csrf_token']
        self.assertEqual(self.snapshot(), before)

    def test_all_unsafe_methods_without_token_have_no_writes(self):
        expense = Expense.objects.create(**dict(self.expense_payload(), amount=Decimal('1')))
        for method, path, data in [
            ('post', '/api/expenses/', self.expense_payload()),
            ('put', f'/api/expenses/{expense.pk}/', self.expense_payload()),
            ('patch', f'/api/expenses/{expense.pk}/', {'amount': '2.00'}),
            ('delete', f'/api/expenses/{expense.pk}/', {}),
        ]:
            with self.subTest(method=method):
                client, before = self.cookie_client(self.owner, csrf=False), self.snapshot()
                self.check_denied(getattr(client, method)(path, data, format='json', secure=True), before, retryable=True)

    def test_hostile_origin_with_matching_token_has_no_writes(self):
        client, before = self.cookie_client(self.owner, origin=HOSTILE), self.snapshot()
        self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='multipart', secure=True), before, retryable=False)

    def test_null_and_lookalike_origins_fail_closed(self):
        for origin in ['null', 'https://testserver.hostile.example', 'http://testserver']:
            client, before = self.cookie_client(self.owner, origin=origin), self.snapshot()
            self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True), before, retryable=False)

    def test_https_trusted_referer_without_origin_works(self):
        client = self.cookie_client(self.owner, origin=None)
        client.defaults['HTTP_REFERER'] = ORIGIN + '/form'
        self.assertEqual(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True).status_code, 201)

    def test_https_missing_bad_or_insecure_referer_rejected(self):
        for referer in [None, HOSTILE+'/form', 'not-a-url', 'http://testserver/form']:
            client, before = self.cookie_client(self.owner, origin=None), self.snapshot()
            if referer is not None:
                client.defaults['HTTP_REFERER'] = referer
            self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True), before, retryable=False)

    def test_loopback_http_requires_explicit_trusted_origin(self):
        client = self.cookie_client(self.owner, origin='http://127.0.0.1:18841')
        self.assertEqual(client.post('/api/expenses/', self.expense_payload(), format='json').status_code, 201)
        client, before = self.cookie_client(self.owner, origin=None), self.snapshot()
        self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json'), before, retryable=False)

    def test_malformed_csrf_tokens_rejected(self):
        for value in ['bad', '!'*64, 'a'*64]:
            client, before = self.cookie_client(self.owner), self.snapshot()
            client.defaults['HTTP_X_CSRFTOKEN'] = value
            self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True), before, retryable=True)

    def test_missing_cookie_rejected_despite_well_formed_header(self):
        client, before = self.cookie_client(self.owner), self.snapshot()
        del client.cookies[settings.CSRF_COOKIE_NAME]
        self.check_denied(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True), before, retryable=True)

    def test_login_and_logout_rejections_issue_no_auth_cookies(self):
        for path, payload in [('/api/auth/login/', {'username': self.owner.username, 'password': self.password}), ('/api/auth/logout/', {})]:
            client, before = self.cookie_client(self.owner, csrf=False, origin=HOSTILE), self.snapshot()
            self.check_denied(client.post(path, payload, format='multipart', secure=True), before, retryable=False)

    def test_supported_form_token_works_for_trusted_login(self):
        client = self.cookie_client()
        del client.defaults['HTTP_X_CSRFTOKEN']
        response = client.post('/api/auth/login/', {'username': self.owner.username, 'password': self.password,
            'csrfmiddlewaretoken': client.cookies[settings.CSRF_COOKIE_NAME].value}, format='multipart', secure=True)
        self.assertEqual(response.status_code, 200)

    def test_json_token_body_does_not_replace_required_header(self):
        client, before = self.cookie_client(self.owner), self.snapshot()
        del client.defaults['HTTP_X_CSRFTOKEN']
        payload = dict(self.expense_payload(), csrfmiddlewaretoken=client.cookies[settings.CSRF_COOKIE_NAME].value)
        self.check_denied(client.post('/api/expenses/', payload, format='json', secure=True), before, retryable=True)

    def test_bearer_header_does_not_bypass_cookie_csrf(self):
        client, before = self.cookie_client(self.owner, csrf=False), self.snapshot()
        response = client.post('/api/expenses/', self.expense_payload(), format='json', secure=True, HTTP_AUTHORIZATION='Bearer irrelevant')
        self.check_denied(response, before, retryable=True)

    def test_unauthenticated_or_invalid_jwt_write_is_401_without_writes(self):
        for client in [self.cookie_client(), self.expired_client(), self.cookie_client(token='bad.jwt')]:
            before = self.snapshot()
            response = client.post('/api/expenses/', self.expense_payload(), format='json', secure=True)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.data['error']['code'], 'authentication_required')
            self.assertEqual(self.snapshot(), before)

    def test_rejected_sale_can_use_same_uuid_after_csrf_recovery(self):
        client, key, before = self.cookie_client(self.owner, csrf=False), str(uuid4()), self.snapshot()
        self.check_denied(client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key), before)
        self.assertFalse(InventoryOperation.objects.filter(client_key=key).exists())
        token = client.get('/api/auth/csrf/', secure=True).data['data']['csrf_token']
        client.defaults['HTTP_X_CSRFTOKEN'] = token
        first = client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(first.status_code, 201)
        after = self.snapshot()
        replay = client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay['Idempotency-Replayed'], 'true')
        self.assertEqual(self.snapshot(), after)

    def test_rejected_stock_adjustment_does_not_reserve_uuid_or_revision(self):
        client, key, before = self.cookie_client(self.owner, csrf=False), str(uuid4()), self.snapshot()
        self.ingredient.refresh_from_db()
        revision = str(self.ingredient.stock_revision)
        args = dict(format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH=f'"{revision}"')
        path = f'/api/ingredients/{self.ingredient.pk}/adjustments/'
        body = {'delta': '0.000000001', 'reason': 'CSRF recovery check'}
        self.check_denied(client.post(path, body, **args), before)
        token = client.get('/api/auth/csrf/', secure=True).data['data']['csrf_token']
        client.defaults['HTTP_X_CSRFTOKEN'] = token
        self.assertEqual(client.post(path, body, **args).status_code, 200)
        after = self.snapshot()
        self.assertEqual(client.post(path, body, **args).status_code, 200)
        self.assertEqual(self.snapshot(), after)

    def test_authentication_rotation_preserves_successful_sale_replay(self):
        client, key = self.cookie_client(self.owner), str(uuid4())
        payload = self.sale_payload()
        first = client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(first.status_code, 201)
        login = self.login(client)
        self.assertEqual(login.status_code, 200)
        before = self.snapshot()
        self.check_denied(client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key), before)
        client.defaults['HTTP_X_CSRFTOKEN'] = login.data['csrf_token']
        replay = client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data, first.data)
        self.assertEqual(self.snapshot(), before)


class SecurityTransportUnitTests(SimpleTestCase):
    def test_consistent_401_403_429_and_retry_after(self):
        for error, status, code in [(AuthenticationFailed(), 401, 'authentication_required'),
                (PermissionDenied(), 403, 'forbidden'), (Throttled(wait=12), 429, 'rate_limited')]:
            response = api_exception_handler(error, {})
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.data['error']['code'], code)
        self.assertEqual(response['Retry-After'], '12')
        self.assertEqual(response.data['error']['retry_after'], 12)

    def test_origin_configuration_no_wildcards_credentials_paths_or_remote_http(self):
        for origin in ['https://*.example.com', '*', 'null', 'https://user:password@example.com',
                       'https://example.com/path', 'https://example.com?q=1', 'https://example.com#fragment', 'http://example.com']:
            with self.subTest(kind='invalid-origin'), self.assertRaises(ImproperlyConfigured):
                exact_origins(origin, 'CSRF_TRUSTED_ORIGINS')
        self.assertEqual(exact_origins(' https://example.test, http://localhost:5173,https://example.test ', 'test'),
                         ['https://example.test', 'http://localhost:5173'])
        self.assertEqual(exact_origins('', 'test'), [])
