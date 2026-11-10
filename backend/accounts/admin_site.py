from django.contrib.admin import AdminSite
from django.contrib.admin.forms import AdminAuthenticationForm
from .permissions import business_role
from django.db import DatabaseError, transaction
from django.contrib.auth import logout
from django.http import HttpResponseRedirect, HttpResponseNotAllowed, HttpResponseBadRequest
from django.urls import reverse
from django.middleware.csrf import rotate_token
from rest_framework.exceptions import APIException
from . import device_sessions, login_limiter
from .session_database import set_transaction_bounds
from .session_errors import AuthUnavailable
from .security import enforce_csrf
from .admin_sessions import bind_login, admin_cookie, clear_auth_cookies, security_error, GuardedPasswordChangeView


class BusinessAdminAuthenticationForm(AdminAuthenticationForm):
    def clean(self):
        username,password = self.cleaned_data.get('username'),self.cleaned_data.get('password')
        if username and password:
            self.user_cache = device_sessions.login(self.request,username,password,admin=True)
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            self.confirm_login_allowed(self.user_cache)
            self.request.verified_admin_epoch = self.user_cache.session_epoch
        return self.cleaned_data

    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if business_role(user) != 'admin':
            raise self.get_invalid_login_error()


class BusinessAdminSite(AdminSite):
    login_form = BusinessAdminAuthenticationForm

    def has_permission(self, request):
        return super().has_permission(request) and business_role(request.user) == 'admin'

    def login(self,request,extra_context=None):
        try:
            if request.method == 'POST':
                if int(request.META.get('CONTENT_LENGTH') or 0)>16384 or len(request.body)>16384:
                    return HttpResponseBadRequest('Sign-in request is too large.')
                enforce_csrf(request)
                login_limiter.debit(request,'LR')
            elif request.user.is_authenticated:
                # Never let legacy/expired sessions bypass the actual login form.
                from django.contrib.auth.models import AnonymousUser
                request.user = AnonymousUser()
            response = super().login(request,extra_context)
            if hasattr(response,'render'): response.render()
            if request.method == 'POST' and hasattr(request,'verified_admin_epoch'):
                bind_login(request,request.verified_admin_epoch)
                admin_cookie(response,request)
            return response
        except DatabaseError:
            return security_error(AuthUnavailable())
        except (ValueError,TypeError):
            return HttpResponseBadRequest('Invalid sign-in request.')
        except APIException as error:
            return security_error(error)

    def logout(self,request,extra_context=None):
        if request.method != 'POST': return HttpResponseNotAllowed(['POST'])
        try:
            enforce_csrf(request)
            with transaction.atomic():
                set_transaction_bounds()
                device_sessions.revoke_proven(request)
                logout(request)
            rotate_token(request)
            return clear_auth_cookies(HttpResponseRedirect(reverse('admin:login')))
        except DatabaseError:
            return security_error(AuthUnavailable())
        except APIException as error:
            return security_error(error)

    def password_change(self,request,extra_context=None):
        request.current_app = self.name
        return GuardedPasswordChangeView.as_view(extra_context={**self.each_context(request),**(extra_context or {})})(request)
