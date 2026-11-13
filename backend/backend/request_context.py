"""A request ID for every request, attached to its log events and response.

The ID is returned as the ``X-Request-ID`` header so a problem a user reports
can be matched to the exact log lines. A safe ID from the hosting proxy is
reused so its access logs line up with ours.
"""
import logging
import re
import uuid
from contextvars import ContextVar

HEADER = "X-Request-ID"
SAFE_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")

current_request_id: ContextVar[str] = ContextVar("current_request_id", default="-")


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get(HEADER, "")
        request_id = incoming if SAFE_ID.fullmatch(incoming) else uuid.uuid4().hex
        request.request_id = request_id
        token = current_request_id.set(request_id)
        try:
            response = self.get_response(request)
        finally:
            current_request_id.reset(token)
        response[HEADER] = request_id
        return response


class RequestIdFilter(logging.Filter):
    """Stamps each record with its request's ID ("-" outside a request).

    Django logs error responses after the middleware has finished, so for those
    the ID comes from the request object attached to the record.
    """

    def filter(self, record):
        if not hasattr(record, "request_id"):
            request = getattr(record, "request", None)
            record.request_id = getattr(request, "request_id", None) or current_request_id.get()
        return True
