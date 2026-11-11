from decimal import Decimal
from django.test import TransactionTestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from accounts.models import User
from session_api_contracts import bind_fixture,cookie_client,BUSINESS_MODELS
from products.models import Product,Category
from ingredients.models import Ingredient
from recipes.models import Recipe,RecipeIngredient

class PaginationContracts(TransactionTestCase):
    def setUp(self):
        self.owner=User.objects.create_user(username='lookup-owner',password='synthetic-only',role='admin')
        self.staff=User.objects.create_user(username='lookup-staff',password='synthetic-only',role='staff')
        self.client=cookie_client(bind_fixture(self.owner)[1])
        self.staff_client=cookie_client(bind_fixture(self.staff)[1])
        self.public=cookie_client()
        Category.objects.all().delete()  # Remove only migration-seeded test categories.
        for i in range(1,26):
            category=Category.objects.create(name=f'Similar category {i:02}',slug=f'cat-{i}')
            product=Product.objects.create(name=f'Similar product {i:02}',category=category,price='50',is_featured=i==25)
            ingredient=Ingredient.objects.create(name=f'Similar ingredient {i:02}',unit='kg',quantity='20',cost_per_unit='1',supplier='OWNER-SECRET')
            recipe=Recipe.objects.create(product=product,yield_quantity=3)
            RecipeIngredient.objects.create(recipe=recipe,ingredient=ingredient,quantity='.01')
    def get(self,url,client=None): return (client or self.client).get(url,secure=True)
    def data(self,url,client=None):
        response=self.get(url,client)
        self.assertEqual(response.status_code,200,response.data)
        return response.data['data']
    def test_product_boundaries_zero_one_twenty_twentyone_twentyfive(self):
        Recipe.objects.all().delete()
        Product.objects.all().delete()
        category=Category.objects.first()
        for count in [0,1,20,21,25]:
            Product.objects.all().delete()
            Product.objects.bulk_create([Product(name=f'Boundary {i:02}',price='50',category=category) for i in range(count)])
            first=self.data('/api/products/')
            self.assertEqual((first['count'],len(first['results'])),(count,min(count,20)))
            if count>20:
                second=self.data('/api/products/?page=2')
                ids=[r['id'] for r in first['results']+second['results']]
                self.assertEqual(len(set(ids)),count)
            else: self.assertIsNone(first['next'])
    def test_all_four_lists_are_complete_and_deterministic(self):
        for path in ['products','products/categories','ingredients','recipes']:
            with self.subTest(path=path):
                a=self.data(f'/api/{path}/?page=1')
                b=self.data(f'/api/{path}/?page=2')
                self.assertEqual((len(a['results']),len(b['results'])),(20,5))
                self.assertEqual(len({r['id'] for r in a['results']+b['results']}),25)
                self.assertEqual(a,self.data(f'/api/{path}/?page=1'))
    def test_search_finds_last_record_for_all_lists(self):
        for path in ['products','products/categories','ingredients','recipes']:
            data=self.data(f'/api/{path}/?search=25')
            self.assertEqual(data['count'],1)
    def test_featured_on_later_page_and_false_filter(self):
        self.assertEqual(self.data('/api/products/?is_featured=true',self.public)['count'],1)
        self.assertEqual(self.data('/api/products/?is_featured=false',self.public)['count'],24)
    def test_public_restrictions_cannot_be_widened(self):
        Product.objects.filter(name__endswith='25').update(is_available=False)
        Category.objects.filter(name__endswith='24').update(is_active=False)
        self.assertEqual(self.data('/api/products/',self.public)['count'],23)
        self.assertEqual(self.data('/api/products/?is_available=false',self.public)['count'],0)
        self.assertEqual(self.data('/api/products/categories/?is_active=false',self.public)['count'],0)
    def test_projection_and_private_filter_side_channels(self):
        for client in [self.public,self.staff_client]:
            item=self.data('/api/products/',client)['results'][0]
            self.assertNotIn('recipe',item)
        item=self.data('/api/ingredients/',self.staff_client)['results'][0]
        self.assertNotIn('supplier',item);self.assertNotIn('cost_per_unit',item)
        self.assertEqual(self.data('/api/ingredients/?search=OWNER-SECRET',self.staff_client)['count'],0)
        self.assertEqual(self.get('/api/ingredients/?ordering=cost_per_unit',self.staff_client).status_code,400)
        self.assertEqual(self.get('/api/ingredients/?ordering=value',self.staff_client).status_code,400)
        self.assertEqual(self.get('/api/ingredients/?ordering=minimum_stock',self.staff_client).status_code,400)
        self.assertEqual(self.get('/api/ingredients/?category=other',self.staff_client).status_code,400)
        self.assertEqual(self.get('/api/products/?ordering=created_at',self.public).status_code,400)
        self.assertEqual(self.get('/api/recipes/',self.staff_client).status_code,403)
    def test_bad_parameters_empty_defaults_and_page_size(self):
        for query in ['page=0','page=-1','page=1.5','page=nope','page_size=21','page_size=0','ordering=supplier',
                'search=a&search=b','unknown=1','category=bad','is_featured=1','search='+'x'*101]:
            self.assertEqual(self.get('/api/products/?'+query).status_code,400,query)
        self.assertEqual(self.get('/api/products/?page=99').status_code,404)
        self.assertEqual(len(self.data('/api/products/?page_size=5')['results']),5)
        self.assertEqual(len(self.data('/api/products/?page=last')['results']),5)
        self.assertEqual(len(self.data('/api/products/?page=&search=&ordering=')['results']),20)
    def test_selected_id_and_category_filters(self):
        product=Product.objects.get(name__endswith='25')
        self.assertEqual(self.data(f'/api/products/?id={product.pk}')['results'][0]['id'],product.pk)
        self.assertEqual(self.data(f'/api/products/?category={product.category_id}')['count'],1)
        self.assertEqual(self.data(f'/api/recipes/?category={product.category_id}')['count'],1)
        self.assertEqual(self.data('/api/products/?id=99999')['count'],0)
    def test_stock_status_filter_and_order(self):
        ingredient=Ingredient.objects.first()
        Ingredient.objects.filter(pk=ingredient.pk).update(minimum_stock='21')
        self.assertEqual(self.data('/api/ingredients/?status=low_stock')['count'],1)
        self.assertEqual(self.data('/api/ingredients/?status=healthy')['count'],24)
        self.assertEqual(self.get('/api/ingredients/?status=bad').status_code,400)
    def test_equal_price_sort_has_unique_tie_breaker(self):
        first=self.data('/api/products/?ordering=price')['results']
        second=self.data('/api/products/?ordering=price&page=2')['results']
        ids=[r['id'] for r in first+second]
        self.assertEqual(ids,sorted(ids))
    def test_recipe_readonly_ranking_and_category_annotation(self):
        for order in ['batch_cost_desc','cost_per_unit_asc','most_ingredients']:
            data=self.data('/api/recipes/?ordering='+order)
            self.assertEqual(data['count'],25)
            self.assertIn('category',data['results'][0])

    def test_recipe_unit_ranking_does_not_integer_divide(self):
        rows=list(Recipe.objects.order_by('pk')[:2])
        RecipeIngredient.objects.filter(recipe=rows[0]).update(quantity=1)
        RecipeIngredient.objects.filter(recipe=rows[1]).update(quantity=3)
        Recipe.objects.filter(pk=rows[0].pk).update(yield_quantity=2)
        Recipe.objects.filter(pk=rows[1].pk).update(yield_quantity=10)
        ordered=[row['id'] for row in self.data('/api/recipes/?ordering=cost_per_unit_asc&page=2')['results']]
        self.assertEqual(ordered[-2:],[rows[1].pk,rows[0].pk])
    def test_query_count_is_bounded_by_page_not_row_count(self):
        counts=[]
        for size in [1,20]:
            with CaptureQueriesContext(connection) as captured:
                self.data(f'/api/recipes/?page_size={size}')
            counts.append(len(captured))
        self.assertLessEqual(counts[1],counts[0]+2,counts)
        print('RECIPE_QUERY_COUNTS size1,size20:',counts)
    def test_reads_and_denied_queries_do_not_mutate_business_data(self):
        before=[list(m.objects.order_by('pk').values()) for m in BUSINESS_MODELS]
        self.get('/api/ingredients/?search=25')
        self.get('/api/recipes/',self.staff_client)
        self.get('/api/ingredients/?ordering=cost_per_unit',self.staff_client)
        self.assertEqual(before,[list(m.objects.order_by('pk').values()) for m in BUSINESS_MODELS])
