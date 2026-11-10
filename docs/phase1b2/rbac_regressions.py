"""Approved RBAC requirements, real cookies/CSRF and full state comparisons."""
from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib import admin
from django.test import TestCase, RequestFactory
from rest_framework.response import Response
from rest_framework.views import APIView
from security_cases import CookieFixture
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Product, Category
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry


class RBACRegressions(CookieFixture, TestCase):
    def snapshot(self):
        return [list(model.objects.order_by('pk').values()) for model in [Sale, SaleItem, InventoryOperation,
            ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry, Ingredient, Product, Category,
            Recipe, RecipeIngredient, Expense]]

    def create_staff(self, client=None, **changes):
        payload = {**self.sale_payload(), **changes}
        return (client or self.staff_client).post('/api/sales/', payload, format='json', secure=True,
            HTTP_IDEMPOTENCY_KEY=str(uuid4()))

    def test_every_owner_only_route_and_method_denies_staff_before_validation(self):
        routes = {
            '/api/expenses/':['get','post','head','options'], '/api/expenses/999/':['get','patch','put','delete','head','options'],
            '/api/expenses/export/csv/':['get','head'], '/api/expenses/export/pdf/':['get','head'],
            '/api/recipes/':['get','post','head','options'], f'/api/recipes/{self.recipe.pk}/':['get','put','patch','delete','head','options'],
            '/api/dashboard/':['get','head','options'], '/api/dashboard/profit-margins/':['get','head','options'],
            '/api/sales/financial-summary/':['get','head','options'], '/api/sales/export/csv/':['get','head'], '/api/sales/export/pdf/':['get','head'],
            '/api/products/':['post'], f'/api/products/{self.product.pk}/':['put','patch','delete'],
            '/api/products/categories/':['post'], f'/api/products/categories/{self.product.category_id}/':['put','patch','delete'],
            '/api/ingredients/':['post'], f'/api/ingredients/{self.ingredient.pk}/':['put','patch','delete'],
            f'/api/ingredients/{self.ingredient.pk}/adjustments/':['post','options'],
            f'/api/sales/{self.sale_id}/':['patch','put','delete'],
        }
        before = self.snapshot()
        for path, methods in routes.items():
            for method in methods:
                with self.subTest(path=path, method=method):
                    response = getattr(self.staff_client, method)(path, secure=True)
                    self.assertEqual(response.status_code, 403)
                    self.assertEqual(self.snapshot(), before)
                    self.assertNotIn(str(self.ingredient.cost_per_unit), str(response.data))

    def test_own_sale_list_detail_and_counts_exclude_other_and_legacy(self):
        own = self.create_staff()
        self.assertEqual(own.status_code, 201)
        pk = own.data['data']['id']
        legacy = Sale.objects.create(date=date.today(), total_amount='99')
        listing = self.staff_client.get('/api/sales/', secure=True)
        self.assertEqual(listing.data['data']['count'], 1)
        self.assertEqual([row['id'] for row in listing.data['data']['results']], [pk])
        self.assertEqual(self.staff_client.get(f'/api/sales/{pk}/', secure=True).status_code, 200)
        for hidden in [self.sale_id, legacy.pk, 999999]:
            response = self.staff_client.get(f'/api/sales/{hidden}/', secure=True)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(str(response.data), str(self.staff_client.get('/api/sales/999999/', secure=True).data))
        self.assertEqual(self.owner_client.get('/api/sales/', secure=True).data['data']['count'], 3)

    def test_claimed_tracking_without_creation_actor_does_not_grant_ownership(self):
        fake = Sale.objects.create(date=date.today(), total_amount='50', inventory_tracking='tracked', financial_tracking='ledger', revision=1)
        self.assertEqual(self.staff_client.get(f'/api/sales/{fake.pk}/', secure=True).status_code, 404)

    def test_other_staff_sale_hidden_even_when_id_is_known(self):
        other = User.objects.create_user(username='other-staff', role='staff')
        created = self.create_staff(self.cookie_client(other))
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.staff_client.get(f"/api/sales/{created.data['data']['id']}/", secure=True).status_code, 404)
        self.assertEqual(self.staff_client.get('/api/sales/', secure=True).data['data']['count'], 0)

    def test_operational_stock_exact_allowlist_on_all_read_paths(self):
        self.ingredient.supplier = 'PRIVATE-SUPPLIER'
        self.ingredient.notes = 'PRIVATE-NOTE'
        self.ingredient.minimum_stock = 200
        self.ingredient.save()
        paths = ['/api/ingredients/', f'/api/ingredients/{self.ingredient.pk}/', '/api/ingredients/low-stock/']
        for path in paths:
            response = self.staff_client.get(path, secure=True)
            self.assertEqual(response.status_code, 200)
            data = response.data['data']
            rows = data['results'] if isinstance(data, dict) and 'results' in data else data if isinstance(data, list) else [data]
            self.assertTrue(rows)
            for row in rows:
                self.assertEqual(set(row), {'id','name','quantity','unit','is_low_stock'})
            self.assertNotIn('PRIVATE-', str(response.data))
        owner = self.owner_client.get(paths[1], secure=True).data['data']
        self.assertEqual(owner['supplier'], 'PRIVATE-SUPPLIER')

    def test_public_catalog_projection_and_invalid_cookie_availability(self):
        private = Category.objects.create(name='PRIVATE-CATEGORY', slug='private-category', is_active=False)
        Product.objects.create(name='PRIVATE-PRODUCT', category=private, price='80')
        for client in [self.cookie_client(), self.cookie_client(token='malformed.cookie'), self.expired_client()]:
            for path in ['/api/products/', '/api/products/categories/']:
                response = client.get(path, secure=True)
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('PRIVATE-', str(response.data))
                self.assertNotIn('created_at', str(response.data))
                self.assertNotIn('product_count', str(response.data))
                self.assertIn('no-store', response['Cache-Control'])
                self.assertIn('Cookie', response['Vary'])
        self.assertEqual(self.cookie_client().get(f'/api/products/{self.product.pk}/', secure=True).status_code, 401)
        self.assertEqual(self.staff_client.get(f'/api/products/{self.product.pk}/', secure=True).status_code, 200)

    def test_unknown_inactive_deleted_and_flag_mismatched_users_fail_closed(self):
        for role, active, expected in [('unknown',True,403), ('admin',False,401), ('staff',True,403)]:
            User.objects.filter(pk=self.owner.pk).update(role=role, is_active=active, is_staff=True, is_superuser=True)
            for path in ['/api/dashboard/', '/api/recipes/', '/api/expenses/']:
                self.assertEqual(self.owner_client.get(path, secure=True).status_code, expected)
        User.objects.filter(pk=self.owner.pk).update(role='unknown', is_active=True)
        self.assertEqual(self.owner_client.get('/api/products/', secure=True).status_code, 403)
        response = self.login(self.cookie_client())
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(settings.SIMPLE_JWT['AUTH_COOKIE'], response.cookies)
        unused = User.objects.create_user(username='deleted-unused')
        client = self.cookie_client(unused)
        unused.delete()
        self.assertEqual(client.get('/api/sales/', secure=True).status_code, 401)

    def test_staff_current_price_rejected_before_any_write(self):
        payload = self.sale_payload()
        payload['sale_items'][0]['unit_price'] = '49.99'
        before = self.snapshot()
        self.assertEqual(self.create_staff(**payload).status_code, 400)
        self.assertEqual(self.snapshot(), before)

    def test_staff_date_is_explicit_manila_not_server_utc(self):
        instant = datetime(2026, 11, 9, 17, 30, tzinfo=dt_timezone.utc)
        before = self.snapshot()
        with patch('django.utils.timezone.now', return_value=instant):
            self.assertEqual(self.create_staff(date=date(2026,11,9).isoformat()).status_code, 400)
            self.assertEqual(self.snapshot(), before)
            self.assertEqual(self.create_staff(date=date(2026,11,10).isoformat()).status_code, 201)

    def test_exact_staff_replay_survives_catalog_price_date_recipe_availability_changes(self):
        key, payload = str(uuid4()), self.sale_payload()
        first = self.staff_client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(first.status_code, 201)
        Product.objects.filter(pk=self.product.pk).update(price='77.00', is_available=False)
        self.recipe.delete()
        before = self.snapshot()
        with patch('django.utils.timezone.now', return_value=datetime(2030,1,1,tzinfo=dt_timezone.utc)):
            replay = self.staff_client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data, first.data)
        self.assertEqual(replay['Idempotency-Replayed'], 'true')
        self.assertEqual(self.snapshot(), before)
        payload['sale_items'][0]['unit_price'] = '77.00'
        self.assertEqual(self.staff_client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key).status_code, 409)
        self.assertEqual(self.snapshot(), before)

    def test_downgrade_denies_previously_successful_owner_response_replay(self):
        key = str(uuid4())
        path = f'/api/ingredients/{self.ingredient.pk}/adjustments/'
        payload = {'delta':'1.000000000','reason':'Count correction'}
        args = dict(format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"1"')
        # Fixture sale has already advanced revision to 1.
        self.assertEqual(self.owner_client.post(path, payload, **args).status_code, 200)
        User.objects.filter(pk=self.owner.pk).update(role='staff')
        before = self.snapshot()
        self.assertEqual(self.owner_client.post(path, payload, **args).status_code, 403)
        self.assertEqual(self.snapshot(), before)

    def test_default_unmapped_private_action_denied_even_for_owner(self):
        class Unmapped(APIView):
            def get(self, request): return Response({'secret':'must not leak'})
        native = RequestFactory().get('/api/unmapped/', secure=True)
        native.COOKIES = {key:value.value for key,value in self.owner_client.cookies.items()}
        response = Unmapped.as_view()(native)
        self.assertEqual(response.status_code, 403)

    def test_staff_options_and_html_do_not_leak_owner_serializer_fields(self):
        for method in ['get','options']:
            for path in ['/api/recipes/', '/api/expenses/', '/api/dashboard/']:
                response = getattr(self.staff_client, method)(path, secure=True, HTTP_ACCEPT='text/html,application/json')
                self.assertEqual(response.status_code, 403)
                self.assertNotIn('cost_per_unit', str(response.data))
                self.assertNotIn('supplier', str(response.data))

    def test_direct_command_stale_actor_cannot_bypass_current_database_role(self):
        from sales.services import adjust_stock, execute_sale
        from rest_framework.exceptions import PermissionDenied
        User.objects.filter(pk=self.owner.pk).update(role='staff')
        before = self.snapshot()
        with self.assertRaises(PermissionDenied):
            adjust_stock(actor=self.owner, key=uuid4(), ingredient_id=self.ingredient.pk, expected_revision=1, delta=Decimal('1'), reason='Denied')
        with self.assertRaises(PermissionDenied):
            execute_sale(action='sale_cancel', actor=self.owner, key=uuid4(), sale_id=self.sale_id, expected_revision=1, reason='Denied')
        self.assertEqual(self.snapshot(), before)

    def test_admin_site_requires_business_owner_and_existing_technical_permissions(self):
        factory = RequestFactory()
        for user, allowed in [(self.owner,False),(self.staff,False)]:
            request = factory.get('/admin/')
            request.user = user
            self.assertEqual(admin.site.has_permission(request), allowed)
        self.staff.is_staff = self.staff.is_superuser = True
        request.user = self.staff
        self.assertFalse(admin.site.has_permission(request))
        self.owner.is_staff = self.owner.is_superuser = True
        request.user = self.owner
        self.assertTrue(admin.site.has_permission(request))
        for model in [Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]:
            model_admin = admin.site._registry[model]
            self.assertFalse(model_admin.has_change_permission(request))
            self.assertFalse(model_admin.has_delete_permission(request))
            self.assertFalse(model_admin.has_add_permission(request))

    def test_owner_positive_custom_price_date_management_and_reconciliation(self):
        self.assertEqual(self.owner_client.patch(f'/api/products/{self.product.pk}/', {'price':'55.00'}, format='json', secure=True).status_code, 200)
        payload = self.sale_payload()
        payload.update(date='2024-01-02')
        payload['sale_items'][0]['unit_price'] = '45.25'
        created = self.owner_client.post('/api/sales/', payload, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['data']['total_amount'], '45.25')
        from sales.test_verification_extended import assert_reconciled
        assert_reconciled(self)

    def test_staff_allowed_sale_keeps_csrf_and_source_rejection_before_writes(self):
        for client in [self.cookie_client(self.staff, csrf=False), self.cookie_client(self.staff, origin='https://hostile.example')]:
            before = self.snapshot()
            self.assertEqual(self.create_staff(client).status_code, 403)
            self.assertEqual(self.snapshot(), before)

    def test_private_read_matrix_for_anonymous_unknown_inactive(self):
        paths = ['/api/ingredients/', f'/api/ingredients/{self.ingredient.pk}/', '/api/ingredients/low-stock/', '/api/recipes/',
            f'/api/recipes/{self.recipe.pk}/', '/api/sales/', f'/api/sales/{self.sale_id}/', '/api/sales/export/pdf/',
            '/api/sales/financial-summary/', '/api/expenses/', '/api/expenses/export/csv/', '/api/expenses/export/pdf/',
            '/api/dashboard/', '/api/dashboard/profit-margins/', '/api/auth/me/']
        for role, active, expected in [(None,None,401),('unknown',True,403),('admin',False,401)]:
            if role:
                User.objects.filter(pk=self.owner.pk).update(role=role, is_active=active)
            client = self.owner_client if role else self.cookie_client()
            for path in paths:
                with self.subTest(role=role, path=path):
                    response = client.get(path, secure=True)
                    self.assertEqual(response.status_code, expected)
                    self.assertNotIn('cost_per_unit', str(response.data))
                    self.assertNotIn('supplier', str(response.data))

    def test_api_endpoint_inventory_has_explicit_default_deny_mapping(self):
        from django.urls import get_resolver, URLPattern, URLResolver
        from accounts.permissions import BusinessPermission
        from accounts.views import CSRFTokenView, LoginView, LogoutView
        views = []
        def walk(patterns, prefix=''):
            for pattern in patterns:
                path = prefix + str(pattern.pattern)
                if isinstance(pattern, URLResolver): walk(pattern.url_patterns, path)
                elif path.startswith('api/'):
                    view = getattr(pattern.callback, 'view_class', None) or getattr(pattern.callback, 'cls', None)
                    self.assertIsNotNone(view, path)
                    views.append(view)
                    if view not in [CSRFTokenView, LoginView, LogoutView]:
                        self.assertIn(BusinessPermission, view.permission_classes, path)
                        for method in ['get','post','put','patch','delete']:
                            if hasattr(view, method): self.assertIn(method.upper(), view.business_actions, (path, method))
        walk(get_resolver().url_patterns)
        self.assertEqual(len(views), 25)

    def test_stored_owner_edit_cannot_be_disclosed_through_staff_create_replay(self):
        key = str(uuid4())
        self.assertEqual(self.owner_client.patch(f'/api/sales/{self.sale_id}/', {'notes':'OWNER-PRIVATE-EDIT'},
            format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key, HTTP_IF_MATCH='"1"').status_code, 200)
        User.objects.filter(pk=self.owner.pk).update(role='staff')
        before = self.snapshot()
        response = self.owner_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('OWNER-PRIVATE-EDIT', str(response.data))
        self.assertEqual(self.snapshot(), before)

    def test_staff_technical_superuser_admin_http_write_is_blocked_without_mutation(self):
        self.staff.is_staff = self.staff.is_superuser = True
        self.staff.save(update_fields=['is_staff','is_superuser'])
        login_form = admin.site.login_form(request=RequestFactory().get('/admin/login/'),
            data={'username':self.staff.username, 'password':self.password})
        self.assertFalse(login_form.is_valid(), 'Technical superuser/staff flags must not permit business admin login')
        self.client.force_login(self.staff)
        before = self.snapshot()
        response = self.client.post(f'/admin/ingredients/ingredient/{self.ingredient.pk}/change/', {'supplier':'DENIED','quantity':'999'}, secure=True)
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response.url)
        self.assertEqual(self.snapshot(), before)
        self.owner.is_staff = True
        self.owner.save(update_fields=['is_staff'])
        owner_form = admin.site.login_form(request=RequestFactory().get('/admin/login/'),
            data={'username':self.owner.username, 'password':self.password})
        self.assertTrue(owner_form.is_valid(), owner_form.errors)
