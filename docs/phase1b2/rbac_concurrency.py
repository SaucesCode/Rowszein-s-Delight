"""Independent PostgreSQL sessions, real cookie authentication and CSRF."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
import time
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from security_cases import CookieFixture
from accounts.models import User
from sales.models import InventoryOperation, Sale, StockMovement, SaleConsumption, SaleFinancialEntry
from sales.test_verification_extended import assert_reconciled


@skipUnless(connection.vendor == 'postgresql', 'Requires independent PostgreSQL row locks')
class RBACConcurrencyTests(CookieFixture, TransactionTestCase):
    def state(self):
        from ingredients.models import Ingredient
        return [list(model.objects.order_by('pk').values()) for model in [Sale, Ingredient, InventoryOperation, StockMovement, SaleConsumption, SaleFinancialEntry]]

    def worker(self, callback, pid=None):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout='7s'")
                cursor.execute("SET statement_timeout='10s'")
                cursor.execute('SELECT pg_backend_pid()')
                if pid is not None: pid.append(cursor.fetchone()[0])
            return callback()
        finally:
            connections.close_all()

    def wait_lock(self, pid):
        until = time.monotonic() + 5
        while time.monotonic() < until:
            if pid:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT wait_event_type FROM pg_stat_activity WHERE pid=%s', [pid[0]])
                    row = cursor.fetchone()
                if row and row[0] == 'Lock': return
            time.sleep(.025)
        self.fail('Independent PostgreSQL lock wait was not observed')

    def parallel_sales(self, actors, key=None):
        gate = Barrier(2, timeout=6)
        def create(actor):
            client = self.cookie_client(actor)
            gate.wait()
            return client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(key or uuid4()))
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.worker, lambda actor=actor: create(actor)) for actor in actors]
            return [future.result(timeout=15) for future in futures]

    def test_two_staff_compete_for_last_stock_with_real_cookies(self):
        response = self.owner_client.post(f'/api/ingredients/{self.ingredient.pk}/adjustments/',
            {'delta':'-98.000000000','reason':'Isolated last-stock fixture'}, format='json', secure=True,
            HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"')
        self.assertEqual(response.status_code, 200)
        other = User.objects.create_user(username='competing-staff', role='staff')
        responses = self.parallel_sales([self.staff, other])
        self.assertEqual(sorted(response.status_code for response in responses), [201,400])
        self.assertEqual(Sale.objects.count(), 2)
        assert_reconciled(self)

    def test_duplicate_staff_identity_parallel_commits_one_sale(self):
        responses = self.parallel_sales([self.staff,self.staff], uuid4())
        self.assertEqual([response.status_code for response in responses], [201,201])
        self.assertEqual(responses[0].data, responses[1].data)
        self.assertEqual(sorted(response['Idempotency-Replayed'] for response in responses), ['false','true'])
        self.assertEqual(Sale.objects.count(), 2)
        self.assertEqual(InventoryOperation.objects.filter(actor=self.staff).count(), 1)
        assert_reconciled(self)

    def test_pending_role_downgrade_commits_before_command_recheck_then_denies(self):
        ready, release, pid = Event(), Event(), []
        before = self.state()
        def downgrade():
            with transaction.atomic():
                User.objects.filter(pk=self.owner.pk).update(role='staff')
                ready.set()
                if not release.wait(6): raise RuntimeError('Role update release timeout')
        def cancel():
            return self.cookie_client(self.owner, token=self.owner_cookie).delete(f'/api/sales/{self.sale_id}/',
                {'reason':'Must not cancel after downgrade'}, format='json', secure=True,
                HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH='"1"')
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.worker, downgrade)
            self.assertTrue(ready.wait(5))
            second = pool.submit(self.worker, cancel, pid)
            try: self.wait_lock(pid)
            finally: release.set()
            first.result(timeout=12)
            response = second.result(timeout=12)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error']['code'], 'forbidden')
        self.assertEqual(self.state(), before)

    def test_shared_actor_lock_allows_command_commit_before_role_change(self):
        ready, release, pid = Event(), Event(), []
        original = InventoryOperation.objects.create
        def pause(**kwargs):
            ready.set()
            if not release.wait(6): raise RuntimeError('Command release timeout')
            return original(**kwargs)
        def create():
            return self.cookie_client(self.staff).post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        def downgrade():
            User.objects.filter(pk=self.staff.pk).update(role='unknown')
        with patch('sales.services.InventoryOperation.objects.create', side_effect=pause), ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.worker, create)
            self.assertTrue(ready.wait(5))
            second = pool.submit(self.worker, downgrade, pid)
            try: self.wait_lock(pid)
            finally: release.set()
            response = first.result(timeout=12)
            second.result(timeout=12)
        self.assertEqual(response.status_code, 201)
        before = self.state()
        self.assertEqual(self.staff_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4())).status_code, 403)
        self.assertEqual(self.state(), before)
        assert_reconciled(self)
