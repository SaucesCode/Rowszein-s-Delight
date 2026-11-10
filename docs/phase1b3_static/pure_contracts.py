"""No database tests. These are NOT integrated security acceptance evidence."""
from datetime import datetime, timedelta, timezone
from importlib import import_module
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4
import jwt
from django.conf import settings
from django.db import connections
from django.db.migrations.loader import MigrationLoader
from django.db.models.deletion import PROTECT
from accounts import session_policy as p, session_tokens as codec, login_limiter
from accounts.models import DeviceSession, AuthThrottleBucket, User
from accounts.session_errors import AuthUnavailable, SessionEnded

NOW = datetime(2026,11,10,6,0,0,123456,tzinfo=timezone.utc)


class PolicyContracts(TestCase):
    def row(self,**kw):
        return SimpleNamespace(**(dict(pk=uuid4(),user_id=1,user_epoch=1,created_at=NOW,last_activity_at=NOW,
            absolute_expires_at=NOW+p.ABSOLUTE,revoked_at=None,refresh_generation=0,refresh_jti_hash=p.jti_digest('a'*43))|kw))

    def test_exact_microsecond_conversion(self):
        self.assertEqual(p.micros(NOW)-p.micros(NOW.replace(microsecond=0)),123456)
        with self.assertRaises(ValueError): p.micros(NOW.replace(tzinfo=None))

    def test_idle_boundary_is_exclusive(self):
        self.assertTrue(p.eligible(self.row(),1,NOW+p.IDLE-timedelta(microseconds=1)))
        self.assertFalse(p.eligible(self.row(),1,NOW+p.IDLE))

    def test_absolute_boundary_is_exclusive(self):
        row=self.row(last_activity_at=NOW+p.ABSOLUTE-timedelta(seconds=1))
        self.assertTrue(p.eligible(row,1,NOW+p.ABSOLUTE-timedelta(microseconds=1)))
        self.assertFalse(p.eligible(row,1,NOW+p.ABSOLUTE))

    def test_revoked_mismatch_future_and_rewritten_absolute_fail_closed(self):
        for row,epoch in [(self.row(revoked_at=NOW),1),(self.row(),2),
                (self.row(last_activity_at=NOW+timedelta(microseconds=1)),1),
                (self.row(absolute_expires_at=NOW+p.ABSOLUTE+timedelta(seconds=1)),1)]:
            self.assertFalse(p.eligible(row,epoch,NOW))

    def test_access_is_15_minutes_clipped_and_floored(self):
        self.assertEqual(p.access_expiry(NOW,NOW+p.ABSOLUTE),p.numeric_date(NOW)+900)
        self.assertEqual(p.access_expiry(NOW,NOW+timedelta(seconds=2)),p.numeric_date(NOW)+2)

    def test_exact_window_boundary_prunes(self):
        old=p.micros(NOW)-300000000
        self.assertEqual(p.prune_events([old,old+1,p.micros(NOW)],NOW,NOW,300),[old+1,p.micros(NOW)])

    def test_corrupt_or_clock_regressed_events_fail(self):
        for events in ({},[True],[-1],[p.micros(NOW)+1],[2,1],[1]*1001):
            with self.assertRaises(ValueError): p.prune_events(events,NOW,NOW,300)
        with self.assertRaises(ValueError): p.prune_events([],NOW,NOW-timedelta(microseconds=1),300)

    def test_retry_after_uses_ceil_and_configured_limit(self):
        values=[p.micros(NOW)-299000001]*5
        self.assertEqual(p.retry_seconds(values,5,NOW,300),1)
        self.assertEqual(p.retry_seconds(values,6,NOW,300),0)

    def test_account_normalization_is_throttle_only(self):
        self.assertEqual(p.normalized_account('  Ａlice  '),'alice')
        self.assertNotEqual(p.subject_digest('x'*32,'LA','alice'),p.subject_digest('x'*32,'LI','alice'))

    def test_direct_mode_ignores_spoofed_proxy_headers(self):
        self.assertEqual(p.client_ip({'REMOTE_ADDR':'::ffff:192.0.2.1','HTTP_X_FORWARDED_FOR':'10.0.0.1'},'direct',[]),'192.0.2.1')

    def test_proxy_chain_discards_only_trusted_rightmost_hops(self):
        self.assertEqual(p.client_ip({'REMOTE_ADDR':'10.0.0.1','HTTP_X_FORWARDED_FOR':'1.1.1.1, 192.0.2.1, 10.1.1.1'},'proxy',['10.0.0.0/8']),'192.0.2.1')

    def test_unknown_or_unverifiable_proxy_fails(self):
        for mode,peer,xff,trusted in [('unconfigured','127.0.0.1','',[]),('proxy','192.0.2.1','1.1.1.1',['10.0.0.0/8']),
                ('proxy','10.0.0.1','garbage',['10.0.0.0/8']),('proxy','10.0.0.1','10.0.0.2',['10.0.0.0/8'])]:
            with self.assertRaises(ValueError): p.client_ip({'REMOTE_ADDR':peer,'HTTP_X_FORWARDED_FOR':xff},mode,trusted)

    def test_key_ring_is_bounded_and_not_silently_disabled(self):
        for ring in ({},{'01':'x'*32},{'1':'short'},{'1':'x'*32,'2':'y'*32,'3':'z'*32}):
            with patch.object(settings,'AUTH_RATE_KEYS',ring),self.assertRaises(AuthUnavailable): login_limiter.keys('LA','alice')

    def test_configured_limits_respect_event_ceiling(self):
        for value in (0,1001,True,'5'):
            with patch.object(settings,'AUTH_RATE_LIMITS',{'LA':value}),self.assertRaises(AuthUnavailable): login_limiter.limit('LA')


class CodecContracts(TestCase):
    def setUp(self):
        self.row=PolicyContracts().row()
        self.jti='a'*43
        self.pair=codec.pair(self.row,NOW,self.jti)

    def test_v2_access_and_refresh_binding(self):
        for kind in ('access','refresh'):
            claims=codec.decode(self.pair[kind],kind,allow_expired=True)
            self.assertEqual((claims['sid'],claims['se'],claims['user_id']),(str(self.row.pk),1,1))
        self.assertEqual(self.pair['access_exp']-self.pair['issued_at'],900)

    def test_wrong_kind_and_wrong_signature_rejected(self):
        with self.assertRaises(SessionEnded): codec.decode(self.pair['refresh'],'access',allow_expired=True)
        with patch.object(settings,'AUTH_SESSION_SIGNING_KEY','different-key-'+'x'*32),self.assertRaises(SessionEnded):
            codec.decode(self.pair['access'],'access',allow_expired=True)

    def test_locator_only_identifies_and_never_decodes_as_jwt(self):
        self.assertEqual(codec.locator_sid(self.pair['locator']),str(self.row.pk))
        with self.assertRaises(SessionEnded): codec.decode(self.pair['locator'],'access',allow_expired=True)
        self.assertIsNone(codec.locator_sid('tampered'))

    def test_legacy_uid_token_fails(self):
        old=jwt.encode({'user_id':1,'token_type':'access','exp':p.numeric_date(NOW)+900},settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
        with self.assertRaises(SessionEnded): codec.decode(old,'access',allow_expired=True)

    def test_generation_and_digest_both_required(self):
        claims=codec.decode(self.pair['refresh'],'refresh',allow_expired=True)
        self.assertTrue(codec.current_refresh(self.row,claims))
        self.row.refresh_generation=1
        self.assertFalse(codec.current_refresh(self.row,claims))
        self.row.refresh_generation=0
        claims['jti']='b'*43
        self.assertFalse(codec.current_refresh(self.row,claims))

    def test_no_token_when_absolute_lifetime_under_one_second(self):
        with self.assertRaises(SessionEnded): codec.pair(self.row,self.row.absolute_expires_at-timedelta(microseconds=1),self.jti)

    def test_boolean_epoch_wrong_audience_and_long_access_rejected(self):
        claims=codec.decode(self.pair['access'],'access',allow_expired=True)
        for changes in ({'se':True},{'aud':'other'},{'aud':[claims['aud']]},{'exp':claims['iat']+901},{'sid':'not-uuid'},{'sv':True}):
            raw=jwt.encode(claims|changes,settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
            with self.assertRaises(SessionEnded): codec.decode(raw,'access',allow_expired=True)


class SchemaContracts(TestCase):
    def test_dummy_backend_only(self):
        self.assertEqual(connections['default'].settings_dict['ENGINE'],'django.db.backends.dummy')

    def test_exact_security_models_and_fk_protection(self):
        self.assertEqual([f.name for f in DeviceSession._meta.fields],['id','user','user_epoch','created_at','last_activity_at','absolute_expires_at','refresh_generation','refresh_jti_hash','revoked_at','revocation_reason'])
        self.assertIs(DeviceSession._meta.get_field('user').remote_field.on_delete,PROTECT)
        self.assertEqual([f.name for f in AuthThrottleBucket._meta.fields],['id','scope','key_version','subject_digest','event_times','updated_at'])
        self.assertFalse(User._meta.get_field('session_epoch').editable)

    def test_exact_constraints_indexes(self):
        self.assertEqual(len(DeviceSession._meta.constraints),7)
        self.assertEqual([i.name for i in DeviceSession._meta.indexes],['ds_user_created','ds_abs_expiry','ds_active_idle'])
        self.assertEqual(len(AuthThrottleBucket._meta.constraints),5)

    def test_migration_graph_is_additive_without_connection(self):
        loader=MigrationLoader(None)
        self.assertEqual(loader.graph.leaf_nodes('accounts'),[('accounts','0003_session_security_guards')])
        two=loader.disk_migrations[('accounts','0002_auththrottlebucket_devicesession_user_session_epoch_and_more')]
        self.assertEqual(len(two.operations),21)
        self.assertTrue(all(type(op).__name__ in {'CreateModel','AddField','AddConstraint','AddIndex'} for op in two.operations))
        self.assertEqual(two.operations[2].name,'session_epoch')

    def test_both_guard_sets_cover_epoch_device_and_throttle(self):
        mod=import_module('accounts.migrations.0003_session_security_guards')
        self.assertEqual(len(mod.PG_TRIGGERS),5)
        self.assertEqual(len(mod.SQLITE_TRIGGERS),7)
        for sql in mod.PG_FUNCTIONS.values():
            self.assertTrue(sql.strip().startswith('CREATE FUNCTION '))
            self.assertTrue(sql.strip().endswith('END; $$;'))
        self.assertIn('BEFORE UPDATE OF session_epoch',mod.PG_TRIGGERS[0])
        self.assertIn('rs_guarded_connection()',mod.SQLITE_TRIGGERS['accounts_security_epoch_guard'])

    def test_original_security_role_csrf_assertions_are_preserved(self):
        from security_compatibility import OriginalSecurity13,OriginalRoles13,CSRFRegression24
        import security_cases,csrf_regressions
        for current,original,count in [(OriginalSecurity13,security_cases.DesiredSecurityContracts,13),
                (OriginalRoles13,security_cases.ProposedRoleContracts,13),
                (CSRFRegression24,csrf_regressions.CSRFRegressionTests,24)]:
            names=[name for name in original.__dict__ if name.startswith('test_')]
            self.assertEqual(len(names),count)
            for name in names: self.assertIs(getattr(current,name),getattr(original,name))

    def test_endpoint_default_deny_inventory_covers_the_new_refresh_route(self):
        from django.urls import get_resolver,URLResolver
        from accounts.views import CSRFTokenView,LoginView,LogoutView,RefreshView
        from accounts.permissions import BusinessPermission
        views=[]
        def walk(patterns,prefix=''):
            for pattern in patterns:
                path=prefix+str(pattern.pattern)
                if isinstance(pattern,URLResolver): walk(pattern.url_patterns,path)
                elif path.startswith('api/'):
                    view=getattr(pattern.callback,'cls',None) or getattr(pattern.callback,'view_class',None)
                    views.append(view)
                    if view in {CSRFTokenView,LoginView,LogoutView,RefreshView}:
                        self.assertTrue(view.independent_auth_session)
                    else:
                        self.assertIn(BusinessPermission,view.permission_classes,path)
                        for method in ('get','post','put','patch','delete'):
                            if hasattr(view,method): self.assertIn(method.upper(),view.business_actions,(path,method))
        walk(get_resolver().url_patterns)
        self.assertEqual(len(views),26)
