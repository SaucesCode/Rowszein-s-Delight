"""Price a customer's order from the current catalog. The customer's browser never sets a price."""
from collections import Counter
from decimal import Decimal

from products.boxes import assortment_price, flavour_rule_message, follows_flavour_rule, shop_assortments, shop_box_sizes
from products.models import Product
from sales.box_lines import shop_box_price


class OrderRefused(Exception):
    """Customer-facing problems, keyed like the form's fields ("items.0.product")."""

    def __init__(self, errors: dict[str, list[str]]):
        super().__init__(errors)
        self.errors = errors


def money(value: Decimal) -> str:
    return format(value.quantize(Decimal('0.01')), 'f')


def sold_out(name: str) -> str:
    return f'{name} sold out a moment ago. Remove it to send your order.'


def _on_sale(product: Product | None) -> bool:
    return (product is not None and product.is_available and product.category.is_active
            and (product.partner_id is None or product.partner.is_active))


def price_order(items: list[dict], boxes: list[dict]) -> dict:
    """Validated input ({product, quantity}, {box_size, contents} | {assortment}) to a priced snapshot.

    Raises OrderRefused with every problem found, so the customer can fix them all at once.
    """
    errors: dict[str, list[str]] = {}
    wanted = {line['product'] for line in items}
    wanted |= {content['product'] for box in boxes for content in box.get('contents', [])}
    products = {p.pk: p for p in Product.objects.select_for_update(of=('self',)).select_related('category', 'partner')
                .filter(pk__in=wanted).order_by('pk')}

    priced_items, subtotal = [], Decimal('0.00')
    for index, line in enumerate(items):
        product = products.get(line['product'])
        if not _on_sale(product):
            errors[f'items.{index}.product'] = [sold_out(product.name if product else 'That item')]
            continue
        line_total = product.price * line['quantity']
        subtotal += line_total
        priced_items.append({
            'product': product.pk, 'name': product.name, 'unit_price': money(product.price),
            'quantity': line['quantity'], 'line_total': money(line_total),
            'partner': product.partner.name if product.partner_id else None,
        })

    sizes = {size.pk: size for size in shop_box_sizes()}
    ready = {assortment.pk: assortment for assortment in shop_assortments()}
    priced_boxes = []
    for index, box in enumerate(boxes):
        if 'assortment' in box:
            assortment = ready.get(box['assortment'])
            if assortment is None:
                errors[f'boxes.{index}.assortment'] = ["That ready-made box isn't on sale right now. Remove it to send your order."]
                continue
            price = assortment_price(assortment)
            contents = [(item.product, item.quantity) for item in assortment.items.all()]
            entry = {'box_size': assortment.box_size_id, 'assortment': assortment.pk, 'name': assortment.name}
            size = assortment.box_size
        else:
            size = sizes.get(box['box_size'])
            if size is None:
                errors[f'boxes.{index}.box_size'] = ["That box isn't on sale right now. Remove it to send your order."]
                continue
            pairs = [(content['product'], content['quantity']) for content in box['contents']]
            problem = None
            if any(count > 1 for count in Counter(pk for pk, _ in pairs).values()):
                problem = 'List each donut once.'
            for pk, _ in pairs:
                product = products.get(pk)
                if not _on_sale(product):
                    problem = sold_out(product.name if product else 'A donut in this box')
                elif product.partner_id:
                    problem = f"{product.name} can't go in a box."
            if problem is None and not follows_flavour_rule(size.size, size.max_flavors, [q for _, q in pairs]):
                problem = flavour_rule_message(size.size, size.max_flavors)
            if problem:
                errors[f'boxes.{index}.contents'] = [problem]
                continue
            contents = [(products[pk], quantity) for pk, quantity in pairs]
            price = shop_box_price(size, contents)
            entry = {'box_size': size.pk, 'assortment': None, 'name': f'Box of {size.size}'}
        subtotal += price
        priced_boxes.append({
            **entry, 'size': size.size, 'price': money(price),
            'contents': [{'product': product.pk, 'product_name': product.name, 'quantity': quantity}
                         for product, quantity in sorted(contents, key=lambda pair: pair[0].pk)],
        })

    if errors:
        raise OrderRefused(errors)
    return {'items': priced_items, 'boxes': priced_boxes, 'subtotal': subtotal}
