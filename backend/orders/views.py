from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import BusinessPermission
from shop.serializers import flatten_errors

from . import delivery
from .limits import TOO_MANY, admit_order, record_order
from .models import OnlineOrder
from .pricing import OrderRefused
from .serializers import PlaceOrderInput, placed_document, status_document
from .services import place_order


def _ok(data, message='', status_code=status.HTTP_200_OK):
    return Response({'success': True, 'data': data, 'message': message}, status=status_code)


def _refused(errors):
    return Response({'success': False, 'error': errors}, status=status.HTTP_400_BAD_REQUEST)


def _too_many(throttled: Throttled):
    response = Response({'success': False, 'error': {'code': 'rate_limited', 'message': TOO_MANY}},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)
    if throttled.wait:
        response['Retry-After'] = str(int(throttled.wait))
    return response


class PlaceOrderView(APIView):
    """Customers send orders here from the shop. No sign-in: orders carry no account authority.

    Like the sign-in views, it runs outside the per-request session transaction, because the rate
    limiter needs its own short transactions.
    """
    independent_auth_session = True
    authentication_classes = ()
    permission_classes = [BusinessPermission]
    business_actions = {'POST': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def post(self, request):
        serializer = PlaceOrderInput(data=request.data)
        if not serializer.is_valid():
            return _refused(flatten_errors(serializer.errors))
        data = serializer.validated_data
        try:
            admit_order(request)
        except Throttled as throttled:
            return _too_many(throttled)
        if data['website']:
            # A bot filled the hidden field: answer like a success, keep nothing.
            record_order(request)
            return _ok({'number': 'RD-000000-0000', 'status': 'waiting'}, 'Order sent.', status.HTTP_201_CREATED)
        try:
            order, created = place_order(data, delivery.current_time())
        except OrderRefused as refused:
            return _refused(refused.errors)
        if created:
            record_order(request)
        return _ok(placed_document(order), 'Order sent.', status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class OrderStatusView(APIView):
    """The customer's status page, found by the unguessable token in their link."""
    authentication_classes = ()
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def get(self, request, token):
        order = get_object_or_404(OnlineOrder.objects.select_related('sale'), token=token)
        return _ok(status_document(order))
