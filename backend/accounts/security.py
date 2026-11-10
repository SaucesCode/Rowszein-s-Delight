"""CSRF enforcement/error transport only. No role/session/throttle policy."""
import logging
from django.utils.cache import patch_cache_control, patch_vary_headers
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import APIException

logger = logging.getLogger('django.security.csrf')
SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS', 'TRACE'}


class CSRFViolation(APIException):
    status_code = 403
    default_code = 'csrf_failed'
    default_detail = 'Request verification failed. Reload and try again.'

    def __init__(self, *, retryable):
        self.retryable = retryable
        super().__init__()


def enforce_csrf(request):
    native = getattr(request, '_request', request)
    if native.method in SAFE_METHODS:
        return
    # Production HTTPS uses Django's strict Referer fallback. Loopback HTTP
    # development must still identify its configured Origin explicitly.
    if not native.is_secure() and 'HTTP_ORIGIN' not in native.META:
        logger.warning('CSRF rejected: missing HTTP Origin')
        raise CSRFViolation(retryable=False)
    check = CSRFCheck(lambda unused_request: None)
    check.process_request(native)
    # APIView callbacks are csrf_exempt: use the explicit DRF pattern, not the
    # callback that would bypass Django's verification.
    reason = check.process_view(native, None, (), {})
    if reason:
        source_failed = reason.startswith(('Origin checking failed', 'Referer checking failed'))
        logger.warning('CSRF rejected: %s', 'source' if source_failed else 'token')
        raise CSRFViolation(retryable=not source_failed)


def api_exception_handler(error, context):
    # Imported only after APIView has initialized its authentication settings.
    from rest_framework.views import exception_handler
    response = exception_handler(error, context)
    if response is None:
        return None
    from .session_errors import SessionEnded, AuthUnavailable
    if isinstance(error, (SessionEnded, AuthUnavailable)):
        code = 'authentication_required' if isinstance(error, SessionEnded) else error.default_code
        response.data = {'success':False,'error':{'code':code,'reason':error.default_code,'message':str(error.detail)}}
    elif isinstance(error, CSRFViolation):
        response.data = {'success': False, 'error': {'code': 'csrf_failed',
            'message': str(error.detail), 'retryable': error.retryable}}
    elif response.status_code in {401, 403, 429}:
        code, message = {
            401: ('authentication_required', 'Authentication is required. Sign in and retry the same operation.'),
            403: ('forbidden', 'You do not have permission to perform this action.'),
            429: ('rate_limited', 'Too many requests. Wait before retrying.'),
        }[response.status_code]
        response.data = {'success': False, 'error': {'code': code, 'message': message}}
        if response.status_code == 429 and str(response.get('Retry-After', '')).isdigit():
            response.data['error']['retry_after'] = int(response['Retry-After'])
    if response.status_code in {401, 403, 429, 503}:
        patch_cache_control(response, no_store=True)
        patch_vary_headers(response, ['Cookie'])
    return response
