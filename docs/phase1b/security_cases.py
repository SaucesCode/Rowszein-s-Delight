"""AUDIT ONLY: real-cookie controls, red security goals, draft role contracts.

No force_authenticate, no replacement authenticator/permissions, no app fixes.
Draft role expectations require business approval before implementation.
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from django.conf import settings
from django.middleware.csrf import _get_new_csrf_string
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, InventoryOperation

ORIGIN = 'https://testserver'
HOSTILE = 'https://hostile.example'


class CookieFixture:
    def setUp(self):
        self.password = 'isolated-security-fixture-only'
        self.owner = User.objects.create_user(username='audit-owner', password=self.password, role='admin')
        self.staff = User.objects.create_user(username='audit-staff', password=self.password, role='staff')
        self.owner_cookie = str(RefreshToken.for_user(self.owner).access_token)
        self.owner_client = self.cookie_client(self.owner, token=self.owner_cookie)
        self.staff_client = self.cookie_client(self.staff)
        category = Category.objects.create(name='Security fixture', slug='security-fixture')
        self.product = Product.objects.create(name='Security fixture product', category=category, price=Decimal('50'))
        self.ingredient = Ingredient.objects.create(name='Security fixture ingredient', quantity=Decimal('100'), unit='kg', cost_per_unit=Decimal('1'))
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=1)
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.ingredient, quantity=Decimal('1'))
        created = self.owner_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(created.status_code, 201, 'Trusted owner control must work before probing security')
        self.sale_id = created.data['data']['id']

    def cookie_client(self, user=None, token=None, csrf=True, origin=ORIGIN):
        client = APIClient(enforce_csrf_checks=True)
        if user is not None or token is not None:
            client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']] = token or str(RefreshToken.for_user(user).access_token)
        if csrf:
            secret = _get_new_csrf_string()
            client.cookies[settings.CSRF_COOKIE_NAME] = secret
            client.defaults['HTTP_X_CSRFTOKEN'] = secret
        if origin is not None:
            client.defaults['HTTP_ORIGIN'] = origin
        return client

    def sale_payload(self):
        return {'date': timezone.localdate().isoformat(), 'sale_items': [{'product': self.product.pk, 'quantity': 1, 'unit_price': '50.00'}]}

    def expense_payload(self):
        return {'date': timezone.localdate().isoformat(), 'category': 'other', 'amount': '1.00', 'description': 'Isolated security test'}

    def login(self, client):
        return client.post('/api/auth/login/', {'username': self.owner.username, 'password': self.password}, format='multipart', secure=True)

    def expired_client(self):
        token = AccessToken.for_user(self.owner)
        token.set_exp(from_time=timezone.now() - timedelta(hours=2), lifetime=timedelta(minutes=1))
        return self.cookie_client(token=str(token))

    def stock_request(self, client):
        self.ingredient.refresh_from_db()
        return client.post(f'/api/ingredients/{self.ingredient.pk}/adjustments/', {'delta': '1.000000000', 'reason': 'Security permission fixture'}, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH=f'"{self.ingredient.stock_revision}"')


class CurrentBehaviorControls(CookieFixture, TestCase):
    def test_trusted_owner_write_and_business_role_are_independent_of_django_staff_flag(self):
        self.assertFalse(self.owner.is_staff)
        self.assertFalse(self.owner.is_superuser)
        self.assertEqual(self.stock_request(self.owner_client).status_code, 200)

    def test_staff_can_record_sale_control(self):
        self.assertEqual(self.staff_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4())).status_code, 201)

    def test_hostile_simple_form_without_csrf_commits_expense_despite_cors(self):
        client = self.cookie_client(self.owner, csrf=False, origin=HOSTILE)
        response = client.post('/api/expenses/', self.expense_payload(), format='multipart', secure=True)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Expense.objects.exists())
        self.assertNotIn('Access-Control-Allow-Origin', response)

    def test_hostile_login_without_csrf_issues_auth_cookies(self):
        response = self.login(self.cookie_client(csrf=False, origin=HOSTILE))
        self.assertEqual(response.status_code, 200)
        self.assertIn(settings.SIMPLE_JWT['AUTH_COOKIE'], response.cookies)

    def test_hostile_logout_without_csrf_is_accepted(self):
        response = self.cookie_client(self.owner, csrf=False, origin=HOSTILE).post('/api/auth/logout/', secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]['max-age'], 0)

    def test_logout_does_not_revoke_copied_access_cookie(self):
        self.assertEqual(self.owner_client.post('/api/auth/logout/', secure=True).status_code, 200)
        replay = self.cookie_client(token=self.owner_cookie)
        self.assertEqual(replay.get('/api/auth/me/', secure=True).status_code, 200)

    def test_password_change_does_not_revoke_existing_cookie(self):
        self.owner.set_password('different-isolated-fixture-password')
        self.owner.save(update_fields=['password'])
        self.assertEqual(self.owner_client.get('/api/auth/me/', secure=True).status_code, 200)

    def test_expired_access_is_rejected(self):
        self.assertEqual(self.expired_client().get('/api/auth/me/', secure=True).status_code, 401)

    def test_inactive_user_is_already_rejected(self):
        self.owner.is_active = False
        self.owner.save(update_fields=['is_active'])
        self.assertEqual(self.owner_client.get('/api/auth/me/', secure=True).status_code, 401)

    def test_deleted_unused_user_is_already_rejected(self):
        unused = User.objects.create_user(username='audit-unused')
        client = self.cookie_client(unused)
        unused.delete()
        self.assertEqual(client.get('/api/auth/me/', secure=True).status_code, 401)

    def test_malformed_cookie_is_rejected(self):
        self.assertEqual(self.cookie_client(token='invalid.test.cookie').get('/api/auth/me/', secure=True).status_code, 401)

    def test_refresh_cannot_be_used_as_access_and_refresh_route_is_absent(self):
        client = self.cookie_client(token=str(RefreshToken.for_user(self.owner)))
        self.assertEqual(client.get('/api/auth/me/', secure=True).status_code, 401)
        self.assertEqual(self.owner_client.post('/api/auth/refresh/', secure=True).status_code, 404)

    def test_expired_cookie_blocks_both_relogin_and_logout(self):
        self.assertEqual(self.login(self.expired_client()).status_code, 401)
        self.assertEqual(self.expired_client().post('/api/auth/logout/', secure=True).status_code, 401)

    def test_twelve_failed_logins_are_not_throttled(self):
        client = self.cookie_client()
        statuses = [client.post('/api/auth/login/', {'username': self.owner.username, 'password': 'wrong'}, format='json', secure=True).status_code for _ in range(12)]
        self.assertEqual(statuses, [401] * 12)

    def test_cookie_lifetimes_and_httponly_match_current_configuration(self):
        response = self.login(self.cookie_client())
        self.assertEqual(response.status_code, 200)
        access, refresh = settings.SIMPLE_JWT['AUTH_COOKIE'], settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']
        self.assertTrue(response.cookies[access]['httponly'])
        self.assertTrue(response.cookies[refresh]['httponly'])
        self.assertEqual(response.cookies[access]['max-age'], 3600)
        self.assertEqual(response.cookies[refresh]['max-age'], 604800)


class DesiredSecurityContracts(CookieFixture, TestCase):
    """RED desired security behaviors; do not relabel as expectedFailure."""
    def test_cookie_write_without_csrf_is_denied_before_persistence(self):
        client = self.cookie_client(self.owner, csrf=False)
        self.assertEqual(client.post('/api/expenses/', self.expense_payload(), format='multipart', secure=True).status_code, 403)
        self.assertFalse(Expense.objects.exists())

    def test_cookie_write_with_invalid_csrf_is_denied(self):
        self.owner_client.defaults['HTTP_X_CSRFTOKEN'] = 'bad-token'
        self.assertEqual(self.owner_client.post('/api/expenses/', self.expense_payload(), format='json', secure=True).status_code, 403)

    def test_hostile_origin_even_with_matching_csrf_is_denied(self):
        client = self.cookie_client(self.owner, origin=HOSTILE)
        self.assertEqual(client.post('/api/expenses/', self.expense_payload(), format='multipart', secure=True).status_code, 403)

    def test_https_missing_origin_and_referer_is_denied(self):
        client = self.cookie_client(self.owner, origin=None)
        self.assertEqual(client.post('/api/expenses/', self.expense_payload(), format='json', secure=True).status_code, 403)

    def test_login_without_csrf_is_denied(self):
        self.assertEqual(self.login(self.cookie_client(csrf=False)).status_code, 403)

    def test_login_with_hostile_origin_is_denied(self):
        self.assertEqual(self.login(self.cookie_client(origin=HOSTILE)).status_code, 403)

    def test_logout_without_csrf_is_denied(self):
        self.assertEqual(self.cookie_client(self.owner, csrf=False).post('/api/auth/logout/', secure=True).status_code, 403)

    def test_logout_with_hostile_origin_is_denied(self):
        self.assertEqual(self.cookie_client(self.owner, origin=HOSTILE).post('/api/auth/logout/', secure=True).status_code, 403)

    def test_logout_invalidates_copied_access_cookie(self):
        self.owner_client.post('/api/auth/logout/', secure=True)
        self.assertEqual(self.cookie_client(token=self.owner_cookie).get('/api/auth/me/', secure=True).status_code, 401)

    def test_password_change_invalidates_existing_access_cookie(self):
        self.owner.set_password('new-isolated-fixture-password')
        self.owner.save(update_fields=['password'])
        self.assertEqual(self.owner_client.get('/api/auth/me/', secure=True).status_code, 401)

    def test_expired_cookie_does_not_prevent_valid_relogin(self):
        self.assertEqual(self.login(self.expired_client()).status_code, 200)

    def test_expired_cookie_logout_still_clears_browser_auth(self):
        response = self.expired_client().post('/api/auth/logout/', secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]['max-age'], 0)

    def test_repeated_bad_login_is_rate_limited(self):
        client = self.cookie_client()
        statuses = [client.post('/api/auth/login/', {'username': self.owner.username, 'password': 'wrong'}, format='json', secure=True).status_code for _ in range(12)]
        self.assertIn(429, statuses)


class ProposedRoleContracts(CookieFixture, TestCase):
    """DRAFT least-privilege recommendations, awaiting business approval."""
    def test_staff_cannot_create_expense(self):
        self.assertEqual(self.staff_client.post('/api/expenses/', self.expense_payload(), format='json', secure=True).status_code, 403)

    def test_staff_cannot_change_catalog_price(self):
        self.assertEqual(self.staff_client.patch(f'/api/products/{self.product.pk}/', {'price': '0.01'}, format='json', secure=True).status_code, 403)

    def test_staff_cannot_change_recipe(self):
        self.assertEqual(self.staff_client.patch(f'/api/recipes/{self.recipe.pk}/', {'yield_quantity': 2}, format='json', secure=True).status_code, 403)

    def test_staff_cannot_adjust_stock(self):
        before = InventoryOperation.objects.count()
        self.assertEqual(self.stock_request(self.staff_client).status_code, 403)
        self.assertEqual(InventoryOperation.objects.count(), before)

    def test_staff_cannot_edit_own_recorded_sale(self):
        created = self.staff_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        pk = created.data['data']['id']
        self.assertEqual(self.staff_client.patch(f'/api/sales/{pk}/', {'notes': 'Unauthorized correction'}, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"').status_code, 403)

    def test_staff_cannot_cancel_own_recorded_sale(self):
        created = self.staff_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        pk = created.data['data']['id']
        self.assertEqual(self.staff_client.delete(f'/api/sales/{pk}/', {'reason': 'Unauthorized cancellation'}, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"').status_code, 403)
        self.assertEqual(Sale.objects.get(pk=pk).status, 'recorded')

    def test_staff_cannot_read_financial_summary(self):
        self.assertEqual(self.staff_client.get('/api/sales/financial-summary/', secure=True).status_code, 403)

    def test_staff_cannot_read_profit_margins(self):
        self.assertEqual(self.staff_client.get('/api/dashboard/profit-margins/', secure=True).status_code, 403)

    def test_staff_cannot_read_owner_dashboard(self):
        self.assertEqual(self.staff_client.get('/api/dashboard/', secure=True).status_code, 403)

    def test_staff_cannot_export_sales(self):
        self.assertEqual(self.staff_client.get('/api/sales/export/csv/', secure=True).status_code, 403)

    def test_role_downgrade_applies_to_existing_token(self):
        User.objects.filter(pk=self.owner.pk).update(role='staff')
        self.assertEqual(self.stock_request(self.owner_client).status_code, 403)

    def test_unknown_role_fails_closed(self):
        User.objects.filter(pk=self.owner.pk).update(role='unknown')
        self.assertEqual(self.stock_request(self.owner_client).status_code, 403)

    def test_django_superuser_flag_is_not_implicit_business_owner(self):
        User.objects.filter(pk=self.staff.pk).update(is_staff=True, is_superuser=True)
        self.assertEqual(self.stock_request(self.staff_client).status_code, 403)
