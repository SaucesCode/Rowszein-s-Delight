from rest_framework.exceptions import APIException


class AuthUnavailable(APIException):
    status_code = 503
    default_code = 'auth_unavailable'
    default_detail = 'Authentication service unavailable. Retry without changing the pending operation.'


class SessionEnded(APIException):
    status_code = 401
    default_code = 'session_ended'
    default_detail = 'This session has ended. Sign in before retrying the same operation.'


class AccessExpired(SessionEnded):
    default_code = 'access_expired'
    default_detail = 'Access expired. Renew the session or sign in, then explicitly retry the operation.'
