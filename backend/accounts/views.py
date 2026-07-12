from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

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


class LoginView(APIView):
    permission_classes = [AllowAny]

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

        if not user:
            return Response({
                'success': False,
                'error': 'Invalid username or password.',
            }, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'data': UserSerializer(user).data,
            'message': 'Login successful.',
        }, status=status.HTTP_200_OK)

        set_auth_cookies(response, access_token, refresh_token)

        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        jwt_settings = settings.SIMPLE_JWT

        response = Response({
            'success': True,
            'data': None,
            'message': 'Logout successful.',
        }, status=status.HTTP_200_OK)

        for cookie_name in (jwt_settings["AUTH_COOKIE"], jwt_settings["AUTH_COOKIE_REFRESH"]):
            response.delete_cookie(
                cookie_name,
                path="/",
                samesite=jwt_settings["AUTH_COOKIE_SAMESITE"],
                secure=jwt_settings["AUTH_COOKIE_SECURE"],
            )

        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'success': True,
            'data': UserSerializer(request.user).data,
            'message': '',
        }, status=status.HTTP_200_OK)