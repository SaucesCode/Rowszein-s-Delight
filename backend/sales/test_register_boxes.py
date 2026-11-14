from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase

from rest_framework.exceptions import ValidationError

from ingredients.models import Ingredient
from products.models import Assortment, AssortmentItem, BoxSize, Product
from recipes.models import Recipe, RecipeIngredient
from sales.box_lines import box_quantities, boxes_total, new_box_line, shop_box_price
from sales.models import Sale, SaleFinancialEntry, SaleItem
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

    def box(self, *pairs, **extra):
        return {'box_size': self.box_of_12.pk, 'contents': [{'product': p.pk, 'quantity': q} for p, q in pairs], **extra}

    def item(self, product, quantity):
        return {'product': product.pk, 'quantity': quantity, 'unit_price': str(product.price)}

    def created(self, payload, **kwargs):
        response = self.post_sale(payload, **kwargs)
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['data']

    def ledger(self, sale_id):
        return sum((e.amount for e in SaleFinancialEntry.objects.filter(sale_id=sale_id)), Decimal('0'))

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


class BoxSaleTests(BoxSalesFixture, TestCase):
    """Fixture stock: flour 20, milk 10. Test donut uses 2 flour + 1 milk; Ube and Choco use 1 flour each."""

    def test_box_only_sale_posts_money_and_takes_stock_per_donut(self):
        sale = self.created({'boxes': [self.box((self.product, 4), (self.ube, 4), (self.choco, 4))]})
        self.assertEqual((sale['total_amount'], len(sale['boxes']), sale['boxes'][0]['price']), ('440.00', 1, '440.00'))
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('4'), self.milk.pk: Decimal('6')})
        self.assertEqual(self.ledger(sale['id']), Decimal('440.00'))

    def test_mixed_sale_items_box_and_partner_item(self):
        sale = self.created({'sale_items': [self.item(self.product, 1), self.item(self.muffin, 1)],
                             'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        self.assertEqual(sale['total_amount'], '570.00')
        self.assertEqual(self.ledger(sale['id']), Decimal('570.00'))
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('6'), self.milk.pk: Decimal('9')})

    def test_same_donut_single_and_in_box_both_take_stock_and_cancel_returns_both(self):
        sale = self.created({'sale_items': [self.item(self.ube, 2)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        self.assertEqual(self.stock()[self.flour.pk], Decimal('6'))
        self.assertEqual(self.cancel(sale['id']).status_code, 200)
        self.assertEqual(self.stock(), {self.flour.pk: Decimal('20'), self.milk.pk: Decimal('10')})
        self.assertEqual(self.ledger(sale['id']), Decimal('0'))

    def test_edit_keeping_box_by_key_leaves_snapshot_and_stock(self):
        sale = self.created({'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        box = sale['boxes'][0]
        edited = self.edit(sale['id'], {'sale_items': [self.item(self.choco, 1)], 'boxes': [{'key': box['key']}]})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(edited.data['data']['boxes'], [box])
        self.assertEqual(self.stock()[self.flour.pk], Decimal('7'))
        self.assertEqual(self.ledger(sale['id']), Decimal('505.00'))

    def test_patch_with_only_items_keeps_boxes(self):
        sale = self.created({'sale_items': [self.item(self.choco, 1)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        edited = self.edit(sale['id'], {'sale_items': [self.item(self.choco, 2)]})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(edited.data['data']['boxes'], sale['boxes'])
        self.assertEqual(edited.data['data']['total_amount'], '550.00')

    def test_edit_removing_box_returns_its_stock_and_posts_adjustment(self):
        sale = self.created({'sale_items': [self.item(self.choco, 1)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        edited = self.edit(sale['id'], {'boxes': []})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(edited.data['data']['boxes'], [])
        self.assertEqual(self.stock()[self.flour.pk], Decimal('19'))
        self.assertEqual(SaleFinancialEntry.objects.filter(sale_id=sale['id'], kind='sale_adjustment').get().amount, Decimal('-460.00'))

    def test_removing_the_only_line_refused(self):
        sale = self.created({'boxes': [self.box((self.ube, 12))]})
        edited = self.edit(sale['id'], {'boxes': []})
        self.assertEqual(edited.status_code, 400)
        self.assertIn('Add at least one item or box.', str(edited.data))

    def test_unknown_box_key_refused(self):
        sale = self.created({'boxes': [self.box((self.ube, 12))]})
        edited = self.edit(sale['id'], {'boxes': [{'key': 'not-a-box'}]})
        self.assertEqual(edited.status_code, 400)
        self.assertIn('This box is no longer on the sale. Reload and try again.', str(edited.data))

    def test_box_price_fixed_after_size_extra_and_ready_made_change(self):
        ready = self.ready_made((self.ube, 6), (self.choco, 6))
        sale = self.created({'boxes': [{'assortment': ready.pk}]})
        BoxSize.objects.filter(pk=self.box_of_12.pk).update(price=Decimal('999.00'))
        Product.objects.filter(pk=self.ube.pk).update(box_extra=Decimal('50.00'))
        ready.delete()
        again = self.client.get(f"/api/sales/{sale['id']}/").data['data']
        self.assertEqual(again['boxes'], sale['boxes'])
        self.assertEqual((again['boxes'][0]['name'], again['boxes'][0]['price'], again['total_amount']), ('Classic dozen', '460.00', '460.00'))

    def test_idempotent_replay_of_box_sale_and_conflict_on_different_box(self):
        key = uuid4()
        first = self.post_sale({'boxes': [self.box((self.ube, 12))]}, key=key)
        replay = self.post_sale({'boxes': [self.box((self.ube, 12))]}, key=key)
        self.assertEqual((first.status_code, replay.status_code), (201, 201))
        self.assertEqual(first.data, replay.data)
        self.assertEqual(self.post_sale({'boxes': [self.box((self.choco, 12))]}, key=key).status_code, 409)

    def test_staff_box_sale_today_at_shop_price(self):
        response = self.post_sale({'date': self.today(), 'boxes': [self.box((self.ube, 6), (self.choco, 6))]}, client=self.staff)
        self.assertEqual(response.status_code, 201, response.data)
        refused = self.post_sale({'date': self.today(), 'boxes': [self.box((self.ube, 12), price='100.00')]}, client=self.staff)
        self.assertEqual(refused.status_code, 400)

    def test_legacy_sale_refuses_boxes(self):
        legacy = Sale.objects.create(date=date(2026, 11, 1), total_amount=Decimal('50.00'))
        SaleItem.objects.create(sale=legacy, product=self.product, quantity=1, unit_price=Decimal('50.00'))
        self.assertEqual(self.edit(legacy.pk, {'boxes': [self.box((self.ube, 12))]}).status_code, 409)


class BoxReviewFixTests(BoxSalesFixture, TestCase):
    def test_removing_a_box_with_a_resting_donut_is_allowed(self):
        sale = self.created({'sale_items': [self.item(self.ube, 1)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        Product.objects.filter(pk=self.ube.pk).update(is_available=False)
        edited = self.edit(sale['id'], {'boxes': []})
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(self.stock()[self.flour.pk], Decimal('19'))

    def test_swapping_a_single_while_keeping_a_box_with_a_resting_donut(self):
        sale = self.created({'sale_items': [self.item(self.ube, 1)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        Product.objects.filter(pk=self.ube.pk).update(is_available=False)
        edited = self.edit(sale['id'], {'sale_items': [self.item(self.choco, 1)], 'boxes': [{'key': sale['boxes'][0]['key']}]})
        self.assertEqual(edited.status_code, 200, edited.data)

    def test_adding_more_of_a_resting_donut_is_still_refused_by_name(self):
        sale = self.created({'sale_items': [self.item(self.ube, 1)]})
        Product.objects.filter(pk=self.ube.pk).update(is_available=False)
        edited = self.edit(sale['id'], {'sale_items': [self.item(self.ube, 2)]})
        self.assertEqual(edited.status_code, 400)
        self.assertIn("Ube test isn't available.", str(edited.data))

    def test_missing_recipe_message_names_the_donut(self):
        Recipe.objects.filter(product=self.choco).delete()
        response = self.post_sale({'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        self.assertEqual(response.status_code, 400)
        self.assertIn('Choco test has no recipe, so its stock can\'t be counted. Add its recipe first.', str(response.data))


class BoxReportTests(BoxSalesFixture, TestCase):
    def test_boxes_summary_counts_recorded_boxes_by_order_date(self):
        from sales.reporting import boxes_summary
        Ingredient.objects.filter(pk=self.flour.pk).update(quantity=Decimal('100'))
        self.created({'boxes': [self.box((self.ube, 6), (self.choco, 6)), self.box((self.choco, 12))]})
        cancelled = self.created({'boxes': [self.box((self.ube, 12))]})
        self.assertEqual(self.cancel(cancelled['id']).status_code, 200)
        self.created({'date': '2026-10-01', 'boxes': [self.box((self.choco, 12))]})
        self.assertEqual(boxes_summary(date(2026, 11, 1), date(2026, 11, 30)), {'count': 2, 'revenue': '860.00'})
        data = self.client.get('/api/dashboard/?date_from=2026-11-01&date_to=2026-11-30').data['data']
        self.assertEqual(data['boxes'], {'count': 2, 'revenue': '860.00'})

    def test_best_sellers_include_donuts_inside_boxes(self):
        self.created({'sale_items': [self.item(self.ube, 1)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        data = self.client.get('/api/dashboard/?date_from=2026-11-01&date_to=2026-11-30').data['data']
        quantities = {row['product_name']: row['total_quantity'] for row in data['best_selling']}
        self.assertEqual((quantities['Ube test'], quantities['Choco test']), (7, 6))

    def test_csv_lists_boxes_with_contents(self):
        self.created({'sale_items': [self.item(self.ube, 2)], 'boxes': [self.box((self.ube, 6), (self.choco, 6))]})
        response = self.client.get('/api/sales/export/csv/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Ube test x2, Box of 12 (6 Ube test, 6 Choco test)', response.content.decode())

    def test_pdf_uses_current_lines(self):
        from sales.reporting import describe_sale_lines
        sale = self.created({'sale_items': [self.item(self.ube, 1)], 'boxes': [self.box((self.choco, 12))]})
        self.assertEqual(describe_sale_lines(sale), 'Ube test x1, Box of 12 (12 Choco test)')
        self.assertEqual(self.client.get('/api/sales/export/pdf/').status_code, 200)
