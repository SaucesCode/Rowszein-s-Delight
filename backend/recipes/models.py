from django.db import models
from products.models import Product
from ingredients.models import Ingredient


class Recipe(models.Model):
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name='recipe',
    )
    yield_quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Recipe for {self.product.name}"

    @property
    def production_cost(self):
        """Total ingredient cost for one full batch (yield_quantity units)."""
        total = sum(
            item.quantity * item.ingredient.cost_per_unit
            for item in self.recipe_ingredients.all()
        )
        return round(total, 2)

    @property
    def cost_per_unit(self):
        """Ingredient cost to produce a single unit of the product."""
        if not self.yield_quantity:
            return self.production_cost
        return round(self.production_cost / self.yield_quantity, 2)


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name='recipe_ingredients',
    )
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.PROTECT,
        related_name='recipe_ingredients',
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ['recipe', 'ingredient']

    def __str__(self):
        return f"{self.ingredient.name} x{self.quantity} in {self.recipe}"