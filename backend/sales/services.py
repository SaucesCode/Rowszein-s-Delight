from ingredients.models import Ingredient
from recipes.models import Recipe


def deduct_inventory_for_sale(sale):
    """
    For each item in a sale, find its recipe and deduct
    the required ingredient quantities from stock.
    """
    for sale_item in sale.sale_items.select_related('product').all():
        try:
            recipe = Recipe.objects.prefetch_related(
                'recipe_ingredients__ingredient'
            ).get(product=sale_item.product)
        except Recipe.DoesNotExist:
            # Product has no recipe — skip deduction
            continue

        for recipe_ingredient in recipe.recipe_ingredients.all():
            ingredient = recipe_ingredient.ingredient
            amount_to_deduct = recipe_ingredient.quantity * sale_item.quantity

            ingredient.quantity = max(
                0,
                ingredient.quantity - amount_to_deduct
            )
            ingredient.save()


def restore_inventory_for_sale(sale):
    """
    Reverse a previous deduction — used before updating a sale
    so we can re-deduct fresh amounts.
    """
    for sale_item in sale.sale_items.select_related('product').all():
        try:
            recipe = Recipe.objects.prefetch_related(
                'recipe_ingredients__ingredient'
            ).get(product=sale_item.product)
        except Recipe.DoesNotExist:
            continue

        for recipe_ingredient in recipe.recipe_ingredients.all():
            ingredient = recipe_ingredient.ingredient
            amount_to_restore = recipe_ingredient.quantity * sale_item.quantity

            ingredient.quantity = ingredient.quantity + amount_to_restore
            ingredient.save()