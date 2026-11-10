"""Only the approval/ownership-gated disposable profile can start this server."""
import os
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from accounts.models import User
from products.models import Category,Product
from ingredients.models import Ingredient
from recipes.models import Recipe,RecipeIngredient
from pathlib import Path
Path(settings.STATIC_ROOT).mkdir(exist_ok=True)
call_command('migrate',interactive=False,verbosity=0)
for name,role in [('owner','admin'),('staff','staff')]:
    User.objects.create_user(username='disposable-browser-'+name,password=os.environ['ROWSZEIN_BROWSER_PASSWORD'],role=role,
        is_staff=role=='admin',is_superuser=role=='admin')
category=Category.objects.create(name='Controlled browser fixture',slug='controlled-browser')
product=Product.objects.create(name='Verification donut',price='50',category=category)
recipe=Recipe.objects.create(product=product,yield_quantity=3)
for name,unit,quantity in [('flour','kg','20'),('milk','l','10')]:
    ingredient=Ingredient.objects.create(name='Verification '+name,unit=unit,quantity=quantity,cost_per_unit='1',supplier='PRIVATE-SUPPLIER')
    RecipeIngredient.objects.create(recipe=recipe,ingredient=ingredient,quantity='.01')
call_command('runserver','127.0.0.1:18842',use_reloader=False,verbosity=0)
