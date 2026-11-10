from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from .security import enforce_csrf
from . import session_tokens
from .session_policy import numeric_date
from .session_errors import SessionEnded


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            return None

        validated_token = session_tokens.decode(raw_token,'access',allow_expired=True)
        enforce_csrf(request)
        from .device_sessions import claims_context
        user = claims_context(request,validated_token)
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
            token = session_tokens.decode(raw,'access',allow_expired=True)
        except SessionEnded:
            return None
        from .session_database import database_time
        if numeric_date(database_time()) >= token['exp']:
            return None
        from .device_sessions import claims_context
        return claims_context(request,token), token
