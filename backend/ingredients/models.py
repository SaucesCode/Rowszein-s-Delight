from django.db import models


class Ingredient(models.Model):
    class Unit(models.TextChoices):
        KG = 'kg', 'Kilogram'
        G = 'g', 'Gram'
        ML = 'ml', 'Milliliter'
        L = 'l', 'Liter'
        PCS = 'pcs', 'Pieces'
        TBSP = 'tbsp', 'Tablespoon'
        TSP = 'tsp', 'Teaspoon'
        CUP = 'cup', 'Cup'

    class Category(models.TextChoices):
        FLOUR_GRAINS = 'flour_grains', 'Flour & Grains'
        DAIRY = 'dairy', 'Dairy'
        SWEETENERS = 'sweeteners', 'Sweeteners'
        FLAVORINGS = 'flavorings', 'Flavorings & Extracts'
        PACKAGING = 'packaging', 'Packaging'
        OTHER = 'other', 'Other'

    name = models.CharField(max_length=100, unique=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=10, choices=Unit.choices)
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    supplier = models.CharField(max_length=100, blank=True, default='')
    minimum_stock = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    notes = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='ingredients/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.unit})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.minimum_stock