"""Seed the owned verification target with transactions for real API screenshots."""
from datetime import date
from decimal import Decimal
import os
from pathlib import Path
from uuid import uuid4

import django

django.setup()

from django.conf import settings
from django.core.management import call_command
from django.utils import timezone
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from session_api_contracts import bind_fixture, cookie_client


def create_sale(client, day, product, quantity, notes=''):
    response = client.post(
        '/api/sales/', {'date': day.isoformat(), 'notes': notes, 'sale_items': [
            {'product': product.pk, 'quantity': quantity, 'unit_price': str(product.price)},
        ]},
        format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    if response.status_code != 201:
        raise RuntimeError(f'Sale fixture failed with status {response.status_code}: {response.data}')


Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate', interactive=False, verbosity=0)
password = os.environ['ROWSZEIN_BROWSER_PASSWORD']
owner = User.objects.create_user(username='rowszein', role='admin', password=password)
staff = User.objects.create_user(username='counter-staff', role='staff', password=password)
owner_client = cookie_client(bind_fixture(owner)[1])
staff_client = cookie_client(bind_fixture(staff)[1])
category = Category.objects.create(name='Donuts', slug='verification-donuts')
flour = Ingredient.objects.create(name='Bread flour', unit='kg', quantity='10', cost_per_unit='80', minimum_stock='2')
Ingredient.objects.create(name='Dark chocolate', unit='kg', quantity='1.250000001', cost_per_unit='360', minimum_stock='2')
Ingredient.objects.create(name='Vanilla bean paste', unit='g', quantity='42.500000000', cost_per_unit='4', minimum_stock='60')
products = []
for name, price in [
    ('Classic glazed donut', '58.00'), ('Strawberry cloud', '85.00'),
    ('Dark chocolate crunch', '94.00'), ('Caramel custard', '89.00'),
    ('Brown butter maple with toasted pecans and cinnamon sugar', '105.00'),
]:
    product = Product.objects.create(name=name, price=Decimal(price), category=category)
    recipe = Recipe.objects.create(product=product, yield_quantity=12)
    RecipeIngredient.objects.create(recipe=recipe, ingredient=flour, quantity='.04')
    products.append(product)

for month, count in enumerate((29, 35, 46, 39, 54, 47, 62, 50, 75, 68, 54), start=1):
    for index, product in enumerate(products):
        create_sale(owner_client, date(2026, month, 2 + index), product, count - index * 6, 'Owner fixture')
    Expense.objects.create(date=date(2026, month, 3), amount=Decimal(count * 135), category='ingredient',
                           description='Baking supplies')
Expense.objects.create(date=date(2026, 2, 27), amount='94000.50', category='utilities',
                       description='Negative balance test period')
Expense.objects.create(date=date(2025, 7, 3), amount='99999999.99', category='utilities',
                       description='Large-value layout test period')
create_sale(staff_client, timezone.localdate(), products[0], 2, 'Staff fixture')
create_sale(owner_client, timezone.localdate(), products[1], 1, 'Owner-only same-day fixture')
call_command('runserver', '127.0.0.1:18842', use_reloader=False, verbosity=0)
