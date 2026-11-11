"""Seed only the owned browser database and serve it on loopback."""
import os
from pathlib import Path

import django

django.setup()

from django.conf import settings
from django.core.management import call_command
from accounts.models import User
from expenses.models import Expense
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale

Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate', interactive=False, verbosity=0)
for role in ('admin', 'staff'):
    User.objects.create_user(username=f'dates-{role}', role=role, password=os.environ['ROWSZEIN_BROWSER_PASSWORD'])
category = Category.objects.create(name='Browser date fixtures', slug='browser-date-fixtures')
product = Product.objects.create(name='Date test cake', category=category, price='12.00')
ingredient = Ingredient.objects.create(name='Date test flour', unit='kg', quantity='10', cost_per_unit='1')
recipe = Recipe.objects.create(product=product, yield_quantity=3)
RecipeIngredient.objects.create(recipe=recipe, ingredient=ingredient, quantity='.01')
for day in ('2023-12-31', '2024-01-01', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-10', '2024-03-11'):
    Sale.objects.create(date=day, total_amount='10.00', notes=f'Sale {day}')
    Expense.objects.create(date=day, amount='2.00', description=f'Expense {day}')
call_command('runserver', '127.0.0.1:18842', use_reloader=False, verbosity=0)
