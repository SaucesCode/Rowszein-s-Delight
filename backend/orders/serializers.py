"""The shape of what customers send, and what the public sees of an order."""
import re

from rest_framework import serializers

from shop.serializers import PLAIN_TEXT

PHONE_MESSAGE = 'Enter a mobile number like 0917 123 4567.'


def normalised_phone(raw: str) -> str | None:
    """A Philippine mobile number as +639XXXXXXXXX, or None."""
    digits = re.sub(r'[\s()\-.]', '', raw or '')
    if re.fullmatch(r'09\d{9}', digits):
        return '+63' + digits[1:]
    if re.fullmatch(r'\+?639\d{9}', digits):
        return '+' + digits.lstrip('+')
    return None


class ItemInput(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class BoxContentInput(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=48)


class BoxInput(serializers.Serializer):
    box_size = serializers.IntegerField(min_value=1, required=False)
    assortment = serializers.IntegerField(min_value=1, required=False)
    contents = BoxContentInput(many=True, required=False, max_length=12)

    def validate(self, attrs):
        if ('box_size' in attrs) == ('assortment' in attrs):
            raise serializers.ValidationError('Choose a box size or a ready-made box.')
        if 'box_size' in attrs and not attrs.get('contents'):
            raise serializers.ValidationError({'contents': 'Choose the flavours for this box.'})
        return attrs


class PlaceOrderInput(serializers.Serializer):
    client_key = serializers.RegexField(r'^[A-Za-z0-9_-]{8,64}$')
    customer_name = serializers.CharField(max_length=80, validators=[PLAIN_TEXT])
    phone = serializers.CharField(max_length=24)
    address = serializers.CharField(max_length=200, validators=[PLAIN_TEXT])
    note = serializers.CharField(max_length=300, allow_blank=True, required=False, default='', validators=[PLAIN_TEXT])
    town = serializers.IntegerField(min_value=1)
    delivery_date = serializers.DateField()
    payment_method = serializers.CharField(max_length=20, allow_blank=True, required=False, default='')
    items = ItemInput(many=True, required=False, max_length=50, default=list)
    boxes = BoxInput(many=True, required=False, max_length=20, default=list)
    # Hidden from people; bots fill it in.
    website = serializers.CharField(allow_blank=True, required=False, default='', max_length=200)

    def validate_phone(self, value):
        phone = normalised_phone(value)
        if phone is None:
            raise serializers.ValidationError(PHONE_MESSAGE)
        return phone

    def validate_items(self, value):
        products = [line['product'] for line in value]
        if len(products) != len(set(products)):
            raise serializers.ValidationError('List each item once.')
        return value

    def validate(self, attrs):
        if not attrs.get('items') and not attrs.get('boxes'):
            raise serializers.ValidationError('Add at least one item or box.')
        return attrs


class DeclineInput(serializers.Serializer):
    message = serializers.CharField(max_length=300, validators=[PLAIN_TEXT])


def _money(value):
    return None if value is None else format(value, '.2f')


def order_lines(order) -> dict:
    return {
        'number': order.number,
        'status': order.shown_status,
        'delivery_date': order.delivery_date.isoformat(),
        'town_name': order.town_name,
        'items': order.items,
        'boxes': order.boxes,
        'subtotal': _money(order.subtotal),
        'delivery_fee': _money(order.delivery_fee),
        'total': _money(order.total),
        'owner_message': order.owner_message,
        'created_at': order.created_at.isoformat(),
    }


def placed_document(order) -> dict:
    """What the customer gets right after sending: everything they need to find the order again."""
    return {**order_lines(order), 'token': order.token}


def status_document(order) -> dict:
    """The public status page. First name only; never the phone, address or note."""
    return {**order_lines(order), 'customer_first_name': order.customer_name.split()[0] if order.customer_name else ''}
