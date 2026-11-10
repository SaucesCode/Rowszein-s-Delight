"""Synthetic pagination boundary fixtures, never reusable demo/production data."""
import os
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from pathlib import Path
from accounts.models import User
from products.models import Category, Product
from ingredients.models import Ingredient
from recipes.models import Recipe, RecipeIngredient
Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate', interactive=False, verbosity=0)
for role in ['admin', 'staff']:
    User.objects.create_user(username='audit-'+role, password=os.environ['ROWSZEIN_BROWSER_PASSWORD'], role=role)
for i in range(1, 26):
    category = Category.objects.create(name=f'Audit category {i:02d}', slug=f'audit-{i}')
    ingredient = Ingredient.objects.create(name=f'Audit ingredient {i:02d}', quantity='19.996666668', unit='kg', cost_per_unit='1', supplier='SYNTHETIC-PRIVATE', notes='SYNTHETIC-TO-CLEAR' if i==2 else '')
    product = Product.objects.create(name=f'Audit product {i:02d}', category=category, price='50', is_featured=i==25)
    recipe = Recipe.objects.create(product=product, yield_quantity=3)
    RecipeIngredient.objects.create(recipe=recipe, ingredient=ingredient, quantity='.01')
call_command('runserver', '127.0.0.1:18842', use_reloader=False, verbosity=0)
