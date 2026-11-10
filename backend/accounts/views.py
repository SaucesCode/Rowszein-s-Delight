from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.middleware.csrf import get_token, rotate_token
from django.utils.cache import patch_cache_control, patch_vary_headers
from .security import enforce_csrf
from .permissions import BusinessPermission

from .serializers import LoginSerializer, UserSerializer
from django.db import DatabaseError, transaction
from rest_framework.exceptions import ValidationError
from .session_database import set_transaction_bounds
from .session_errors import AuthUnavailable
from . import device_sessions


def set_auth_cookies(response, tokens):
    jwt_settings = settings.SIMPLE_JWT

    response.set_cookie(
        key=jwt_settings['AUTH_COOKIE'],
        value=tokens['access'],
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
        path="/", 
        max_age=max(0,tokens['access_exp']-tokens['issued_at']),
    )
    response.set_cookie(
        key=jwt_settings['AUTH_COOKIE_REFRESH'],
        value=tokens['refresh'],
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
        path="/", 
        max_age=max(0,tokens['refresh_exp']-tokens['issued_at']),
    )
    response.set_cookie('device_session',tokens['locator'],httponly=True,secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],path='/',max_age=max(0,tokens['refresh_exp']-tokens['issued_at']))


class PrivateAuthResponseView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, DatabaseError):
            exc = AuthUnavailable()
        return super().handle_exception(exc)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        patch_cache_control(response, no_store=True)
        patch_vary_headers(response, ['Cookie'])
        return response


class CSRFProtectedAuthView(PrivateAuthResponseView):
    independent_auth_session = True
    # Login/logout cannot be blocked by an expired or malformed access cookie.
    authentication_classes = []
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        if request.path == '/api/auth/login/':
            native = request._request
            try:
                if int(native.META.get('CONTENT_LENGTH') or 0) > 16384 or len(native.body) > 16384:
                    raise ValidationError('Sign-in request is too large.')
            except (ValueError, TypeError):
                raise ValidationError('Invalid sign-in request.') from None
        enforce_csrf(request)
        if request.path == '/api/auth/login/' and request.method == 'POST':
            from .login_limiter import debit
            debit(request, 'LR')
        super().initial(request, *args, **kwargs)


class CSRFTokenView(PrivateAuthResponseView):
    independent_auth_session = True
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'success': True, 'data': {'csrf_token': get_token(request._request)}, 'message': ''})


class LoginView(CSRFProtectedAuthView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        result = device_sessions.login(request,**serializer.validated_data)

        if result is None:
            return Response({
                'success': False,
                'error': {'code': 'invalid_credentials', 'message': 'Invalid username or password.'},
            }, status=status.HTTP_401_UNAUTHORIZED)

        user,tokens = result
        rotate_token(request._request)

        response = Response({
            'success': True,
            'data': UserSerializer(user).data,
            'message': 'Login successful.',
            'csrf_token': get_token(request._request),
        }, status=status.HTTP_200_OK)

        set_auth_cookies(response, tokens)

        return response


class LogoutView(CSRFProtectedAuthView):
    def post(self, request):
        with transaction.atomic():
            set_transaction_bounds()
            identified = device_sessions.revoke_proven(request)
            if request._request.session.session_key:
                request._request.session.flush()
        rotate_token(request._request)

        response = Response({
            'success': True,
            'data': {'server_session_identified':identified},
            'message': 'Logout successful.',
            'csrf_token': get_token(request._request),
        }, status=status.HTTP_200_OK)

        from .admin_sessions import clear_auth_cookies
        return clear_auth_cookies(response)


class RefreshView(CSRFProtectedAuthView):
    def post(self, request):
        user,tokens = device_sessions.refresh(request)
        response = Response({'success':True,'data':UserSerializer(user).data,'message':'Session renewed.'})
        set_auth_cookies(response,tokens)
        return response


class MeView(PrivateAuthResponseView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'self.read', 'OPTIONS': 'self.read'}

    def get(self, request):
        return Response({
            'success': True,
            'data': UserSerializer(request.user).data,
            'message': '',
        }, status=status.HTTP_200_OK)
