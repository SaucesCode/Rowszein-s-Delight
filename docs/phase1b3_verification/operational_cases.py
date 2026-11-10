from django.test import TransactionTestCase,RequestFactory,override_settings
from accounts import login_limiter
from session_api_contracts import TEST_AUTH
from django.db import connection
from unittest import skipUnless
from datetime import timedelta
from unittest.mock import patch
from accounts.models import User,DeviceSession,AuthThrottleBucket
from accounts.session_database import database_time
from session_api_contracts import cookie_client,bind_fixture


@override_settings(**TEST_AUTH)
class OperationalContracts(TransactionTestCase):
    @skipUnless(connection.vendor=='sqlite','SQLite DDL formatting regression')
    def test_sqlite_trigger_retains_epoch_format_literal(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT sql FROM sqlite_master WHERE name='accounts_throttle_update'")
            sql=cursor.fetchone()[0]
        print('Stored SQLite throttle trigger: '+sql)
        self.assertIn("strftime('%s',",sql)

    def test_limiter_database_debit_round_trip(self):
        request=RequestFactory().post('/api/auth/login/',REMOTE_ADDR='192.0.2.10')
        login_limiter.debit(request,'LR')
        with login_limiter.credential_gate(request,'unknown') as outcome:
            outcome['failed']=True

    def test_default_lr_sixty_malformed_submissions_then_429(self):
        client=cookie_client()
        for _ in range(60):
            self.assertEqual(client.post('/api/auth/login/',{},format='json',secure=True).status_code,400)
        self.assertEqual(client.post('/api/auth/login/',{},format='json',secure=True).status_code,429)
        self.assertEqual(len(AuthThrottleBucket.objects.get(scope='LR').event_times),60)
        self.assertFalse(AuthThrottleBucket.objects.filter(scope='LA').exists())

    def test_default_rr_thirty_invalid_refreshes_then_429(self):
        client=cookie_client()
        for _ in range(30): self.assertEqual(client.post('/api/auth/refresh/',secure=True).status_code,401)
        self.assertEqual(client.post('/api/auth/refresh/',secure=True).status_code,429)
        self.assertEqual(len(AuthThrottleBucket.objects.get(scope='RR').event_times),30)

    def test_exact_five_minute_boundary_and_dual_key_no_reset(self):
        now=database_time()
        request=RequestFactory().post('/api/auth/login/',REMOTE_ADDR='192.0.2.10')
        with patch('accounts.login_limiter.database_time',return_value=now):
            for _ in range(5):
                with login_limiter.credential_gate(request,'unknown') as outcome: outcome['failed']=True
        from rest_framework.exceptions import Throttled
        with override_settings(AUTH_RATE_KEYS={'1':TEST_AUTH['AUTH_RATE_KEYS']['1'],'2':'second-disposable-only-key-'+'z'*40}):
            with patch('accounts.login_limiter.database_time',return_value=now+timedelta(seconds=299)),self.assertRaises(Throttled):
                with login_limiter.credential_gate(request,'unknown'): pass
            with patch('accounts.login_limiter.database_time',return_value=now+timedelta(seconds=300)):
                with login_limiter.credential_gate(request,'unknown') as outcome: outcome['failed']=True
            self.assertEqual(AuthThrottleBucket.objects.filter(scope='LA').count(),2)
            self.assertEqual([len(row.event_times) for row in AuthThrottleBucket.objects.filter(scope='LA')],[1,1])

    def test_missing_keys_fail_closed_without_creating_session(self):
        user=User.objects.create_user(username='operational-owner',password='synthetic-password',role='admin')
        row,tokens=bind_fixture(user)
        for setting,value in [('AUTH_SESSION_SIGNING_KEY',''),('AUTH_RATE_KEYS',{})]:
            with override_settings(**{setting:value}):
                response=cookie_client().post('/api/auth/login/',{'username':user.username,'password':'synthetic-password'},format='json',secure=True)
                self.assertEqual(response.status_code,503)
                self.assertNotIn('access_token',response.cookies)
                self.assertEqual(DeviceSession.objects.count(),1)

    def test_unverified_proxy_never_falls_back_to_shared_peer(self):
        with override_settings(AUTH_PROXY_MODE='proxy',AUTH_TRUSTED_PROXY_CIDRS=['10.0.0.0/8']):
            client=cookie_client(ip='192.0.2.10')
            client.defaults['HTTP_X_FORWARDED_FOR']='198.51.100.5'
            self.assertEqual(client.post('/api/auth/login/',{},format='json',secure=True).status_code,503)
            self.assertFalse(AuthThrottleBucket.objects.exists())

    @skipUnless(connection.vendor=='postgresql','Real PostgreSQL permission outage')
    def test_database_permission_outage_retains_logout_proofs(self):
        from uuid import uuid4
        role='outage_'+uuid4().hex
        user=User.objects.create_user(username='outage-owner',role='admin')
        _,tokens=bind_fixture(user)
        with connection.cursor() as cursor: cursor.execute('CREATE ROLE '+role)
        try:
            with connection.cursor() as cursor: cursor.execute('SET ROLE '+role)
            response=cookie_client(tokens).post('/api/auth/logout/',secure=True)
            self.assertEqual(response.status_code,503)
            self.assertNotIn('access_token',response.cookies)
            self.assertNotIn('refresh_token',response.cookies)
        finally:
            with connection.cursor() as cursor: cursor.execute('RESET ROLE');cursor.execute('DROP ROLE '+role)
        self.assertEqual(cookie_client(tokens).get('/api/auth/me/',secure=True).status_code,200)

    @skipUnless(connection.vendor=='postgresql','Production-size PostgreSQL allocation cap/cleanup test')
    def test_fifty_thousand_bucket_cap_and_bounded_cleanup(self):
        from django.core.management import call_command
        import io
        old=database_time()-timedelta(hours=25)
        AuthThrottleBucket.objects.bulk_create([AuthThrottleBucket(scope='LA',key_version=1,subject_digest=f'{index:064x}',
            event_times=[],updated_at=old) for index in range(50000)],batch_size=1000)
        self.assertEqual(AuthThrottleBucket.objects.count(),50000)
        client=cookie_client()
        response=client.post('/api/auth/login/',{'username':'unknown','password':'wrong'},format='json',secure=True)
        self.assertEqual(response.status_code,503)
        self.assertEqual(AuthThrottleBucket.objects.count(),50000)
        call_command('cleanup_auth_security',stdout=io.StringIO())
        self.assertEqual(AuthThrottleBucket.objects.count(),50000)
        call_command('cleanup_auth_security',execute=True,batch_size=1000,stdout=io.StringIO())
        self.assertEqual(AuthThrottleBucket.objects.count(),49000)
        self.assertEqual(client.post('/api/auth/login/',{'username':'unknown','password':'wrong'},format='json',secure=True).status_code,401)

    @skipUnless(connection.vendor=='postgresql','Actual PostgreSQL disabled-trigger admission check')
    def test_disabled_database_guard_fails_closed_then_recovers(self):
        user=User.objects.create_user(username='guard-owner',role='admin')
        _,tokens=bind_fixture(user)
        with connection.cursor() as cursor: cursor.execute('ALTER TABLE accounts_devicesession DISABLE TRIGGER accounts_device_guard')
        try:
            self.assertEqual(cookie_client(tokens).get('/api/auth/me/',secure=True).status_code,503)
            self.assertEqual(cookie_client().post('/api/auth/login/',{},format='json',secure=True).status_code,503)
        finally:
            with connection.cursor() as cursor: cursor.execute('ALTER TABLE accounts_devicesession ENABLE TRIGGER accounts_device_guard')
        self.assertEqual(cookie_client(tokens).get('/api/auth/me/',secure=True).status_code,200)
