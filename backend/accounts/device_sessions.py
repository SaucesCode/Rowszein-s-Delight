import logging
import secrets
from contextvars import ContextVar
from dataclasses import dataclass
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import connection, transaction
from rest_framework.exceptions import PermissionDenied
from .models import User, DeviceSession
from .permissions import business_role, can
from .session_database import database_time, lock_users, set_transaction_bounds
from .session_errors import AuthUnavailable, SessionEnded, AccessExpired
from .session_policy import eligible, ABSOLUTE, MAX_INT, jti_digest, numeric_date
from . import session_tokens, login_limiter

logger = logging.getLogger('accounts.security')
current_session = ContextVar('verified_device_session', default=None)


@dataclass(frozen=True)
class VerifiedSession:
    user: User
    session: DeviceSession
    admitted_at: object
    access_exp: int


def claims_context(request, claims):
    if not connection.in_atomic_block or not getattr(request._request,'session_security_wrapped',False):
        raise AuthUnavailable()
    user = lock_users([claims['user_id']]).get(claims['user_id'])
    if user is None or not user.is_active:
        raise SessionEnded()
    view = request.parser_context.get('view')
    method = 'GET' if request.method == 'HEAD' else request.method
    action = getattr(view,'business_actions',{}).get(method)
    capability = 'catalog.read' if action == 'catalog.public' else action
    if not can(user,capability):
        raise PermissionDenied()
    row = DeviceSession.objects.select_for_update().filter(pk=claims['sid'],user=user).first()
    now = database_time()
    if row is None or claims['se'] != row.user_epoch or not eligible(row,user.session_epoch,now):
        raise SessionEnded()
    if (numeric_date(now) >= claims['exp'] or claims['iat'] > numeric_date(now)
            or claims['iat'] < numeric_date(row.created_at) or claims['exp'] > numeric_date(row.absolute_expires_at)):
        raise AccessExpired()
    context = VerifiedSession(user,row,now,claims['exp'])
    current_session.set(context)
    request._request.auth_session = context
    return user


def require_session(actor):
    context = current_session.get()
    if context is None or context.user.pk != actor.pk or not connection.in_atomic_block:
        raise SessionEnded()
    user = lock_users([actor.pk]).get(actor.pk)
    row = DeviceSession.objects.select_for_update().filter(pk=context.session.pk,user_id=actor.pk).first()
    now = database_time()
    if user is None or not business_role(user) or row is None or not eligible(row,user.session_epoch,now):
        raise SessionEnded()
    if numeric_date(now) >= context.access_exp:
        raise AccessExpired()
    return context


def finish_request(request, response):
    context = getattr(request,'auth_session',None)
    if context is None:
        return
    now = database_time()
    if now >= context.session.absolute_expires_at:
        raise SessionEnded()
    if ((200 <= response.status_code < 300 or response.status_code == 304)
            and request.path != '/api/auth/me/' and request.method not in {'OPTIONS','HEAD','TRACE'}):
        context.session.last_activity_at = context.admitted_at
        context.session.save(update_fields=['last_activity_at'])


def proven_families(request):
    ids = set()
    for cookie,kind in [(settings.SIMPLE_JWT['AUTH_COOKIE'],'access'),(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],'refresh')]:
        raw = request.COOKIES.get(cookie)
        if not raw:
            continue
        try:
            claims = session_tokens.decode(raw,kind,allow_expired=True)
            # Signature identifies cleanup targets; it never grants auth here.
            ids.add((claims['sid'],claims['user_id'],claims['se']))
        except SessionEnded:
            pass
    sid = session_tokens.locator_sid(request.COOKIES.get('device_session'))
    return ids,sid


def revoke_proven(request, reason='logout'):
    proofs, locator = proven_families(request)
    query_ids = {sid for sid,_,_ in proofs}
    if locator: query_ids.add(locator)
    targets = list(DeviceSession.objects.filter(pk__in=query_ids).values_list('pk','user_id','user_epoch'))
    ids = {uid for _,uid,_ in targets}
    native = getattr(request,'_request',request)
    admin_uid = native.session.get('_auth_user_id') if hasattr(native,'session') else None
    if admin_uid and str(admin_uid).isdecimal(): ids.add(int(admin_uid))
    lock_users(ids,exclusive=True)
    rows = list(DeviceSession.objects.select_for_update().filter(pk__in=[sid for sid,_,_ in targets]).order_by('pk'))
    found = False
    now = database_time()
    for row in rows:
        if str(row.pk) != locator and (str(row.pk),row.user_id,row.user_epoch) not in proofs:
            continue
        found = True
        if row.revoked_at is None:
            row.revoked_at,row.revocation_reason = now,reason
            row.save(update_fields=['revoked_at','revocation_reason'])
    transaction.on_commit(lambda: logger.info('Browser-session revocation committed',extra={'identified':found}))
    return found


def login(request, username, password, *, admin=False):
    with login_limiter.credential_gate(request,username) as outcome:
        candidate = User.objects.filter(username=username).first()
        # Resolve cookie proof users first so locks precede hashing/rehashing.
        proofs, locator = proven_families(request)
        ids = {uid for _,uid,_ in proofs}
        native = getattr(request,'_request',request)
        admin_uid = native.session.get('_auth_user_id') if hasattr(native,'session') else None
        if admin_uid and str(admin_uid).isdecimal(): ids.add(int(admin_uid))
        if locator:
            ids.update(DeviceSession.objects.filter(pk=locator).values_list('user_id',flat=True))
        if candidate: ids.add(candidate.pk)
        locked = lock_users(ids,exclusive=True)
        original = locked.get(candidate.pk) if candidate else None
        before = original.password if original else None
        user = authenticate(request=request,username=username,password=password)
        if user is not None and user.pk not in locked:
            # A concurrent username reassignment/creation changed resolution.
            # Never acquire a newly discovered User lock out of order.
            raise AuthUnavailable()
        if original:
            original.refresh_from_db(fields=['password','session_epoch'])
            if before != original.password:
                transaction.on_commit(lambda: logger.info('Automatic password-hash upgrade; earlier epochs invalidated',extra={'actor_id':original.pk}))
        if user is None or not business_role(user) or (admin and (user.role != 'admin' or not user.is_staff)):
            outcome['failed'] = True
            transaction.on_commit(lambda: logger.info('Credential verification failed'))
            return None
        user.refresh_from_db()
        # The trigger-updated epoch is read AFTER authenticate/check_password.
        if not business_role(user):
            outcome['failed'] = True
            return None
        revoke_proven(request)
        if admin:
            return user
        now = database_time()
        jti = secrets.token_urlsafe(32)
        row = DeviceSession.objects.create(user=user,user_epoch=user.session_epoch,created_at=now,last_activity_at=now,
            absolute_expires_at=now+ABSOLUTE,refresh_jti_hash=jti_digest(jti))
        tokens = session_tokens.pair(row,now,jti)
        transaction.on_commit(lambda: logger.info('Device login committed',extra={'actor_id':user.pk}))
        return user,tokens


def refresh(request):
    login_limiter.debit(request,'RR')
    raw = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
    claims = session_tokens.decode(raw,'refresh',allow_expired=True)
    ended = False
    with transaction.atomic():
        set_transaction_bounds()
        user = lock_users([claims['user_id']]).get(claims['user_id'])
        row = DeviceSession.objects.select_for_update().filter(pk=claims['sid'],user_id=claims['user_id']).first()
        now = database_time()
        if (user is None or not business_role(user) or row is None or claims['se'] != row.user_epoch
                or not eligible(row,user.session_epoch,now) or numeric_date(now) >= claims['exp']
                or claims['iat'] > numeric_date(now) or claims['iat'] < numeric_date(row.created_at)
                or claims['exp'] != numeric_date(row.absolute_expires_at)):
            raise SessionEnded()
        # A locator never authorizes refresh. Conflicting cookie families stop.
        locator = session_tokens.locator_sid(request.COOKIES.get('device_session'))
        if locator and locator != str(row.pk):
            raise SessionEnded()
        if not session_tokens.current_refresh(row,claims) or row.refresh_generation >= MAX_INT:
            row.revoked_at,row.revocation_reason = now,'refresh_reuse'
            row.save(update_fields=['revoked_at','revocation_reason'])
            ended = True
        else:
            jti = secrets.token_urlsafe(32)
            row.refresh_generation += 1
            row.refresh_jti_hash = jti_digest(jti)
            row.save(update_fields=['refresh_generation','refresh_jti_hash'])
            tokens = session_tokens.pair(row,now,jti)
    # Raise AFTER commit: denial must not roll back family revocation.
    if ended:
        logger.warning('Refresh reuse revoked a family')
        raise SessionEnded()
    return user,tokens
