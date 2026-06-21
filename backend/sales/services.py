from ingredients.models import Ingredient
from recipes.models import Recipe


def deduct_inventory_for_sale(sale):
    for sale_item in sale.sale_items.select_related('product').all():
        try:
            recipe = Recipe.objects.prefetch_related(
                'recipe_ingredients__ingredient'
            ).get(product=sale_item.product)
        except Recipe.DoesNotExist:
            continue

        yield_qty = recipe.yield_quantity or 1

        for recipe_ingredient in recipe.recipe_ingredients.all():
            ingredient = recipe_ingredient.ingredient
            amount_per_unit = recipe_ingredient.quantity / yield_qty
            amount_to_deduct = amount_per_unit * sale_item.quantity

            ingredient.quantity = max(0, ingredient.quantity - amount_to_deduct)
            ingredient.save()


def restore_inventory_for_sale(sale):
    for sale_item in sale.sale_items.select_related('product').all():
        try:
            recipe = Recipe.objects.prefetch_related(
                'recipe_ingredients__ingredient'
            ).get(product=sale_item.product)
        except Recipe.DoesNotExist:
            continue

        yield_qty = recipe.yield_quantity or 1

        for recipe_ingredient in recipe.recipe_ingredients.all():
            ingredient = recipe_ingredient.ingredient
            amount_per_unit = recipe_ingredient.quantity / yield_qty
            amount_to_restore = amount_per_unit * sale_item.quantity

            ingredient.quantity = ingredient.quantity + amount_to_restore
            ingredient.save()