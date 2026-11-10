import time
from django.db import DatabaseError, transaction
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from .session_errors import AuthUnavailable, SessionEnded


def unavailable():
    return JsonResponse({'success':False,'error':{'code':'auth_unavailable','message':str(AuthUnavailable.default_detail)}},status=503)


class SessionTransactionMiddleware(MiddlewareMixin):
    """Last process_view hook: CSRF runs first; DRF errors still roll back."""
    def process_view(self, request, callback, args, kwargs):
        if not request.path.startswith('/api/'):
            return None
        cls = getattr(callback,'cls',None) or getattr(callback,'view_class',None)
        if getattr(cls,'independent_auth_session',False):
            return None
        from .device_sessions import current_session, finish_request
        from .session_database import set_transaction_bounds
        token = current_session.set(None)
        started = time.monotonic()
        try:
            with transaction.atomic():
                set_transaction_bounds()
                request.session_security_wrapped = True
                response = callback(request,*args,**kwargs)
                if getattr(response,'streaming',False):
                    raise AuthUnavailable()
                if hasattr(response,'render'):
                    response.render()
                if response.status_code >= 400:
                    transaction.set_rollback(True)
                else:
                    finish_request(request,response)
                if time.monotonic() - started > 10:
                    raise AuthUnavailable()
                return response
        except (DatabaseError,AuthUnavailable):
            return unavailable()
        except SessionEnded as error:
            return JsonResponse({'success':False,'error':{'code':'session_ended','message':str(error.detail)}},status=401)
        finally:
            current_session.reset(token)
