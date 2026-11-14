from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase

from products.models import BoxSize
from sales.test_partner_sales import PartnerSalesFixture


class BoxSalesFixture(PartnerSalesFixture):
    def setUp(self):
        super().setUp()
        self.box_of_12 = BoxSize.objects.create(size=12, price=Decimal('400.00'), max_flavors=3)

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
