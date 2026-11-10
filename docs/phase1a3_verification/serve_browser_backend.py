"""Fresh owned DB and minimal browser fixtures, not a demo-data generator."""
from decimal import Decimal
import os
from pathlib import Path
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient

Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate', interactive=False, verbosity=0)
User.objects.create_user(username='disposable-browser-owner', password=os.environ['ROWSZEIN_BROWSER_PASSWORD'], role='admin')
category = Category.objects.create(name='Browser verification', slug='browser-verification')
product = Product.objects.create(name='Browser verification donut', category=category, price=Decimal('50'))
flour = Ingredient.objects.create(name='Browser verification flour', quantity=Decimal('20'), unit='kg', cost_per_unit=Decimal('1'))
milk = Ingredient.objects.create(name='Browser verification milk', quantity=Decimal('10'), unit='l', cost_per_unit=Decimal('1'))
recipe = Recipe.objects.create(product=product, yield_quantity=3)
RecipeIngredient.objects.create(recipe=recipe, ingredient=flour, quantity=Decimal('.01'))
RecipeIngredient.objects.create(recipe=recipe, ingredient=milk, quantity=Decimal('.01'))
call_command('runserver', '127.0.0.1:18842', use_reloader=False, verbosity=0)
