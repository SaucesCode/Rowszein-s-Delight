import importlib
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from accounts.models import User

from .boxes import even_split, flavour_rule_message, follows_flavour_rule
from .models import Assortment, AssortmentItem, BoxSize, Category, Product


class EvenSplitTests(SimpleTestCase):
    def test_even_split(self):
        self.assertEqual(even_split(12, 3), [4, 4, 4])
        self.assertEqual(even_split(10, 3), [4, 3, 3])
        self.assertEqual(even_split(8, 1), [8])
        self.assertEqual(even_split(24, 4), [6, 6, 6, 6])

    def test_follows_rule(self):
        self.assertTrue(follows_flavour_rule(8, 2, [4, 4]))
        self.assertTrue(follows_flavour_rule(8, 2, [8]))
        self.assertFalse(follows_flavour_rule(8, 2, [7, 1]))
        self.assertFalse(follows_flavour_rule(8, 2, [3, 3, 2]))
        self.assertTrue(follows_flavour_rule(10, 3, [3, 4, 3]))

    def test_rule_message(self):
        self.assertEqual(flavour_rule_message(8, 2), 'A box of 8 takes up to 2 flavours, filled evenly.')


class MigrationDefaultTests(SimpleTestCase):
    def test_migration_defaults(self):
        migration = importlib.import_module('products.migrations.0007_boxsize_max_flavors')
        self.assertEqual([migration.default_max_flavors(size) for size in (6, 8, 12, 24)], [2, 2, 3, 4])


class FlavourRuleApiTests(TestCase):
    def setUp(self):
        self.owner = APIClient()
        self.owner.force_authenticate(User.objects.create_user(username='flavour-owner', role='admin'))
        category = Category.objects.create(slug='flavour-test', name='Flavour test')
        self.glazed, self.ube, self.choco = (
            Product.objects.create(name=name, price=Decimal('40.00'), category=category)
            for name in ('Glazed test', 'Ube test', 'Choco test'))
        self.box_of_8 = BoxSize.objects.create(size=8, price=Decimal('280.00'), max_flavors=2)

    def save_box(self, *pairs):
        return self.owner.post('/api/products/assortments/', {
            'name': 'Test pair', 'box_size_id': self.box_of_8.pk, 'is_available': True,
            'contents': [{'product_id': product.pk, 'quantity': quantity} for product, quantity in pairs]}, format='json')

    def test_max_flavors_validated(self):
        url = f'/api/products/box-sizes/{self.box_of_8.pk}/'
        for value in (0, 9, 13):
            response = self.owner.patch(url, {'max_flavors': value}, format='json')
            self.assertEqual(response.status_code, 400, value)
            self.assertEqual([str(m) for m in response.data['error']['max_flavors']], ['Choose 1 to 8 flavours.'])
        self.assertEqual(self.owner.patch(url, {'max_flavors': 3}, format='json').status_code, 200)

    def test_new_size_gets_a_default_from_its_size(self):
        response = self.owner.post('/api/products/box-sizes/', {'size': 24, 'price': '780.00'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['data']['max_flavors'], 4)

    def test_ready_made_must_follow_rule(self):
        uneven = self.save_box((self.glazed, 7), (self.ube, 1))
        self.assertEqual(uneven.status_code, 400)
        self.assertEqual([str(m) for m in uneven.data['error']['contents']], ['A box of 8 takes up to 2 flavours, filled evenly.'])
        too_many = self.save_box((self.glazed, 3), (self.ube, 3), (self.choco, 2))
        self.assertEqual(too_many.status_code, 400)
        self.assertEqual(self.save_box((self.glazed, 4), (self.ube, 4)).status_code, 201)

    def test_lowering_limit_hides_ready_made_from_shop_and_flags_it(self):
        box = Assortment.objects.create(name='Pair', box_size=self.box_of_8)
        AssortmentItem.objects.create(assortment=box, product=self.glazed, quantity=4)
        AssortmentItem.objects.create(assortment=box, product=self.ube, quantity=4)
        self.assertEqual([a['name'] for a in APIClient().get('/api/products/boxes/').data['data']['assortments']], ['Pair'])
        self.box_of_8.max_flavors = 1
        self.box_of_8.save()
        self.assertEqual(APIClient().get('/api/products/boxes/').data['data']['assortments'], [])
        listed = self.owner.get('/api/products/assortments/').data['data']
        self.assertFalse(listed[0]['follows_rule'])

    def test_public_sizes_show_their_limit(self):
        sizes = APIClient().get('/api/products/boxes/').data['data']['sizes']
        self.assertEqual(sizes[0]['max_flavors'], 2)
