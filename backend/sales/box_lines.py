"""Box lines on a sale: pricing and validation of a new box, and helpers over saved box snapshots.

A box line is fixed when recorded: its name, size, price and contents never change afterwards.
"""
from collections import Counter
from decimal import Decimal, localcontext
from uuid import uuid4

from rest_framework.exceptions import ValidationError

from products.boxes import flavour_rule_message, follows_flavour_rule
from sales.inventory_math import money_text


def _refuse(message):
    raise ValidationError({'boxes': message})


def shop_box_price(box_size, contents):
    """The shop's price: the size's price plus each premium donut's extra, per donut."""
    with localcontext() as context:
        context.prec = 50
        return box_size.price + sum((product.box_extra * quantity for product, quantity in contents), Decimal('0.00'))


def new_box_line(entry, products, role):
    """Validate and price a new box from a request entry. `products` is the sale's locked product map."""
    assortment = entry.get('assortment')
    box_size = assortment.box_size if assortment else entry['box_size']
    if assortment:
        pairs = [(item.product_id, item.quantity) for item in assortment.items.all()]
    else:
        pairs = [(content['product'].pk, content['quantity']) for content in entry['contents']]
    if any(count > 1 for count in Counter(pk for pk, _ in pairs).values()):
        _refuse('List each donut once.')
    contents = [(products[pk], quantity) for pk, quantity in pairs]
    for product, _ in contents:
        if product.partner_id:
            _refuse(f"{product.name} is a partner item and can't go in a box.")
        if not product.is_available:
            _refuse(f"{product.name} isn't available.")
    if assortment and sum(quantity for _, quantity in pairs) != box_size.size:
        _refuse("That ready-made box isn't full.")
    if not follows_flavour_rule(box_size.size, box_size.max_flavors, [quantity for _, quantity in pairs]):
        if assortment:
            _refuse("That ready-made box doesn't follow the flavour rule. Fix it on the Boxes page.")
        _refuse(flavour_rule_message(box_size.size, box_size.max_flavors))
    if role == 'staff' and (not box_size.is_available or (assortment and not assortment.is_available)):
        _refuse("That box isn't on sale.")
    shop_price = shop_box_price(box_size, contents)
    price = entry.get('price', shop_price)
    if role == 'staff' and price != shop_price:
        _refuse("Staff must use the shop's box price.")
    return {
        'key': uuid4().hex,
        'box_size_id': box_size.pk,
        'size': box_size.size,
        'assortment_id': assortment.pk if assortment else None,
        'name': assortment.name if assortment else f'Box of {box_size.size}',
        'price': money_text(price),
        'contents': [{'product': product.pk, 'product_name': product.name, 'quantity': quantity,
                      'box_extra': money_text(product.box_extra)}
                     for product, quantity in sorted(contents, key=lambda pair: pair[0].pk)],
    }


def box_quantities(boxes):
    """Donuts per product across box snapshots."""
    totals = Counter()
    for box in boxes:
        for content in box['contents']:
            totals[content['product']] += content['quantity']
    return dict(totals)


def boxes_total(boxes):
    with localcontext() as context:
        context.prec = 50
        return sum((Decimal(box['price']) for box in boxes), Decimal('0.00'))
