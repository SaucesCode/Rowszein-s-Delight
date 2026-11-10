"""Version old assertions with explicitly documented V2 fixture changes."""
import difflib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'docs/phase1b2/rbac_regressions.py').read_text()
changed=source.replace('from django.test import TestCase, RequestFactory','from django.test import TransactionTestCase, RequestFactory, override_settings')
changed=changed.replace('from security_cases import CookieFixture','from security_compatibility import V2CookieFixture as CookieFixture\nfrom session_api_contracts import TEST_AUTH\nfrom django.db.models.deletion import ProtectedError\nfrom accounts.models import DeviceSession')
changed=changed.replace('class RBACRegressions(CookieFixture, TestCase):','@override_settings(**TEST_AUTH)\nclass RBACRegressions(CookieFixture, TransactionTestCase):')
changed=changed.replace('        unused.delete()',"        self.assertEqual(client.get('/api/sales/', secure=True).status_code, 200)\n        with self.assertRaises(ProtectedError): unused.delete()\n        DeviceSession.objects.filter(user=unused).delete()  # Isolated fixture cleanup only.\n        unused.delete()")
changed=changed.replace('        response = Unmapped.as_view()(native)',"        from accounts.session_middleware import SessionTransactionMiddleware\n        response = SessionTransactionMiddleware(lambda request: None).process_view(native, Unmapped.as_view(), (), {})")
changed=changed.replace('from accounts.views import CSRFTokenView, LoginView, LogoutView','from accounts.views import CSRFTokenView, LoginView, LogoutView, RefreshView')
changed=changed.replace('[CSRFTokenView, LoginView, LogoutView]', '[CSRFTokenView, LoginView, LogoutView, RefreshView]')
changed=changed.replace('self.assertEqual(len(views), 25)','self.assertEqual(len(views), 26)')
needle="        response = self.owner_client.post('/api/sales/', self.sale_payload(), format='json', secure=True, HTTP_IDEMPOTENCY_KEY=key)"
changed=changed.replace(needle,"        self.assertEqual(self.owner_client.get('/api/auth/me/', secure=True).status_code, 401)\n        self.owner.refresh_from_db()\n        self.owner_client = self.cookie_client(self.owner)  # Fresh role-bound session, same actor/UUID.\n"+needle)
changed+='''\n# The four prior independent-connection RBAC cases retain their exact methods.\nfrom security_compatibility import version\nimport rbac_concurrency as _concurrency\nfrom unittest import skipUnless\nfrom django.db import connection\nRBACConcurrencyTests=skipUnless(connection.vendor=='postgresql','Independent PostgreSQL locks required')(version(_concurrency.RBACConcurrencyTests,'RBACConcurrencyTests'))\nRBACConcurrencyTests.__module__=__name__\n'''
folder=Path(__file__).parent
(folder/'rbac_compatibility.py').write_text(changed,encoding='utf-8')
(folder/'rbac-fixture-changes.diff').write_text(''.join(difflib.unified_diff(source.splitlines(True),changed.splitlines(True),fromfile='preserved phase1b2/rbac_regressions.py',tofile='versioned phase1b3/rbac_compatibility.py')),encoding='utf-8')
print('Preserved historical tests; wrote explicit fixture-only version/diff.')
