from django.core.paginator import Paginator
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, Throttled
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import BusinessPermission
from shop.serializers import flatten_errors

from . import delivery
from .emails import email_problem, retry_due_emails_soon
from .limits import TOO_MANY, OrderGate
from .models import OnlineOrder
from .pricing import OrderRefused
from .owner import clear_old_contacts, confirm_order, decline_order
from .serializers import DeclineInput, PlaceOrderInput, owner_document, owner_row, placed_document, status_document
from .services import OrderAlreadySent, place_order


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
    # JSON only: a cross-site form can't send it without a CORS preflight, which the API refuses.
    parser_classes = [JSONParser]
    permission_classes = [BusinessPermission]
    business_actions = {'POST': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def post(self, request):
        serializer = PlaceOrderInput(data=request.data)
        if not serializer.is_valid():
            return _refused(flatten_errors(serializer.errors))
        data = serializer.validated_data
        if data['website']:
            # A bot filled the hidden field: answer like a success, keep nothing.
            return _ok({'number': 'RD-000000-0000', 'status': 'waiting'}, 'Order sent.', status.HTTP_201_CREATED)
        try:
            order, created = place_order(data, delivery.current_time(), OrderGate(request))
        except Throttled as throttled:
            return _too_many(throttled)
        except OrderRefused as refused:
            return _refused(refused.errors)
        except OrderAlreadySent as sent:
            return Response({'success': False, 'data': placed_document(sent.order), 'error': {
                'code': 'already_sent',
                'message': f"Your earlier order {sent.order.number} was already sent, so these changes weren't added. "
                           'Message us to change it.',
            }}, status=status.HTTP_409_CONFLICT)
        return _ok(placed_document(order), 'Order sent.', status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class OrderStatusView(APIView):
    """The customer's status page, found by the unguessable token in their link."""
    authentication_classes = ()
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def get(self, request, token):
        order = get_object_or_404(OnlineOrder.objects.select_related('sale'), token=token)
        return _ok(status_document(order))


PAGE_SIZE = 20
LIST_FILTERS = {'waiting', 'confirmed', 'declined'}


def _manage_actions(*methods):
    return {**{method: 'orders.manage' for method in methods}, 'OPTIONS': 'orders.manage'}


def _owner_order(pk):
    return get_object_or_404(OnlineOrder.objects.select_related('sale'), pk=pk)


class OwnerOrderListView(APIView):
    """The owner's Orders list. Opening it also clears old contact details and retries due emails."""
    permission_classes = [BusinessPermission]
    business_actions = _manage_actions('GET')

    def get(self, request):
        clear_old_contacts(timezone.localdate())
        transaction.on_commit(retry_due_emails_soon)
        orders = OnlineOrder.objects.select_related('sale')
        wanted = request.query_params.get('status', '')
        if wanted in LIST_FILTERS:
            orders = orders.filter(status=wanted)
        page = Paginator(orders, PAGE_SIZE).get_page(request.query_params.get('page'))
        problem = email_problem()
        return _ok({
            'results': [owner_row(order) for order in page.object_list],
            'count': page.paginator.count,
            'next': page.next_page_number() if page.has_next() else None,
            'previous': page.previous_page_number() if page.has_previous() else None,
            'waiting_count': OnlineOrder.objects.filter(status='waiting').count(),
            'email_problem': bool(problem),
            'email_problem_text': problem,
        })


class OwnerOrderDetailView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = _manage_actions('GET')

    def get(self, request, pk):
        return _ok(owner_document(_owner_order(pk)))


def _decided(request, pk, decide):
    """Run a confirm or decline; a refusal answers with its message and the order as it stands."""
    try:
        order = decide()
    except APIException as error:
        body = {'success': False, 'error': error.detail}
        current = OnlineOrder.objects.select_related('sale').filter(pk=pk).first()
        if current is not None:
            body['data'] = owner_document(current)
        return Response(body, status=error.status_code)
    order = _owner_order(order.pk)
    return _ok(owner_document(order), 'Order confirmed.' if order.status == 'confirmed' else 'Order declined.')


class ConfirmOrderView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = _manage_actions('POST')

    def post(self, request, pk):
        return _decided(request, pk, lambda: confirm_order(pk, request.user))


class DeclineOrderView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = _manage_actions('POST')

    def post(self, request, pk):
        serializer = DeclineInput(data=request.data)
        if not serializer.is_valid():
            return _refused(flatten_errors(serializer.errors))
        return _decided(request, pk, lambda: decline_order(pk, request.user, serializer.validated_data['message']))
