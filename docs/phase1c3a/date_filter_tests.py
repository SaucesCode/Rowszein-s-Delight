"""Date filters exercised through real cookie auth on each owned database."""
import csv
from datetime import date, datetime
from io import StringIO
import re
from unittest.mock import patch
from uuid import uuid4

from django.test import TransactionTestCase
from django.utils import timezone

from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale
from pdf_evidence import pdf_text
from session_api_contracts import BUSINESS_MODELS, bind_fixture, cookie_client


SALES = '/api/sales/'
EXPENSES = '/api/expenses/'
DASHBOARD = '/api/dashboard/'
SUMMARY = SALES + 'financial-summary/'
FILTER_ENDPOINTS = [SALES, EXPENSES, DASHBOARD, SUMMARY, *(f'{base}export/{kind}/' for base in (SALES, EXPENSES) for kind in ('csv', 'pdf'))]


class DateFilterTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='date-owner', role='admin', password='synthetic-test')
        self.staff = User.objects.create_user(username='date-staff', role='staff', password='synthetic-test')
        category = Category.objects.create(name='Date fixtures', slug='date-fixtures')
        self.product = Product.objects.create(name='Date fixture', category=category, price='10.00')
        ingredient = Ingredient.objects.create(name='Date flour', unit='kg', quantity='10', cost_per_unit='1')
        recipe = Recipe.objects.create(product=self.product, yield_quantity=3)
        RecipeIngredient.objects.create(recipe=recipe, ingredient=ingredient, quantity='.01')
        self.client = cookie_client(bind_fixture(self.owner)[1])

    def get(self, endpoint, query=None):
        return self.client.get(endpoint, query, secure=True)

    def test_invalid_filters_fail_closed(self):
        cases = [
            ('date_from=bad', 'date_from'),
            ('date_to=2025-02-29', 'date_to'),
            ('date_to=0000-01-01', 'date_to'),
            ('date_from=2024-2-09', 'date_from'),
            ('date_to=2024-02-09T00%3A00%3A00Z', 'date_to'),
            ('date_to=2024-02-09%0A', 'date_to'),
            ('date_from=', 'date_from'),
            ('date_from=2024-02-29&date_from=2024-03-01', 'date_from'),
            ('date_from=2024-03-01&date_to=2024-02-29', 'date_to'),
        ]
        for endpoint in FILTER_ENDPOINTS:
            for query, field in cases:
                with self.subTest(endpoint=endpoint, query=query):
                    response = self.get(f'{endpoint}?{query}')
                    self.assertEqual(response.status_code, 400)
                    self.assertFalse(response.has_header('Content-Disposition'))
                    self.assertFalse(response.data['success'])
                    self.assertIn(field, response.data['error'])

    def test_open_history_filters_and_default_reporting_bounds(self):
        for day in ('2024-12-31', '2025-01-01', '2025-01-02', '2025-01-03'):
            Sale.objects.create(date=day, total_amount='10.00')
            Expense.objects.create(date=day, amount='2.00')
        for endpoint in (SALES, EXPENSES):
            for query, dates in [
                ({}, ['2025-01-03', '2025-01-02', '2025-01-01', '2024-12-31']),
                ({'date_from': '2025-01-02'}, ['2025-01-03', '2025-01-02']),
                ({'date_to': '2025-01-01'}, ['2025-01-01', '2024-12-31']),
                ({'date_from': '2025-01-01', 'date_to': '2025-01-02'}, ['2025-01-02', '2025-01-01']),
            ]:
                with self.subTest(endpoint=endpoint, query=query):
                    response = self.get(endpoint, query)
                    self.assertEqual([row['date'] for row in response.data['data']['results']], dates)
        with patch('django.utils.timezone.localdate', return_value=date(2025, 1, 2)):
            for endpoint in (DASHBOARD, SUMMARY):
                for query, total in [
                    ({}, '20.00'),
                    ({'date_from': '2024-12-31'}, '30.00'),
                    ({'date_to': '2025-01-01'}, '10.00'),
                ]:
                    with self.subTest(endpoint=endpoint, query=query):
                        response = self.get(endpoint, query)
                        self.assertEqual(response.data['data']['totals']['net_sales'], total)
                for query in ({'date_to': '2024-12-31'}, {'date_from': '2025-01-03'}):
                    self.assertEqual(self.get(endpoint, query).status_code, 400)

    def test_leap_day_exports_and_signed_posting_scope(self):
        def sale(day, price, notes):
            response = self.client.post(SALES, {
                'date': day, 'notes': notes, 'sale_items': [
                    {'product': self.product.pk, 'quantity': 1, 'unit_price': price},
                ],
            }, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()))
            self.assertEqual(response.status_code, 201, response.data)
            return response.data['data']

        sale('2024-02-28', '10.00', 'BEFORE-SALE')
        original = sale('2024-02-29', '25.00', 'LEAP-SALE')
        sale('2024-03-01', '7.00', 'AFTER-SALE')
        Sale.objects.create(date='2024-02-29', total_amount='4.00', notes='LEGACY-SALE')
        with patch('django.utils.timezone.localdate', return_value=date(2024, 3, 1)):
            response = self.client.delete(
                SALES + f'{original["id"]}/', {'reason': 'Synthetic date boundary cancellation'},
                format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()),
                HTTP_IF_MATCH=f'"{original["revision"]}"',
            )
        self.assertEqual(response.status_code, 200, response.data)
        for day, amount, label in [
            ('2024-02-28', '2.00', 'BEFORE-EXPENSE'),
            ('2024-02-29', '3.50', 'LEAP-EXPENSE'),
            ('2024-03-01', '4.00', 'AFTER-EXPENSE'),
        ]:
            Expense.objects.create(date=day, amount=amount, description=label)

        def state():
            return [list(model.objects.order_by('pk').values()) for model in BUSINESS_MODELS]

        before = state()
        leap = {'date_from': '2024-02-29', 'date_to': '2024-02-29'}
        march = {'date_from': '2024-03-01', 'date_to': '2024-03-01'}
        for query, gross, cancellation, net in [
            (leap, '29.00', '0.00', '29.00'),
            (march, '7.00', '-25.00', '-18.00'),
            ({'date_from': leap['date_from'], 'date_to': march['date_to']}, '36.00', '-25.00', '11.00'),
        ]:
            for endpoint in (DASHBOARD, SUMMARY):
                response = self.get(endpoint, query)
                totals = response.data['data']['totals']
                self.assertEqual([totals[key] for key in ('gross_sales', 'signed_cancellations', 'net_sales')], [gross, cancellation, net])
        for base, included, excluded, csv_date_col, total in [
            (SALES, ['LEAP-SALE', 'LEGACY-SALE'], ['BEFORE-SALE', 'AFTER-SALE'], 1, b'29.00'),
            (EXPENSES, ['LEAP-EXPENSE'], ['BEFORE-EXPENSE', 'AFTER-EXPENSE'], 1, b'3.50'),
        ]:
            csv_response = self.get(f'{base}export/csv/', leap)
            self.assertEqual(csv_response.status_code, 200)
            rows = list(csv.reader(StringIO(csv_response.content.decode())))[1:]
            self.assertEqual([row[csv_date_col] for row in rows], ['2024-02-29'] * len(included))
            pdf_response = self.get(f'{base}export/pdf/', leap)
            self.assertEqual(pdf_response.status_code, 200)
            self.assertTrue(pdf_response.content.startswith(b'%PDF'))
            pdf = pdf_text(pdf_response.content)
            self.assertIn(b'2024-02-29', pdf)
            self.assertNotIn(b'2024-03-01', pdf)
            self.assertIn(total, pdf)
            for content in (csv_response.content, pdf):
                for label in included:
                    self.assertIn(label.encode(), content)
                for label in excluded:
                    self.assertNotIn(label.encode(), content)
        self.assertEqual(state(), before)

    def test_exports_keep_omitted_boundaries_open(self):
        for day in ('2024-12-31', '2025-01-01', '2025-01-02'):
            Sale.objects.create(date=day, total_amount='10.00')
            Expense.objects.create(date=day, amount='2.00')
        for base in (SALES, EXPENSES):
            for query, dates in [
                ({}, ['2025-01-02', '2025-01-01', '2024-12-31']),
                ({'date_from': '2025-01-01'}, ['2025-01-02', '2025-01-01']),
                ({'date_to': '2025-01-01'}, ['2025-01-01', '2024-12-31']),
            ]:
                with self.subTest(base=base, query=query):
                    response = self.get(f'{base}export/csv/', query)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual([row[1] for row in list(csv.reader(StringIO(response.content.decode())))[1:]], dates)
                    response = self.get(f'{base}export/pdf/', query)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(re.findall(rb'\((\d{4}-\d{2}-\d{2})\) Tj', pdf_text(response.content)),
                                     [day.encode() for day in dates])

    def test_permission_checks_precede_validation(self):
        staff = cookie_client(bind_fixture(self.staff)[1])
        for endpoint in FILTER_ENDPOINTS:
            response = staff.get(f'{endpoint}?date_from=bad', secure=True)
            self.assertEqual(response.status_code, 400 if endpoint == SALES else 403)

    def test_reporting_defaults_follow_manila_midnight_even_with_other_active_zone(self):
        for instant, start, end in [
            ('2024-12-31T15:59:00+00:00', '2024-01-01', '2024-12-31'),
            ('2024-12-31T16:00:00+00:00', '2025-01-01', '2025-01-01'),
            ('2024-02-29T15:59:00+00:00', '2024-01-01', '2024-02-29'),
            ('2024-02-29T16:00:00+00:00', '2024-01-01', '2024-03-01'),
        ]:
            with self.subTest(instant=instant), timezone.override('America/New_York'), patch(
                'django.utils.timezone.now', return_value=datetime.fromisoformat(instant)
            ):
                response = self.get(DASHBOARD)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data['data']['filters'], {'date_from': start, 'date_to': end})
