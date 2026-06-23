from django.db import models


class Product(models.Model):
    CATEGORY_CHOICES = [
        ("classic", "Classic"),
        ("fruity", "Fruity"),
        ("local", "Local Favorites"),
        ("premium", "Premium"),
        ("brownies", "Brownies & Bars"),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    # Marks this product as a "bestseller" shown in the featured row
    # on the public landing page. Set via the Owner Panel edit form.
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default="classic"
    )
    
    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name