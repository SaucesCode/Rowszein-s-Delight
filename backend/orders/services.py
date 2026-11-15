"""Saving a customer's order."""
import hashlib
import json
import secrets
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from shop.models import DeliveryTown, ShopSettings

from .delivery import delivery_date_problem
from .emails import queue_delivery
from .models import OnlineOrder, OrderEmail
from .limits import OrderGate
from .pricing import OrderRefused, price_order

NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
PAUSED = 'Orders are paused right now.'
FINGERPRINTED = ('customer_name', 'phone', 'address', 'note', 'town', 'delivery_date', 'payment_method', 'items', 'boxes')


class OrderAlreadySent(Exception):
    """A retry with the same key but different contents: the first version was already saved."""

    def __init__(self, order: OnlineOrder):
        super().__init__(order.number)
        self.order = order


def fingerprint(data: dict) -> str:
    canonical = json.dumps({key: data[key] for key in FINGERPRINTED}, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


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


def _replayed(data: dict, digest: str) -> OnlineOrder | None:
    existing = OnlineOrder.objects.filter(client_key=data['client_key']).first()
    if existing and existing.fingerprint and existing.fingerprint != digest:
        raise OrderAlreadySent(existing)
    return existing


def place_order(data: dict, now: datetime, gate: OrderGate | None = None) -> tuple[OnlineOrder, bool]:
    """Save a validated order (PlaceOrderInput.validated_data). Returns (order, created).

    A repeated client_key returns the order already saved (before any rate limit), so a double tap or a
    retry never makes two and never hides a saved order. The gate checks and counts the order in the
    same transaction as the save.
    """
    digest = fingerprint(data)
    existing = _replayed(data, digest)
    if existing:
        return existing, False
    with transaction.atomic():
        if gate is not None:
            gate.admit()
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
                    fingerprint=digest,
                    customer_name=data['customer_name'].strip(), phone=data['phone'], address=data['address'].strip(),
                    note=data['note'].strip(), town=town, town_name=town.name, delivery_fee=fee,
                    delivery_date=data['delivery_date'], payment_method=data['payment_method'],
                    items=priced['items'], boxes=priced['boxes'], subtotal=priced['subtotal'],
                    total=priced['subtotal'] + (fee or 0),
                )
        except IntegrityError:
            # Another request with the same client_key won the race.
            winner = OnlineOrder.objects.filter(client_key=data['client_key']).first()
            if winner is None:
                raise
            if winner.fingerprint != digest:
                raise OrderAlreadySent(winner) from None
            return winner, False
        email = OrderEmail.objects.create(order=order)
        if gate is not None:
            gate.record()
        transaction.on_commit(lambda: queue_delivery(email.pk))
    return order, True
