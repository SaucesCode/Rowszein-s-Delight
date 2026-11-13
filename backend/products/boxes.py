"""Box pricing and shop visibility rules.

A box costs its size's fixed price plus each premium donut's box_extra for
every one of that donut inside. Ready-made boxes only reach the shop when the
box size is on sale, every donut in it is on sale in an active category, and
the donuts fill the box exactly.
"""
from decimal import Decimal

from django.db.models import Prefetch, QuerySet

from .models import Assortment, AssortmentItem, BoxSize


def assortment_extras(assortment: Assortment) -> Decimal:
    return sum((item.quantity * item.product.box_extra for item in assortment.items.all()), Decimal('0.00'))


def assortment_price(assortment: Assortment) -> Decimal:
    return assortment.box_size.price + assortment_extras(assortment)


def is_complete(assortment: Assortment) -> bool:
    return sum(item.quantity for item in assortment.items.all()) == assortment.box_size.size


def is_shop_ready(assortment: Assortment) -> bool:
    return (
        assortment.is_available
        and assortment.box_size.is_available
        and is_complete(assortment)
        and all(item.product.is_available and item.product.category.is_active for item in assortment.items.all())
    )


def assortments_with_items() -> QuerySet[Assortment]:
    items = AssortmentItem.objects.select_related('product__category')
    return Assortment.objects.select_related('box_size').prefetch_related(Prefetch('items', queryset=items))


def shop_box_sizes() -> QuerySet[BoxSize]:
    return BoxSize.objects.filter(is_available=True)


def shop_assortments() -> list[Assortment]:
    candidates = assortments_with_items().filter(is_available=True, box_size__is_available=True)
    return [assortment for assortment in candidates if is_shop_ready(assortment)]
