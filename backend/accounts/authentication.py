from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from .security import enforce_csrf
from rest_framework_simplejwt.exceptions import InvalidToken


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        enforce_csrf(request)
        return user, validated_token


class PublicCatalogAuthentication(CookieJWTAuthentication):
    """Only public safe reads tolerate expired/malformed tokens.

    Valid cookies still identify users; unknown/inactive roles do not fall back
    to anonymous. Writes retain the standard authentication and CSRF rules.
    """
    def authenticate(self, request):
        if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            return super().authenticate(request)
        raw = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
        if raw is None:
            return None
        try:
            token = self.get_validated_token(raw)
        except InvalidToken:
            return None
        return self.get_user(token), token
