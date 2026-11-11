"""Boundary fixtures only; destroyed with the guarded disposable database."""
import os
from pathlib import Path
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category,Product
from recipes.models import Recipe,RecipeIngredient

Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate',interactive=False,verbosity=0)
Category.objects.all().delete()  # Fresh owned database: use exact boundary counts.
for name,role in [('owner','admin'),('staff','staff'),('other-owner','admin')]:
    User.objects.create_user(username='cache-'+name,password=os.environ['ROWSZEIN_BROWSER_PASSWORD'],role=role)

for i in range(1,int(os.environ.get('ROWSZEIN_FIXTURE_COUNT','25'))+1):
    category=Category.objects.create(name=f'Cache category {i:02d}',slug=f'cache-{i}')
    # ID 2 must actually be selectable from page 2 in normal UI navigation.
    name=('Z ' if i==2 else '')+f'Cache ingredient {i:02d}'
    ingredient=Ingredient.objects.create(name=name,quantity='20',unit='kg',cost_per_unit='1',supplier=f'PRIVATE-SUPPLIER-{i:02d}')
    product=Product.objects.create(name=f'Cache product {i:02d}',price='50',category=category,is_featured=i==int(os.environ.get('ROWSZEIN_FIXTURE_COUNT','25')))
    recipe=Recipe.objects.create(product=product,yield_quantity=3)
    RecipeIngredient.objects.create(recipe=recipe,ingredient=ingredient,quantity='.01')
call_command('runserver','127.0.0.1:18842',use_reloader=False,verbosity=0)
