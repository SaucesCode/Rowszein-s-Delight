"""Add synthetic records to the disposable schema copy only."""
import json
import os
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import django

django.setup()

from django.conf import settings
from django.core.management import call_command
from django.db import connection
from django.utils import timezone
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale
from session_api_contracts import bind_fixture, cookie_client


def create_sale(client, date, product, quantity, notes):
    response = client.post(
        '/api/sales/', {'date': date.isoformat(), 'notes': notes, 'sale_items': [
            {'product': product.pk, 'quantity': quantity, 'unit_price': str(product.price)},
        ]}, format='json', secure=True, HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 201, response.data
    return response.data['data']['id']


marker = Path(os.environ['ROWSZEIN_VERIFY_MARKER'])
target = json.loads(marker.read_text())
assert target['pink_schema_copy'] and connection.settings_dict['NAME'] == target['name']
assert not any(model.objects.exists() for model in (User, Category, Product, Ingredient, Recipe, Sale, Expense))
with connection.cursor() as cursor:
    cursor.execute('SELECT count(*) FROM django_migrations')
    assert cursor.fetchone() == (35,)
Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
password = os.environ['ROWSZEIN_BROWSER_PASSWORD']
owner = User.objects.create_superuser(username='pink-owner', role='admin', password=password)
staff = User.objects.create_user(username='pink-staff', role='staff', password=password)
owner_client = cookie_client(bind_fixture(owner)[1])
staff_client = cookie_client(bind_fixture(staff)[1])
category = Category.objects.create(name='Glazed Donuts', slug='pink-fixture-glazed')
flour = Ingredient.objects.create(name='Bread flour', unit='kg', quantity='18', cost_per_unit='80', minimum_stock='2')
chocolate = Ingredient.objects.create(name='Dark chocolate', unit='kg', quantity='1.250000001', cost_per_unit='360',
                                      minimum_stock='2', supplier='OWNER-SUPPLIER-FIXTURE')
Ingredient.objects.create(name='Vanilla bean paste', unit='g', quantity='42.5', cost_per_unit='4', minimum_stock='60')
catalog = []
for index, name in enumerate(['Strawberry Cloud', 'Classic Glazed', 'Berry Sprinkle', 'Vanilla Dream', 'Caramel Swirl']
                             + [f'Menu Donut {i:02d}' for i in range(6, 26)]):
    product = Product.objects.create(name=name, price=Decimal(58 + index * 3), category=category,
                                     is_featured=(index == 0), is_available=True)
    catalog.append(product)
    if index < 5:
        recipe = Recipe.objects.create(product=product, yield_quantity=12)
        RecipeIngredient.objects.create(recipe=recipe, ingredient=flour, quantity='.04')
Product.objects.create(name='Hidden Owner Donut', price=63, category=category, is_available=False)
today = timezone.localdate()
month = today.replace(day=1)
for index in range(1, 6):
    month = (month - timedelta(days=1)).replace(day=1)
    for product in catalog[:5]:
        create_sale(owner_client, month, product, 12 + index * 8, 'Historical fixture')
    Expense.objects.create(date=month, amount=Decimal(510 * index), category='ingredient', description='Baking supplies')
sale = create_sale(owner_client, today, catalog[0], 3, 'OWNER SALE FIXTURE')
create_sale(staff_client, today, catalog[1], 2, 'STAFF SALE FIXTURE')
expense = Expense.objects.create(date=today, amount='39.50', category='packaging', description='Donut boxes')
fixtures = dict(product=catalog[0].pk, recipe=catalog[0].recipe.pk, ingredient=chocolate.pk, sale=sale,
                expense=expense.pk, category=category.pk, today=today.isoformat())
(marker.parent / 'fixtures.json').write_text(json.dumps(fixtures), encoding='utf-8')
call_command('runserver', '127.0.0.1:18842', use_reloader=False, verbosity=0)
