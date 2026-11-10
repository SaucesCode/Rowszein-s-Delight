"""Temporary localhost-only fixture server; database disappears on exit."""
import os
from pathlib import Path
import sys
sys.dont_write_bytecode = True

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ["DJANGO_SETTINGS_MODULE"] = "audit_settings"
import django
django.setup()
from django.core.management import call_command
from django.conf import settings
from accounts.models import User
from ingredients.models import Ingredient
from products.models import Category, Product
from recipes.models import Recipe, RecipeIngredient

if __name__ == "__main__":
    if not os.environ.get("AUDIT_PASSWORD"):
        raise SystemExit("Requires a random per-run AUDIT_PASSWORD from the local test runner.")
    settings.DATABASES["default"]["NAME"] = "file:phase0-browser-audit?mode=memory&cache=shared"
    settings.DATABASES["default"]["OPTIONS"] = {"uri": True}
    call_command("migrate", verbosity=0)
    User.objects.create_user(username="local-audit", password=os.environ["AUDIT_PASSWORD"], role="admin")
    category = Category.objects.first()
    for i in range(25):
        ingredient = Ingredient.objects.create(name=f"Audit ingredient {i + 1:02}", quantity=10, unit="kg", cost_per_unit=60, minimum_stock=2)
        product = Product.objects.create(name=f"Audit donut {i + 1:02}", price=50, category=category, is_featured=i == 24)
        recipe = Recipe.objects.create(product=product, yield_quantity=12)
        RecipeIngredient.objects.create(recipe=recipe, ingredient=ingredient, quantity=1)
    call_command("runserver", "127.0.0.1:18732", use_reloader=False, verbosity=0)

