"""NOT RUN. Independent PostgreSQL connections and observed lock waits."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from time import monotonic, sleep
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4
from django.db import connection, connections, transaction
from django.test import TransactionTestCase, override_settings
from accounts.models import User, DeviceSession
from sales.models import Sale, InventoryOperation
from session_api_contracts import SessionAPIContracts, TEST_AUTH, cookie_client, bind_fixture


@skipUnless(connection.vendor=='postgresql','Requires independent PostgreSQL row locks; SQLite proves no concurrency.')
@override_settings(**TEST_AUTH)
class SessionConcurrencyContracts(TransactionTestCase):
    password=SessionAPIContracts.password
    setUp=SessionAPIContracts.setUp
    state=SessionAPIContracts.state
    sale=SessionAPIContracts.sale
    login=SessionAPIContracts.login
    me=SessionAPIContracts.me

    def stock(self,client):
        self.ingredient.refresh_from_db()
        return client.post(f'/api/ingredients/{self.ingredient.pk}/adjustments/',{'delta':'1.000000000','reason':'Session race'},
            format='json',secure=True,HTTP_IDEMPOTENCY_KEY=str(uuid4()),HTTP_IF_MATCH=f'"{self.ingredient.stock_revision}"')

    def worker(self,action,pids=None):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_backend_pid()')
                pid=cursor.fetchone()[0]
                if pids is not None: pids.append(pid)
            return action()
        finally:
            connections.close_all()

    def wait_for_lock(self,pids):
        until=monotonic()+1.5
        while monotonic()<until:
            if pids:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT wait_event_type FROM pg_stat_activity WHERE pid=%s',[pids[0]])
                    row=cursor.fetchone()
                if row and row[0]=='Lock': return
            sleep(.01)
        self.fail('Required independent row-lock wait was not observed.')

    def test_concurrent_bad_logins_never_overshoot_five(self):
        gate=Barrier(7,timeout=6)
        def attempt():
            client=cookie_client();gate.wait()
            return self.login(client,password='wrong').status_code
        with ThreadPoolExecutor(max_workers=7) as pool:
            results=[future.result(timeout=15) for future in [pool.submit(self.worker,attempt) for _ in range(7)]]
        self.assertEqual(sorted(results),[401]*5+[429]*2)
        self.assertEqual(DeviceSession.objects.count(),1)

    def test_simultaneous_refresh_has_one_rotation_then_terminal_reuse(self):
        gate=Barrier(2,timeout=6)
        def attempt():
            client=cookie_client(self.tokens);gate.wait()
            return client.post('/api/auth/refresh/',secure=True)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=[future.result(timeout=12) for future in [pool.submit(self.worker,attempt) for _ in range(2)]]
        self.assertEqual(sorted(response.status_code for response in results),[200,401])
        self.row.refresh_from_db()
        self.assertEqual(self.row.refresh_generation,1)
        self.assertEqual(self.row.revocation_reason,'refresh_reuse')
        success=next(response for response in results if response.status_code==200)
        copied=cookie_client(self.tokens)
        copied.cookies['access_token']=success.cookies['access_token'].value
        self.assertEqual(self.me(copied).status_code,401)

    def test_same_actor_request_uuid_across_devices_still_deducts_once(self):
        _,other=bind_fixture(self.owner)
        gate=Barrier(2,timeout=6);key=str(uuid4())
        def attempt(tokens):
            client=cookie_client(tokens);gate.wait();return self.sale(client,key)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(self.worker,lambda tokens=tokens:attempt(tokens)) for tokens in (self.tokens,other)]
            responses=[future.result(timeout=12) for future in futures]
        self.assertEqual([response.status_code for response in responses],[201,201])
        self.assertEqual(responses[0].data,responses[1].data)
        self.assertEqual(Sale.objects.count(),1)
        self.assertEqual(InventoryOperation.objects.filter(action='sale_create').count(),1)
        from sales.test_verification_extended import assert_reconciled
        assert_reconciled(self)

    def test_role_change_commit_wins_against_waiting_sale(self):
        before=self.state();pids=[]
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.owner.pk)
                future=pool.submit(self.worker,lambda:self.sale(cookie_client(self.tokens)),pids)
                self.wait_for_lock(pids)
                User.objects.filter(pk=self.owner.pk).update(role='staff')
            response=future.result(timeout=10)
        self.assertEqual(response.status_code,401)
        self.assertEqual(self.state(),before)

    def test_expiry_is_sampled_after_observed_lock_wait(self):
        before=self.state();pids=[]
        with patch('accounts.device_sessions.database_time',return_value=self.row.last_activity_at+timedelta(minutes=30)):
            with ThreadPoolExecutor(max_workers=1) as pool:
                with transaction.atomic():
                    User.objects.select_for_update().get(pk=self.owner.pk)
                    future=pool.submit(self.worker,lambda:self.sale(cookie_client(self.tokens)),pids)
                    self.wait_for_lock(pids)
                response=future.result(timeout=10)
        self.assertEqual(response.status_code,401)
        self.assertEqual(self.state(),before)

    def test_admitted_sale_completes_before_logout_and_cannot_replay_after(self):
        pids=[]
        # Hold the business ingredient lock so the admitted sale retains its
        # User/share and DeviceSession/update locks while logout queues.
        from ingredients.models import Ingredient
        with ThreadPoolExecutor(max_workers=2) as pool:
            with transaction.atomic():
                Ingredient.objects.select_for_update().get(pk=self.ingredient.pk)
                sale_pid=[]
                sale_future=pool.submit(self.worker,lambda:self.sale(cookie_client(self.tokens)),sale_pid)
                self.wait_for_lock(sale_pid)
                logout_future=pool.submit(self.worker,lambda:cookie_client(self.tokens).post('/api/auth/logout/',secure=True),pids)
                self.wait_for_lock(pids)
            self.assertEqual(sale_future.result(timeout=10).status_code,201)
            self.assertEqual(logout_future.result(timeout=10).status_code,200)
        before=self.state()
        self.assertEqual(self.sale(cookie_client(self.tokens)).status_code,401)
        self.assertEqual(self.state(),before)

    def test_role_change_wins_against_waiting_stock(self):
        before=self.state();pids=[]
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.owner.pk)
                future=pool.submit(self.worker,lambda:self.stock(cookie_client(self.tokens)),pids)
                self.wait_for_lock(pids)
                User.objects.filter(pk=self.owner.pk).update(role='staff')
            response=future.result(timeout=10)
        self.assertEqual(response.status_code,403)
        self.assertEqual(self.state(),before)

    def test_admitted_stock_finishes_before_logout(self):
        from ingredients.models import Ingredient
        with ThreadPoolExecutor(max_workers=2) as pool:
            with transaction.atomic():
                Ingredient.objects.select_for_update().get(pk=self.ingredient.pk)
                stock_pid=[]
                stock_future=pool.submit(self.worker,lambda:self.stock(cookie_client(self.tokens)),stock_pid)
                self.wait_for_lock(stock_pid)
                logout_pid=[]
                logout_future=pool.submit(self.worker,lambda:cookie_client(self.tokens).post('/api/auth/logout/',secure=True),logout_pid)
                self.wait_for_lock(logout_pid)
            self.assertEqual(stock_future.result(timeout=10).status_code,200)
            self.assertEqual(logout_future.result(timeout=10).status_code,200)
        before=self.state()
        self.assertEqual(self.stock(cookie_client(self.tokens)).status_code,401)
        self.assertEqual(self.state(),before)
