"""WRITTEN, NOT RUN: requires separately authorized migrated disposable DB.

Use TransactionTestCase: throttle allocation deliberately rejects an enclosing
application transaction. Real cookies/CSRF, no force_authenticate and no mocks
of the session authenticator, capabilities, ledger, or database triggers.
"""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
from django.conf import settings
from django.db import connection, transaction, DatabaseError
from django.middleware.csrf import _get_new_csrf_string
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient
from accounts import session_tokens
from accounts.models import User, DeviceSession, AuthThrottleBucket
from accounts.session_database import database_time, lock_users
from accounts.session_policy import ABSOLUTE, jti_digest
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry

TEST_AUTH = dict(AUTH_SESSION_SIGNING_KEY='disposable-only-session-key-'+'s'*40,AUTH_SESSION_ENV='disposable',
    AUTH_RATE_KEYS={'1':'disposable-only-throttle-key-'+'t'*40},AUTH_RATE_LIMITS={'LA':5,'LI':20,'LR':60,'RR':30},
    AUTH_MAX_BUCKET_ROWS=50000,AUTH_PROXY_MODE='direct',AUTH_TRUSTED_PROXY_CIDRS=[])
BUSINESS_MODELS = (Sale,SaleItem,InventoryOperation,ConsumptionBasis,SaleConsumption,StockMovement,SaleFinancialEntry,
    Ingredient,Product,Category,Recipe,RecipeIngredient,Expense)


def cookie_client(tokens=None,*,csrf=True,origin='https://testserver',ip='192.0.2.10'):
    client=APIClient(enforce_csrf_checks=True)
    if tokens:
        for key,name in [('access',settings.SIMPLE_JWT['AUTH_COOKIE']),('refresh',settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']),('locator','device_session')]:
            client.cookies[name]=tokens[key]
    if csrf:
        secret=_get_new_csrf_string()
        client.cookies[settings.CSRF_COOKIE_NAME]=secret
        client.defaults['HTTP_X_CSRFTOKEN']=secret
    if origin is not None: client.defaults['HTTP_ORIGIN']=origin
    client.defaults['REMOTE_ADDR']=ip
    return client


def bind_fixture(user):
    """Existing business tests use real V2 cookies without password quota noise."""
    with transaction.atomic():
        current=lock_users([user.pk]).get(user.pk)
        now=database_time()
        jti='test-fixture-'+uuid4().hex
        row=DeviceSession.objects.create(user=current,user_epoch=current.session_epoch,created_at=now,last_activity_at=now,
            absolute_expires_at=now+ABSOLUTE,refresh_jti_hash=jti_digest(jti))
        return row,session_tokens.pair(row,now,jti)


@override_settings(**TEST_AUTH)
class SessionAPIContracts(TransactionTestCase):
    password='isolated-only-current-password'

    def setUp(self):
        self.owner=User.objects.create_user(username='session-owner',password=self.password,role='admin')
        self.staff=User.objects.create_user(username='session-staff',password=self.password,role='staff')
        self.row,self.tokens=bind_fixture(self.owner)
        self.client=cookie_client(self.tokens)
        category=Category.objects.create(name='Session fixture',slug='session-fixture')
        self.product=Product.objects.create(name='Session product',category=category,price='50')
        self.ingredient=Ingredient.objects.create(name='Session flour',quantity='10',unit='kg',cost_per_unit='1')
        self.recipe=Recipe.objects.create(product=self.product,yield_quantity=3)
        RecipeIngredient.objects.create(recipe=self.recipe,ingredient=self.ingredient,quantity='.01')

    def state(self):
        return [list(model.objects.order_by('pk').values()) for model in BUSINESS_MODELS]

    def me(self,client=None):
        return (client or self.client).get('/api/auth/me/',secure=True)

    def login(self,client=None,username=None,password=None):
        return (client or cookie_client()).post('/api/auth/login/',{'username':username or self.owner.username,
            'password':self.password if password is None else password},format='json',secure=True)

    def sale(self,client=None,key=None):
        return (client or self.client).post('/api/sales/',{'date':'2026-11-09','sale_items':[
            {'product':self.product.pk,'quantity':1,'unit_price':'50.00'}]},format='json',secure=True,HTTP_IDEMPOTENCY_KEY=key or str(uuid4()))

    def test_logout_invalidates_copied_access_cookie(self):
        copied=cookie_client(self.tokens)
        self.assertEqual(self.me(copied).status_code,200)
        self.assertEqual(self.client.post('/api/auth/logout/',secure=True).status_code,200)
        self.assertEqual(self.me(copied).status_code,401)

    def test_password_change_invalidates_existing_access_cookie(self):
        self.assertEqual(self.me().status_code,200)
        self.owner.set_password('different-isolated-password')
        self.owner.save(update_fields=['password'])
        self.assertEqual(self.me().status_code,401)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.session_epoch,2)
        self.row.refresh_from_db()
        self.assertEqual(self.row.revocation_reason,'credentials_changed')

    def test_repeated_bad_login_is_rate_limited(self):
        client=cookie_client()
        self.assertEqual([self.login(client,password='wrong').status_code for _ in range(5)],[401]*5)
        blocked=self.login(client,password=self.password)
        self.assertEqual(blocked.status_code,429)
        self.assertGreater(int(blocked['Retry-After']),0)
        self.assertEqual(DeviceSession.objects.count(),1)

    def test_logout_current_device_only_and_repeat(self):
        _,other=bind_fixture(self.owner)
        self.assertEqual(self.client.post('/api/auth/logout/',secure=True).status_code,200)
        self.assertEqual(self.me(cookie_client(other)).status_code,200)
        self.assertEqual(cookie_client(self.tokens).post('/api/auth/logout/',secure=True).status_code,200)

    def test_expired_access_locator_logout_recovery(self):
        self.client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]='expired.invalid'
        del self.client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]
        response=self.client.post('/api/auth/logout/',secure=True)
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.data['data']['server_session_identified'])
        self.assertEqual(self.me(cookie_client(self.tokens)).status_code,401)

    def test_locator_cannot_authenticate_or_refresh(self):
        client=cookie_client(self.tokens)
        del client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]
        del client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]
        self.assertEqual(self.me(client).status_code,401)
        self.assertEqual(client.post('/api/auth/refresh/',secure=True).status_code,401)

    def test_logout_without_identifiable_proof_is_explicit_cleanup_only(self):
        response=cookie_client().post('/api/auth/logout/',secure=True)
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.data['data']['server_session_identified'])
        self.assertEqual(self.me().status_code,200)

    def test_failed_logout_keeps_proof_cookies_and_never_claims_success(self):
        with patch('accounts.device_sessions.revoke_proven',side_effect=DatabaseError('injected')):
            response=self.client.post('/api/auth/logout/',secure=True)
        self.assertEqual(response.status_code,503)
        for name in (settings.SIMPLE_JWT['AUTH_COOKIE'],settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],'device_session'):
            self.assertNotIn(name,response.cookies)
        self.assertEqual(self.me().status_code,200)

    def test_queryset_and_raw_sql_security_changes_revoke(self):
        for field,value in [('role','staff'),('role','admin'),('is_active',False),('is_active',True),('is_staff',True),('is_superuser',True)]:
            self.owner.refresh_from_db()
            if self.owner.is_active:
                row,tokens=bind_fixture(self.owner)
            else:
                row,tokens=self.row,self.tokens
            previous=self.owner.session_epoch
            with connection.cursor() as cursor:
                table=connection.ops.quote_name(User._meta.db_table)
                cursor.execute(f'UPDATE {table} SET {connection.ops.quote_name(field)}=%s WHERE id=%s',[value,self.owner.pk])
            self.owner.refresh_from_db()
            self.assertEqual(self.owner.session_epoch,previous+1)
            self.assertEqual(self.me(cookie_client(tokens)).status_code,401)
        User.objects.filter(pk=self.owner.pk).update(password='unusable-changed-encoding')
        self.assertEqual(self.me().status_code,401)

    def test_direct_epoch_updates_even_noops_are_rejected(self):
        for expression in (1,0,2):
            with self.assertRaises(DatabaseError),transaction.atomic():
                User.objects.filter(pk=self.owner.pk).update(session_epoch=expression)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.session_epoch,1)

    def test_automatic_hash_upgrade_issues_current_epoch_and_revokes_old(self):
        from django.contrib.auth.hashers import PBKDF2PasswordHasher
        hasher=PBKDF2PasswordHasher()
        encoded=hasher.encode(self.password,hasher.salt(),iterations=1)
        User.objects.filter(pk=self.owner.pk).update(password=encoded)
        self.owner.refresh_from_db()
        row,old=bind_fixture(self.owner)
        with override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.PBKDF2PasswordHasher']):
            client=cookie_client()
            response=self.login(client)
        self.assertEqual(response.status_code,200)
        self.owner.refresh_from_db()
        claims=session_tokens.decode(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']].value,'access',allow_expired=True)
        self.assertEqual(claims['se'],self.owner.session_epoch)
        self.assertEqual(self.me(client).status_code,200)
        self.assertEqual(self.me(cookie_client(old)).status_code,401)

    def test_refresh_rotates_once_without_activity_or_absolute_extension(self):
        response=self.client.post('/api/auth/refresh/',secure=True)
        self.assertEqual(response.status_code,200)
        self.row.refresh_from_db()
        self.assertEqual(self.row.refresh_generation,1)
        self.assertEqual(self.row.absolute_expires_at,self.row.created_at+ABSOLUTE)
        self.assertEqual(self.row.last_activity_at,self.row.created_at)
        copied=cookie_client(self.tokens)
        self.assertEqual(copied.post('/api/auth/refresh/',secure=True).status_code,401)
        self.assertEqual(self.me().status_code,401)
        self.row.refresh_from_db()
        self.assertEqual(self.row.revocation_reason,'refresh_reuse')

    def test_auth_polling_bootstrap_and_denials_never_renew_activity(self):
        before=self.row.last_activity_at
        self.assertEqual(self.me().status_code,200)
        self.assertEqual(self.client.get('/api/auth/csrf/',secure=True).status_code,200)
        bad=cookie_client(self.tokens,origin='https://hostile.example')
        self.assertEqual(self.sale(bad).status_code,403)
        self.row.refresh_from_db()
        self.assertEqual(self.row.last_activity_at,before)

    def test_idle_and_absolute_boundaries_deny_and_do_not_write_business(self):
        before=self.state()
        for instant in (self.row.last_activity_at+timedelta(minutes=30),self.row.absolute_expires_at):
            with patch('accounts.device_sessions.database_time',return_value=instant):
                self.assertEqual(self.sale().status_code,401)
        self.assertEqual(self.state(),before)

    def test_session_admission_samples_clock_after_user_and_device_locks(self):
        events=[]
        actual_lock=lock_users
        actual_time=database_time
        def observe_lock(*args,**kwargs):
            result=actual_lock(*args,**kwargs);events.append('user');return result
        def observe_time():
            events.append('time');return actual_time()
        with patch('accounts.device_sessions.lock_users',side_effect=observe_lock),patch('accounts.device_sessions.database_time',side_effect=observe_time):
            self.assertEqual(self.me().status_code,200)
        self.assertLess(events.index('user'),events.index('time'))

    def test_revoked_session_cannot_read_successful_idempotent_response(self):
        key=str(uuid4())
        response=self.sale(key=key)
        self.assertEqual(response.status_code,201)
        before=self.state()
        cookie_client(self.tokens).post('/api/auth/logout/',secure=True)
        self.assertEqual(self.sale(key=key).status_code,401)
        self.assertEqual(self.state(),before)

    def test_fresh_session_same_actor_exact_replay_does_not_reprice(self):
        key=str(uuid4())
        first=self.sale(key=key)
        self.assertEqual(first.status_code,201)
        Product.objects.filter(pk=self.product.pk).update(price='99')
        _,new=bind_fixture(self.owner)
        second=self.sale(cookie_client(new),key)
        self.assertEqual(second.data,first.data)
        self.assertEqual(Sale.objects.count(),1)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity,Decimal('9.996666667'))

    def test_financial_and_inventory_reconciliation_survives_sessions(self):
        for _ in range(3): self.assertEqual(self.sale().status_code,201)
        from sales.test_verification_extended import assert_reconciled
        assert_reconciled(self)

    def test_csrf_origin_and_legacy_cookies_cause_zero_business_writes(self):
        from rest_framework_simplejwt.tokens import AccessToken
        before=self.state()
        for client in (cookie_client(self.tokens,csrf=False),cookie_client(self.tokens,origin='https://hostile.example')):
            self.assertEqual(self.sale(client).status_code,403)
        legacy=cookie_client(self.tokens)
        legacy.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]=str(AccessToken.for_user(self.owner))
        self.assertEqual(self.sale(legacy).status_code,401)
        self.assertEqual(self.state(),before)

    def test_session_creation_exception_rolls_back_row_and_does_not_issue_cookies(self):
        before=DeviceSession.objects.count()
        with patch('accounts.session_tokens.pair',side_effect=DatabaseError('injected')):
            response=self.login()
        self.assertEqual(response.status_code,503)
        self.assertEqual(DeviceSession.objects.count(),before)
        self.assertNotIn(settings.SIMPLE_JWT['AUTH_COOKIE'],response.cookies)

    def test_throttle_outage_and_row_cap_fail_closed(self):
        with patch('accounts.login_limiter.allocate',side_effect=DatabaseError('injected')):
            self.assertEqual(self.login().status_code,503)
        with override_settings(AUTH_MAX_BUCKET_ROWS=1):
            self.assertEqual(self.login().status_code,503)
        self.assertEqual(DeviceSession.objects.count(),1)

    def test_unknown_accounts_success_and_spoofed_headers_share_counter_rules(self):
        client=cookie_client()
        for _ in range(4): self.assertEqual(self.login(client,username='missing',password='wrong').status_code,401)
        client.defaults['HTTP_X_FORWARDED_FOR']='198.51.100.9'
        self.assertEqual(self.login(client,username='missing',password='wrong').status_code,401)
        self.assertEqual(self.login(client,username='missing',password='wrong').status_code,429)
        self.assertEqual(self.login(client).status_code,200)  # Different LA; same nonfull LI.
        failures=AuthThrottleBucket.objects.get(scope='LI').event_times
        self.assertEqual(len(failures),5)  # Successful login did not reset IP history.

    def test_nat_ip_limit_across_distinct_accounts(self):
        client=cookie_client()
        for account in range(4):
            for _ in range(5): self.assertEqual(self.login(client,username=f'unknown-{account}',password='wrong').status_code,401)
        self.assertEqual(self.login(client,username='new-unknown',password='wrong').status_code,429)
        self.assertFalse(AuthThrottleBucket.objects.filter(scope='LA').count()>4)

    def test_refresh_csrf_and_source_fail_before_rotation(self):
        for client in (cookie_client(self.tokens,csrf=False),cookie_client(self.tokens,origin='https://hostile.example')):
            self.assertEqual(client.post('/api/auth/refresh/',secure=True).status_code,403)
        self.row.refresh_from_db()
        self.assertEqual(self.row.refresh_generation,0)

    def test_guard_absence_cannot_enable_partial_schema_login(self):
        from accounts.session_errors import AuthUnavailable
        with patch('accounts.session_database.assert_database_guards',side_effect=AuthUnavailable()):
            self.assertEqual(self.login().status_code,503)
            self.assertEqual(self.me().status_code,503)

    def test_staff_technical_flags_cannot_login_admin(self):
        User.objects.filter(pk=self.staff.pk).update(is_staff=True,is_superuser=True)
        client=cookie_client()
        before=self.state()
        response=client.post('/admin/login/',{'username':self.staff.username,'password':self.password},secure=True)
        self.assertEqual(response.status_code,200)
        self.assertNotIn('_auth_user_id',client.session)
        self.assertEqual(self.state(),before)

    def test_admin_login_epoch_change_and_password_change_require_fresh_login(self):
        User.objects.filter(pk=self.owner.pk).update(is_staff=True,is_superuser=True)
        client=cookie_client()
        response=client.post('/admin/login/',{'username':self.owner.username,'password':self.password},secure=True)
        self.assertEqual(response.status_code,302)
        self.assertEqual(client.get('/admin/',secure=True).status_code,200)
        client.defaults['HTTP_X_CSRFTOKEN']=client.cookies[settings.CSRF_COOKIE_NAME].value
        self.owner.refresh_from_db()
        self.assertEqual(client.session['_business_auth_epoch'],self.owner.session_epoch)
        response=client.post('/admin/password_change/',{'old_password':self.password,
            'new_password1':'new-isolated-Strong-Pass-123!','new_password2':'new-isolated-Strong-Pass-123!'},secure=True)
        self.assertEqual(response.status_code,302)
        self.assertNotIn('_auth_user_id',client.session)
        self.assertEqual(client.get('/admin/',secure=True).status_code,302)
        self.assertEqual(self.me().status_code,401)

    def test_admin_and_api_failures_share_account_limit(self):
        client=cookie_client()
        for _ in range(4): self.assertEqual(self.login(client,password='wrong').status_code,401)
        response=client.post('/admin/login/',{'username':self.owner.username,'password':'wrong'},secure=True)
        self.assertEqual(response.status_code,200)  # Django invalid form; fifth failure committed.
        self.assertEqual(self.login(client,password='wrong').status_code,429)

    def test_missing_and_epoch_mismatched_sessions_cannot_write(self):
        import jwt
        before=self.state()
        claims=session_tokens.decode(self.tokens['access'],'access',allow_expired=True)
        claims['se']+=1
        wrong=cookie_client(self.tokens)
        wrong.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]=jwt.encode(claims,settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
        self.assertEqual(self.sale(wrong).status_code,401)
        self.row.delete()  # Isolated security fixture only; no business FK points to it.
        self.assertEqual(self.sale().status_code,401)
        self.assertEqual(self.state(),before)

    def test_database_device_guards_reject_identity_generation_and_resurrection(self):
        changes=[{'user_id':self.staff.pk},{'user_epoch':2},{'created_at':self.row.created_at-timedelta(seconds=1)},
            {'absolute_expires_at':self.row.absolute_expires_at+timedelta(seconds=1)},
            {'refresh_generation':2},{'refresh_jti_hash':'b'*64}]
        for values in changes:
            with self.assertRaises(DatabaseError),transaction.atomic():
                DeviceSession.objects.filter(pk=self.row.pk).update(**values)
        DeviceSession.objects.filter(pk=self.row.pk).update(revoked_at=database_time(),revocation_reason='logout')
        with self.assertRaises(DatabaseError),transaction.atomic():
            DeviceSession.objects.filter(pk=self.row.pk).update(revoked_at=None,revocation_reason='')

    def test_account_transaction_exception_rolls_back_epoch_and_revocations(self):
        with self.assertRaises(RuntimeError),transaction.atomic():
            User.objects.filter(pk=self.owner.pk).update(role='staff')
            raise RuntimeError('injected before commit')
        self.owner.refresh_from_db();self.row.refresh_from_db()
        self.assertEqual(self.owner.session_epoch,1)
        self.assertIsNone(self.row.revoked_at)
        self.assertEqual(self.me().status_code,200)

    def test_activity_persistence_failure_rolls_back_all_business_writes(self):
        before=self.state()
        save=DeviceSession.save
        def injected(instance,*args,**kwargs):
            if kwargs.get('update_fields')==['last_activity_at']: raise DatabaseError('injected')
            return save(instance,*args,**kwargs)
        with patch.object(DeviceSession,'save',injected):
            self.assertEqual(self.sale().status_code,503)
        self.assertEqual(self.state(),before)
