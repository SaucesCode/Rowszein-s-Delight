from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.middleware.csrf import get_token, rotate_token
from django.utils.cache import patch_cache_control, patch_vary_headers
from .security import enforce_csrf
from .permissions import BusinessPermission, business_role

from .serializers import LoginSerializer, UserSerializer


def set_auth_cookies(response, access_token, refresh_token):
    jwt_settings = settings.SIMPLE_JWT

    response.set_cookie(
        key=jwt_settings['AUTH_COOKIE'],
        value=access_token,
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
        path="/", 
        max_age=int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds()),
    )
    response.set_cookie(
        key=jwt_settings['AUTH_COOKIE_REFRESH'],
        value=refresh_token,
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
        path="/", 
        max_age=int(jwt_settings['REFRESH_TOKEN_LIFETIME'].total_seconds()),
    )


class PrivateAuthResponseView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        patch_cache_control(response, no_store=True)
        patch_vary_headers(response, ['Cookie'])
        return response


class CSRFProtectedAuthView(PrivateAuthResponseView):
    # Login/logout cannot be blocked by an expired or malformed access cookie.
    authentication_classes = []
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        enforce_csrf(request)
        super().initial(request, *args, **kwargs)


class CSRFTokenView(PrivateAuthResponseView):
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

        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )

        if not user or business_role(user) is None:
            return Response({
                'success': False,
                'error': {'code': 'invalid_credentials', 'message': 'Invalid username or password.'},
            }, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        rotate_token(request._request)

        response = Response({
            'success': True,
            'data': UserSerializer(user).data,
            'message': 'Login successful.',
            'csrf_token': get_token(request._request),
        }, status=status.HTTP_200_OK)

        set_auth_cookies(response, access_token, refresh_token)

        return response


class LogoutView(CSRFProtectedAuthView):
    def post(self, request):
        jwt_settings = settings.SIMPLE_JWT
        rotate_token(request._request)

        response = Response({
            'success': True,
            'data': None,
            'message': 'Logout successful.',
            'csrf_token': get_token(request._request),
        }, status=status.HTTP_200_OK)

        for cookie_name in (jwt_settings["AUTH_COOKIE"], jwt_settings["AUTH_COOKIE_REFRESH"]):
            response.set_cookie(
                key=cookie_name,
                value="",
                max_age=0,
                expires="Thu, 01 Jan 1970 00:00:00 GMT",
                httponly=jwt_settings["AUTH_COOKIE_HTTP_ONLY"],
                secure=jwt_settings["AUTH_COOKIE_SECURE"],
                samesite=jwt_settings["AUTH_COOKIE_SAMESITE"],
                path="/",
            )

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
