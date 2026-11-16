"""The owner's side of online orders: confirm into a sale, decline, and the 90-day contact clean-up."""
from datetime import date, timedelta
from uuid import UUID, uuid5

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, ValidationError

from products.models import Assortment
from sales.models import Sale
from sales.serializers import SaleSerializer
from sales.services import execute_sale

from .models import OnlineOrder
from .serializers import fulfilment_line

# Fixed namespace: the same order always maps to the same sales idempotency key, so a repeated
# confirm can never record a second sale.
SALE_KEY_NAMESPACE = UUID('5b0c5bd5-5c64-4f4b-9a39-2f0a1d6b7a11')
KEEP_CONTACTS_DAYS = 90


class OrderStateConflict(APIException):
    status_code = 409
    default_detail = 'This order has already been decided.'


def sale_key(order: OnlineOrder) -> UUID:
    return uuid5(SALE_KEY_NAMESPACE, f'online-order-{order.pk}')


def _assortment_unchanged(box: dict) -> bool:
    assortment = Assortment.objects.filter(pk=box.get('assortment')).prefetch_related('items').first()
    if assortment is None:
        return False
    current = sorted((item.product_id, item.quantity) for item in assortment.items.all())
    return current == sorted((content['product'], content['quantity']) for content in box['contents'])


def _sale_notes(order: OnlineOrder, fee: str) -> str:
    if order.fulfilment == 'meetup':
        line = fulfilment_line(order).removeprefix('Meet-up: ')
        return f'Online order {order.number}, {order.customer_name}, meet-up at {line}'
    return f'Online order {order.number}, {order.customer_name}, {order.town_name}; delivery fee: {fee}'


def sale_payload(order: OnlineOrder) -> dict:
    """The sales command's input, built from what the customer saw: their prices and their donuts."""
    boxes = []
    for box in order.boxes:
        if box.get('assortment') and _assortment_unchanged(box):
            boxes.append({'assortment': box['assortment'], 'price': box['price']})
        else:
            boxes.append({'box_size': box['box_size'], 'price': box['price'],
                          'contents': [{'product': c['product'], 'quantity': c['quantity']} for c in box['contents']]})
    fee = f'₱{order.delivery_fee}' if order.delivery_fee is not None else 'to confirm'
    return {
        'date': order.delivery_date.isoformat(),
        'notes': _sale_notes(order, fee),
        'sale_items': [{'product': line['product'], 'quantity': line['quantity'], 'unit_price': line['unit_price']}
                       for line in order.items],
        'boxes': boxes,
    }


def _locked_order(order_id: int) -> OnlineOrder:
    order = OnlineOrder.objects.select_for_update(of=('self',)).filter(pk=order_id).first()
    if order is None:
        raise NotFound('Order not found.')
    if order.status != 'waiting':
        raise OrderStateConflict()
    return order


def confirm_order(order_id: int, actor) -> OnlineOrder:
    """Record the order as a sale through the sales command. Any refusal leaves the order waiting."""
    with transaction.atomic():
        order = _locked_order(order_id)
        serializer = SaleSerializer(data=sale_payload(order))
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        result = execute_sale(action='sale_create', actor=actor, key=sale_key(order), data=serializer.validated_data)
        order.sale = Sale.objects.get(pk=result.body['data']['id'])
        order.status, order.decided_by, order.decided_at = 'confirmed', actor, timezone.now()
        order.save(update_fields=['sale', 'status', 'decided_by', 'decided_at'])
    return order


def decline_order(order_id: int, actor, message: str) -> OnlineOrder:
    with transaction.atomic():
        order = _locked_order(order_id)
        order.status, order.owner_message = 'declined', message.strip()
        order.decided_by, order.decided_at = actor, timezone.now()
        order.save(update_fields=['status', 'owner_message', 'decided_by', 'decided_at'])
    return order


def clear_old_contacts(today: date) -> int:
    """Clear phone, address and note once the delivery day is over 90 days past. The order itself stays."""
    return OnlineOrder.objects.filter(
        delivery_date__lt=today - timedelta(days=KEEP_CONTACTS_DAYS), contact_cleared_at__isnull=True,
    ).update(phone='', address='', note='', contact_cleared_at=timezone.now())
