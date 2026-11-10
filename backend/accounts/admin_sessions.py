"""Guard the existing django_session backend; no additional persistence model."""
import time
from django.conf import settings
from django.contrib.auth import logout
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.views import PasswordChangeView
from django.contrib.sessions.models import Session
from django.db import DatabaseError, transaction
from django.http import HttpResponseRedirect, JsonResponse, HttpResponseBadRequest
from django.middleware.csrf import rotate_token
from django.urls import reverse
from django.utils.deprecation import MiddlewareMixin
from rest_framework.exceptions import APIException
from . import login_limiter
from .permissions import business_role
from .session_database import database_time, lock_users, set_transaction_bounds
from .session_errors import AuthUnavailable, SessionEnded
from .session_policy import micros, IDLE, ABSOLUTE

KEYS = ('_business_auth_epoch','_business_started_at','_business_last_activity_at','_business_absolute_at')


def security_error(error):
    response = JsonResponse({'success':False,'error':{'code':getattr(error,'default_code','auth_unavailable'),
        'message':str(getattr(error,'detail',AuthUnavailable.default_detail))}},status=getattr(error,'status_code',503))
    if getattr(error,'wait',None): response['Retry-After'] = str(error.wait)
    response['Cache-Control'] = 'no-store'
    return response


def clear_auth_cookies(response):
    for name in (settings.SIMPLE_JWT['AUTH_COOKIE'],settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],'device_session'):
        response.set_cookie(name,'',max_age=0,expires='Thu, 01 Jan 1970 00:00:00 GMT',path='/',httponly=True,
            secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'])
    response.delete_cookie(settings.SESSION_COOKIE_NAME,path=settings.SESSION_COOKIE_PATH,
        domain=settings.SESSION_COOKIE_DOMAIN,samesite=settings.SESSION_COOKIE_SAMESITE)
    response['Cache-Control'] = 'no-store'
    return response


def admin_cookie(response,request):
    """Emit the saved session's bounded expiry without an unlocked second save."""
    response.set_cookie(settings.SESSION_COOKIE_NAME,request.session.session_key,max_age=request.session.get_expiry_age(),
        path=settings.SESSION_COOKIE_PATH,domain=settings.SESSION_COOKIE_DOMAIN,secure=settings.SESSION_COOKIE_SECURE,
        httponly=settings.SESSION_COOKIE_HTTPONLY,samesite=settings.SESSION_COOKIE_SAMESITE)
    request.session.modified=False
    return response


def bind_login(request, expected_epoch):
    # Recheck after Django LoginView's login signal; never bind a stale epoch.
    with transaction.atomic():
        set_transaction_bounds()
        user = lock_users([request.user.pk],exclusive=True).get(request.user.pk)
        if not user or not owner_admin(user) or user.session_epoch != expected_epoch:
            raise SessionEnded()
        now = database_time()
        for key,value in zip(KEYS,(user.session_epoch,micros(now),micros(now),micros(now+ABSOLUTE))):
            request.session[key] = value
        request.session.set_expiry(int(IDLE.total_seconds()))
        request.session.save()


def owner_admin(user):
    return business_role(user) == 'admin' and user.is_staff


def guarded_user(request, *, exclusive=False):
    uid = getattr(request.user,'pk',None)
    user = lock_users([uid],exclusive=exclusive).get(uid) if uid else None
    row = Session.objects.select_for_update().filter(session_key=request.session.session_key).first()
    now = database_time()  # Sample AFTER both locks, never before waiting.
    if not user or not owner_admin(user) or row is None or row.expire_date <= now:
        raise SessionEnded()
    data = row.get_decoded()
    epoch,start,activity,absolute = (data.get(key) for key in KEYS)
    current = micros(now)
    if (any(type(value) is not int for value in (epoch,start,activity,absolute))
            or epoch != user.session_epoch or data.get('_auth_user_id') != str(user.pk)
            or absolute-start != int(ABSOLUTE.total_seconds()*1000000)
            or not start <= activity <= current < absolute or current-activity >= int(IDLE.total_seconds()*1000000)
            or data.get('_auth_user_hash') != user.get_session_auth_hash()):
        raise SessionEnded()
    # Prevent a stale request cache from resurrecting a concurrent session update.
    request.session._session_cache = data
    request.user = user
    return now


class GuardedPasswordChangeForm(PasswordChangeForm):
    def __init__(self,*args,request,**kwargs):
        self.request = request
        super().__init__(*args,**kwargs)

    def clean_old_password(self):
        from django.core.exceptions import ValidationError
        try:
            return super().clean_old_password()
        except ValidationError:
            self.request.auth_old_password_failed = True
            raise


class GuardedPasswordChangeView(PasswordChangeView):
    form_class = GuardedPasswordChangeForm

    def get_form_kwargs(self):
        return dict(super().get_form_kwargs(),request=self.request)

    def form_valid(self, form):
        form.save()  # The trigger invalidates all API/admin epochs, including this one.
        logout(self.request)  # Deliberately do not call update_session_auth_hash().
        rotate_token(self.request)
        return clear_auth_cookies(HttpResponseRedirect(reverse('admin:login')))


class AdminSessionMiddleware(MiddlewareMixin):
    def process_request(self,request):
        # Cache the bounded body before CsrfViewMiddleware can consume a
        # multipart stream. No credential check/counter write occurs here.
        if request.method=='POST' and request.path in {'/admin/login/','/admin/password_change/'}:
            try:
                if int(request.META.get('CONTENT_LENGTH') or 0)>16384 or len(request.body)>16384:
                    return HttpResponseBadRequest('Credential request is too large.')
            except (ValueError,TypeError):
                return HttpResponseBadRequest('Invalid credential request.')
        return None

    def process_view(self,request,callback,args,kwargs):
        match = request.resolver_match
        if not match or match.app_name != 'admin' or match.url_name in {'login','logout'}:
            return None
        credential = match.url_name == 'password_change' and request.method == 'POST'
        started = time.monotonic()
        try:
            if not request.user.is_authenticated:
                return None  # Existing admin_view performs its normal login redirect.
            if credential:
                # Quota -> exclusive User -> django_session. Never upgrade a shared lock.
                login_limiter.debit(request,'LR')
                with login_limiter.credential_gate(request,request.user.username) as outcome:
                    response = self.invoke(request,callback,args,kwargs,exclusive=True,started=started)
                    outcome['failed'] = getattr(request,'auth_old_password_failed',False)
                return response
            return self.invoke(request,callback,args,kwargs,exclusive=True,started=started)
        except SessionEnded:
            # Do not modify an expired/stale session behind another request's back.
            response=HttpResponseRedirect(reverse('admin:login'))
            response['Cache-Control']='no-store'
            return response
        except DatabaseError:
            return security_error(AuthUnavailable())
        except APIException as error:
            return security_error(error)

    @staticmethod
    def invoke(request,callback,args,kwargs,*,exclusive,started):
        with transaction.atomic():
            set_transaction_bounds()
            admitted = guarded_user(request,exclusive=exclusive)
            response = callback(request,*args,**kwargs)
            if getattr(response,'streaming',False): raise AuthUnavailable()
            if hasattr(response,'render'): response.render()
            if response.status_code >= 400:
                transaction.set_rollback(True)
            elif request.session.session_key and (200 <= response.status_code < 300 or response.status_code == 302):
                now = database_time()
                if micros(now) >= request.session[KEYS[3]]: raise SessionEnded()
                if request.method not in {'HEAD','OPTIONS','TRACE'} and request.resolver_match.url_name != 'jsi18n':
                    request.session[KEYS[2]] = micros(admitted)
                deadline=min(request.session[KEYS[3]],request.session[KEYS[2]]+int(IDLE.total_seconds()*1000000))
                request.session.set_expiry(max(1,(deadline-micros(now))//1000000))
                # Save while holding locks, not in SessionMiddleware after commit.
                request.session.save()
                admin_cookie(response,request)
            if time.monotonic()-started > 10: raise AuthUnavailable()
            return response
