"""Desired-behavior audit probes. Red assertions are findings, not fixes.

Real revocable cookies + CSRF + active owner/staff. Synthetic owned DB only.
No authenticator, authorization, business service, or database mocking.
"""
import csv
import io
from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TransactionTestCase
from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from expenses.models import Expense
from sales.models import Sale, SaleItem, InventoryOperation, StockMovement, SaleFinancialEntry, SaleConsumption
from session_api_contracts import bind_fixture, cookie_client


class AuditCases(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='audit-owner', password='isolated-synthetic-only', role='admin')
        _, tokens = bind_fixture(self.owner)
        self.client = cookie_client(tokens)
        self.category = Category.objects.create(name='Audit category', slug='audit-category')
        self.product = Product.objects.create(name='Audit product', category=self.category, price='50')
        self.ingredient = Ingredient.objects.create(name='Audit flour', unit='kg', quantity='20', cost_per_unit='1')
        self.recipe = Recipe.objects.create(product=self.product, yield_quantity=3)
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.ingredient, quantity='.01')

    def get(self, path):
        return self.client.get(path, secure=True)

    def sale(self, **kwargs):
        data = {'date': '2026-11-09', 'notes': '=1+1', 'sale_items': [
            {'product': self.product.pk, 'quantity': 1, 'unit_price': '50.00'}]}
        data.update(kwargs)
        return self.client.post('/api/sales/', data, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))

    def test_cost01_model_rejects_negative_cost(self):
        self.ingredient.cost_per_unit = Decimal('-1')
        with self.assertRaises(ValidationError, msg='Negative cost passes full_clean.'):
            self.ingredient.full_clean()

    def test_cost01_database_rejects_negative_cost(self):
        with self.assertRaises(IntegrityError, msg='Database stores a negative ingredient cost.'):
            with transaction.atomic():
                Ingredient.objects.filter(pk=self.ingredient.pk).update(cost_per_unit='-1')

    def test_bounds_database_rejects_negative_product_price(self):
        with self.assertRaises(IntegrityError, msg='Database stores a negative product price.'):
            with transaction.atomic():
                Product.objects.filter(pk=self.product.pk).update(price='-1')

    def test_bounds_database_rejects_negative_expense(self):
        with self.assertRaises(IntegrityError, msg='Database stores a negative expense.'):
            with transaction.atomic():
                Expense.objects.create(amount='-1', date='2026-11-09')

    def test_bounds_database_rejects_negative_recipe_quantity(self):
        with self.assertRaises(IntegrityError, msg='Database stores negative recipe usage.'):
            with transaction.atomic():
                self.recipe.recipe_ingredients.update(quantity='-1')

    def test_category_protected_delete_returns_conflict(self):
        self.client.raise_request_exception = False
        response = self.client.delete(f'/api/products/categories/{self.category.pk}/', secure=True)
        self.assertEqual(response.status_code, 409, 'Protected category deletion must return a business conflict, not auth_unavailable/503.')

    def test_catalog_featured_filter_honored(self):
        response = cookie_client().get('/api/products/?is_featured=true', secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['count'], 0, 'Unfeatured product included in featured query.')

    def test_sales_malformed_date_rejected(self):
        self.assertEqual(self.get('/api/sales/?date_from=bad').status_code, 400)

    def test_expenses_malformed_date_rejected(self):
        self.assertEqual(self.get('/api/expenses/?date_from=bad').status_code, 400)

    def test_sales_reversed_dates_rejected(self):
        self.assertEqual(self.get('/api/sales/?date_from=2026-11-10&date_to=2026-11-01').status_code, 400)

    def test_expense_export_malformed_date_rejected(self):
        self.assertEqual(self.get('/api/expenses/export/csv/?date_to=bad').status_code, 400)

    def test_csv_expense_text_neutralizes_formulas(self):
        Expense.objects.create(amount='1', date='2026-11-09', description='=1+1')
        row = list(csv.reader(io.StringIO(self.get('/api/expenses/export/csv/').content.decode())))[1]
        self.assertFalse(row[3].startswith('='), 'CSV quoting leaves executable spreadsheet formula text.')

    def test_csv_sales_text_neutralizes_formulas(self):
        self.assertEqual(self.sale().status_code, 201)
        rows = list(csv.reader(io.StringIO(self.get('/api/sales/export/csv/').content.decode())))
        self.assertFalse(any(cell.startswith('=') for cell in rows[1]), 'Sale notes remain a spreadsheet formula.')

    def test_dashboard_month_to_date_expenses_exclude_future(self):
        Expense.objects.create(amount='25', date='2026-11-25')
        with patch('dashboard.views.timezone.localdate', return_value=date(2026, 11, 10)):
            response = self.get('/api/dashboard/')
        self.assertEqual(response.data['data']['this_month']['expenses'], 0, 'Sales use month-to-date but expenses include future dates.')

    def test_control_cross_year_months_remain_distinct(self):
        Expense.objects.create(amount='11', date='2025-01-01')
        Expense.objects.create(amount='22', date='2026-01-01')
        rows = self.get('/api/dashboard/?date_from=2025-01-01&date_to=2026-01-31').data['data']['chart_data']
        chart = {row['month']: row['expenses'] for row in rows}
        self.assertEqual((chart['2025-01'], chart['2026-01']), (11, 22))

    def test_control_cross_year_sales_remain_distinct(self):
        for day in ['2025-01-01', '2026-01-01']:
            self.assertEqual(self.sale(date=day).status_code, 201)
        rows = self.get('/api/dashboard/?date_from=2025-01-01&date_to=2026-01-31').data['data']['chart_data']
        chart = {row['month']: row['sales'] for row in rows}
        self.assertEqual((chart['2025-01'], chart['2026-01']), (50, 50))

    def test_control_legacy_zero_stored_subtotal_is_preserved_but_projected_correctly(self):
        # Synthetic equivalent of accepted old migration 0002's zero default;
        # deliberately bulk-create to preserve that historical stored value.
        sale = Sale.objects.create(date='2025-01-01', total_amount='100')
        SaleItem.objects.bulk_create([SaleItem(sale=sale, product=self.product, quantity=2, unit_price='50', subtotal_amount='0')])
        data = self.get(f'/api/sales/{sale.pk}/').data['data']
        self.assertEqual(Decimal(data['sale_items'][0]['subtotal_amount']), Decimal('100'))
        self.assertEqual(SaleItem.objects.get(sale=sale).subtotal_amount, Decimal('0'))
        self.assertEqual(SaleFinancialEntry.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_control_api_rejects_negative_cost_without_writes(self):
        before = Decimal(self.ingredient.cost_per_unit)
        response = self.client.patch(f'/api/ingredients/{self.ingredient.pk}/', {'cost_per_unit': '-1'}, format='json', secure=True)
        self.assertEqual(response.status_code, 400)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.cost_per_unit, before)

    def test_control_ingredient_protected_delete_returns_conflict(self):
        self.assertEqual(self.client.delete(f'/api/ingredients/{self.ingredient.pk}/', secure=True).status_code, 409)
        self.assertTrue(Ingredient.objects.filter(pk=self.ingredient.pk).exists())

    def test_control_unavailable_public_product_hidden(self):
        self.product.is_available = False
        self.product.save(update_fields=['is_available'])
        self.assertEqual(cookie_client().get('/api/products/', secure=True).data['data']['count'], 0)

    def test_control_pagination_exposes_all_records_on_page_two(self):
        for i in range(24):
            Product.objects.create(name=f'Product {i:02d}', price='50', category=self.category)
        first, second = self.get('/api/products/').data['data'], self.get('/api/products/?page=2').data['data']
        self.assertEqual((first['count'], len(first['results']), len(second['results'])), (25, 20, 5))
        self.assertEqual(len({row['id'] for row in first['results'] + second['results']}), 25)

    def test_control_cancel_exact_inventory_and_signed_finance(self):
        created = self.sale()
        self.assertEqual(created.status_code, 201)
        sale = created.data['data']
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity, Decimal('19.996666667'))
        cancelled = self.client.delete(f'/api/sales/{sale["id"]}/', {'reason': 'Synthetic audit'}, format='json',
            secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH=str(sale['revision']))
        self.assertEqual(cancelled.status_code, 200)
        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.quantity, Decimal('20'))
        self.assertEqual(sum(SaleFinancialEntry.objects.values_list('amount', flat=True)), Decimal('0'))
        self.assertEqual(StockMovement.objects.count(), 2)

    def test_control_staff_denied_zero_ledger_writes(self):
        self.owner.role = 'staff'
        self.owner.save(update_fields=['role'])
        _, tokens = bind_fixture(self.owner)
        staff = cookie_client(tokens)
        before = [model.objects.count() for model in [InventoryOperation, SaleConsumption, StockMovement, SaleFinancialEntry]]
        response = staff.post('/api/expenses/', {'date': '2026-11-09', 'amount': '1'}, format='json', secure=True)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(before, [model.objects.count() for model in [InventoryOperation, SaleConsumption, StockMovement, SaleFinancialEntry]])
        self.assertEqual(Expense.objects.count(), 0)

    def test_control_expense_crud_csv_pdf(self):
        made = self.client.post('/api/expenses/', {'date': '2026-11-09', 'amount': '12.34', 'description': 'Synthetic'}, format='json', secure=True)
        self.assertEqual(made.status_code, 201)
        pk = made.data['data']['id']
        self.assertEqual(self.client.patch(f'/api/expenses/{pk}/', {'amount': '20.50'}, format='json', secure=True).status_code, 200)
        self.assertIn(b'20.50', self.get('/api/expenses/export/csv/').content)
        pdf = self.get('/api/expenses/export/pdf/')
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        self.assertEqual(self.client.delete(f'/api/expenses/{pk}/', secure=True).status_code, 200)

    def test_control_recipe_update_and_delete(self):
        response = self.client.patch(f'/api/recipes/{self.recipe.pk}/', {'yield_quantity': 4}, format='json', secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['yield_quantity'], 4)
        self.assertEqual(self.client.delete(f'/api/recipes/{self.recipe.pk}/', secure=True).status_code, 200)

    def test_control_dashboard_bad_dates_rejected(self):
        self.assertEqual(self.get('/api/dashboard/?date_from=bad').status_code, 400)

    def test_control_sales_pdf_generation(self):
        self.assertEqual(self.sale().status_code, 201)
        response = self.get('/api/sales/export/pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'%PDF'))
