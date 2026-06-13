from django.db import models


class Expense(models.Model):
    class Category(models.TextChoices):
        INGREDIENT = 'ingredient', 'Ingredient Purchase'
        PACKAGING = 'packaging', 'Packaging'
        UTILITIES = 'utilities', 'Utilities'
        TRANSPORTATION = 'transportation', 'Transportation'
        OTHER = 'other', 'Other'

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, default='')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.category} - ₱{self.amount} ({self.date})"