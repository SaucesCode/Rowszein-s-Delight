from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase

from rest_framework.exceptions import ValidationError

from products.models import Assortment, AssortmentItem, BoxSize, Product
from recipes.models import Recipe, RecipeIngredient
from sales.box_lines import box_quantities, boxes_total, new_box_line, shop_box_price
from sales.test_partner_sales import PartnerSalesFixture


class BoxSalesFixture(PartnerSalesFixture):
    def setUp(self):
        super().setUp()
        self.box_of_12 = BoxSize.objects.create(size=12, price=Decimal('400.00'), max_flavors=3)
        self.ube = self.donut('Ube test', '55.00', box_extra='10.00')
        self.choco = self.donut('Choco test', '45.00')

    def donut(self, name, price, box_extra='0.00'):
        product = Product.objects.create(name=name, price=Decimal(price), category=self.product.category, box_extra=Decimal(box_extra))
        RecipeIngredient.objects.create(recipe=Recipe.objects.create(product=product, yield_quantity=1), ingredient=self.flour, quantity='1')
        return product

    def products(self):
        return {product.pk: product for product in Product.objects.all()}

    def size_box(self, *pairs, price=None):
        entry = {'box_size': self.box_of_12, 'contents': [{'product': product, 'quantity': quantity} for product, quantity in pairs]}
        if price is not None:
            entry['price'] = Decimal(price)
        return entry

    def ready_made(self, *pairs, name='Classic dozen'):
        box = Assortment.objects.create(name=name, box_size=self.box_of_12)
        for product, quantity in pairs:
            AssortmentItem.objects.create(assortment=box, product=product, quantity=quantity)
        return box

    def post_sale(self, payload, client=None, key=None):
        body = {'date': '2026-11-09', 'notes': '', **payload}
        return (client or self.client).post('/api/sales/', body, format='json', HTTP_IDEMPOTENCY_KEY=str(key or uuid4()))


class BoxRequestValidationTests(BoxSalesFixture, TestCase):
    def errors(self, response):
        self.assertEqual(response.status_code, 400, response.data)
        return str(response.data['error'])

    def test_box_entry_needs_exactly_one_of_key_size_or_ready_made(self):
        both = self.post_sale({'boxes': [{'box_size': self.box_of_12.pk, 'key': 'abc',
                                          'contents': [{'product': self.product.pk, 'quantity': 12}]}]})
        self.assertIn('Choose a box size or a ready-made box.', self.errors(both))
        neither = self.post_sale({'boxes': [{}]})
        self.assertIn('Choose a box size or a ready-made box.', self.errors(neither))

    def test_contents_only_with_a_box_size(self):
        response = self.post_sale({'boxes': [{'key': 'abc', 'contents': [{'product': self.product.pk, 'quantity': 12}]}]})
        self.assertIn('Only a box size takes contents.', self.errors(response))

    def test_kept_box_cannot_be_repriced(self):
        response = self.post_sale({'boxes': [{'key': 'abc', 'price': '1.00'}]})
        self.assertIn('A saved box keeps its price.', self.errors(response))

    def test_sale_needs_an_item_or_a_box(self):
        response = self.post_sale({'sale_items': []})
        self.assertIn('Add at least one item or box.', self.errors(response))
        self.assertIn('Add at least one item or box.', self.errors(self.post_sale({})))

    def test_more_than_fifty_boxes_refused(self):
        box = {'box_size': self.box_of_12.pk, 'contents': [{'product': self.product.pk, 'quantity': 12}]}
        self.assertEqual(self.post_sale({'boxes': [box] * 51}).status_code, 400)


class BoxLineTests(BoxSalesFixture, TestCase):
    def refused(self, entry, role='admin'):
        with self.assertRaises(ValidationError) as caught:
            new_box_line(entry, self.products(), role)
        return str(caught.exception.detail)

    def test_shop_price_adds_premium_extras(self):
        self.assertEqual(shop_box_price(self.box_of_12, [(self.product, 4), (self.ube, 4), (self.choco, 4)]), Decimal('440.00'))

    def test_new_box_snapshot(self):
        line = new_box_line(self.size_box((self.product, 4), (self.ube, 4), (self.choco, 4)), self.products(), 'staff')
        self.assertEqual((line['name'], line['size'], line['price'], line['assortment_id']), ('Box of 12', 12, '440.00', None))
        self.assertEqual([(c['product_name'], c['quantity'], c['box_extra']) for c in line['contents']],
                         [('Test donut', 4, '0.00'), ('Ube test', 4, '10.00'), ('Choco test', 4, '0.00')])
        self.assertEqual(len(line['key']), 32)

    def test_uneven_or_too_many_flavours_refused_for_owner_and_staff(self):
        for role in ('admin', 'staff'):
            self.assertIn('A box of 12 takes up to 3 flavours, filled evenly.', self.refused(self.size_box((self.product, 11), (self.ube, 1)), role))
        fourth = self.donut('Matcha test', '50.00')
        self.assertIn('takes up to 3 flavours', self.refused(self.size_box((self.product, 3), (self.ube, 3), (self.choco, 3), (fourth, 3))))

    def test_partner_item_refused(self):
        self.assertIn("Banana muffin is a partner item and can't go in a box.", self.refused(self.size_box((self.product, 6), (self.muffin, 6))))

    def test_unavailable_donut_refused(self):
        Product.objects.filter(pk=self.product.pk).update(is_available=False)
        self.assertIn("Test donut isn't available.", self.refused(self.size_box((self.product, 6), (self.ube, 6))))

    def test_donut_listed_twice_refused(self):
        self.assertIn('List each donut once.', self.refused(self.size_box((self.product, 6), (self.product, 6))))

    def test_staff_must_use_shop_price(self):
        self.assertIn("Staff must use the shop's box price.", self.refused(self.size_box((self.product, 12), price='300.00'), 'staff'))
        line = new_box_line(self.size_box((self.product, 12), price='400.00'), self.products(), 'staff')
        self.assertEqual(line['price'], '400.00')

    def test_staff_cannot_use_off_sale_size(self):
        self.box_of_12.is_available = False
        self.box_of_12.save()
        self.assertIn("That box isn't on sale.", self.refused(self.size_box((self.product, 12)), 'staff'))

    def test_owner_may_discount_and_use_off_sale_size(self):
        self.box_of_12.is_available = False
        self.box_of_12.save()
        line = new_box_line(self.size_box((self.product, 12), price='350.00'), self.products(), 'admin')
        self.assertEqual(line['price'], '350.00')

    def test_ready_made_copies_contents_and_price(self):
        box = self.ready_made((self.product, 6), (self.ube, 6))
        line = new_box_line({'assortment': box}, self.products(), 'staff')
        self.assertEqual((line['name'], line['assortment_id'], line['price']), ('Classic dozen', box.pk, '460.00'))
        self.assertEqual([(c['product'], c['quantity']) for c in line['contents']], [(self.product.pk, 6), (self.ube.pk, 6)])

    def test_ready_made_breaking_rule_refused(self):
        box = self.ready_made((self.product, 6), (self.ube, 6))
        self.box_of_12.max_flavors = 1
        self.box_of_12.save()
        box.refresh_from_db()
        self.assertIn("That ready-made box doesn't follow the flavour rule. Fix it on the Boxes page.", self.refused({'assortment': box}))

    def test_ready_made_that_isnt_full_refused(self):
        box = self.ready_made((self.product, 6))
        self.assertIn("That ready-made box isn't full.", self.refused({'assortment': box}))

    def test_box_quantities_and_total_merge_boxes(self):
        products = self.products()
        one = new_box_line(self.size_box((self.product, 6), (self.ube, 6)), products, 'admin')
        two = new_box_line(self.size_box((self.product, 12)), products, 'admin')
        self.assertEqual(box_quantities([one, two]), {self.product.pk: 18, self.ube.pk: 6})
        self.assertEqual(boxes_total([one, two]), Decimal('860.00'))
