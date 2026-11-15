"""Saving a customer's order."""
import secrets
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from shop.models import DeliveryTown, ShopSettings

from .delivery import delivery_date_problem
from .emails import queue_delivery
from .models import OnlineOrder, OrderEmail
from .pricing import OrderRefused, price_order

NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
PAUSED = 'Orders are paused right now.'


def new_order_number(now: datetime) -> str:
    """RD-YYMMDD-XXXX with the Manila date; unique across all orders."""
    day = timezone.localtime(now).strftime('%y%m%d')
    while True:
        number = f"RD-{day}-{''.join(secrets.choice(NUMBER_ALPHABET) for _ in range(4))}"
        if not OnlineOrder.objects.filter(number=number).exists():
            return number


def _problems(data: dict, settings: ShopSettings, now: datetime) -> tuple[dict, DeliveryTown | None]:
    errors: dict[str, list[str]] = {}
    if settings.orders_paused:
        errors['non_field_errors'] = [PAUSED]
    town = DeliveryTown.objects.filter(pk=data['town'], is_active=True).first()
    if town is None:
        errors['town'] = ["We don't deliver to that town."]
    methods = list(settings.payment_methods)
    if methods and data['payment_method'] not in methods:
        errors['payment_method'] = ["Pick how you'd like to pay."]
    elif not methods and data['payment_method']:
        errors['payment_method'] = ["Pick how you'd like to pay."]
    problem = delivery_date_problem(data['delivery_date'], now)
    if problem:
        errors['delivery_date'] = [problem]
    return errors, town


def place_order(data: dict, now: datetime) -> tuple[OnlineOrder, bool]:
    """Save a validated order (PlaceOrderInput.validated_data). Returns (order, created).

    A repeated client_key returns the order already saved, so a double tap or a retry never makes two.
    """
    existing = OnlineOrder.objects.filter(client_key=data['client_key']).first()
    if existing:
        return existing, False
    with transaction.atomic():
        settings = ShopSettings.objects.select_for_update().get(pk=1)
        errors, town = _problems(data, settings, now)
        try:
            priced = price_order(data['items'], data['boxes'])
        except OrderRefused as refused:
            errors.update(refused.errors)
            priced = None
        if errors:
            raise OrderRefused(errors)
        fee = town.fee
        try:
            with transaction.atomic():
                order = OnlineOrder.objects.create(
                    number=new_order_number(now), token=secrets.token_urlsafe(24), client_key=data['client_key'],
                    customer_name=data['customer_name'].strip(), phone=data['phone'], address=data['address'].strip(),
                    note=data['note'].strip(), town=town, town_name=town.name, delivery_fee=fee,
                    delivery_date=data['delivery_date'], payment_method=data['payment_method'],
                    items=priced['items'], boxes=priced['boxes'], subtotal=priced['subtotal'],
                    total=priced['subtotal'] + (fee or 0),
                )
        except IntegrityError:
            # Another request with the same client_key won the race.
            return OnlineOrder.objects.get(client_key=data['client_key']), False
        email = OrderEmail.objects.create(order=order)
        transaction.on_commit(lambda: queue_delivery(email.pk))
    return order, True
