from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Category(models.Model):
    slug = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='products',
    )
    is_available = models.BooleanField(default=True)
    # Marks this product as a "bestseller" shown in the featured row
    # on the public landing page. Set via the Owner Panel edit form.
    is_featured = models.BooleanField(default=False)
    # Added to a box's price for each of these donuts inside it (premium flavours).
    box_extra = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.CheckConstraint(condition=models.Q(box_extra__gte=0), name='product_box_extra_not_negative'),
        ]

    def __str__(self):
        return self.name


class BoxSize(models.Model):
    """A box the shop sells, e.g. a box of 12, at one fixed price."""
    size = models.PositiveSmallIntegerField(unique=True, validators=[MinValueValidator(2), MaxValueValidator(48)])
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['size']
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name='box_size_price_positive'),
            models.CheckConstraint(condition=models.Q(size__gte=2, size__lte=48), name='box_size_range'),
        ]

    def __str__(self):
        return f'Box of {self.size}'


class Assortment(models.Model):
    """A ready-made box put together by the owner, e.g. "Classic dozen"."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    box_size = models.ForeignKey(BoxSize, on_delete=models.PROTECT, related_name='assortments')
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class AssortmentItem(models.Model):
    assortment = models.ForeignKey(Assortment, on_delete=models.CASCADE, related_name='items')
    # Deleting a donut removes it here; the box is then short and is hidden from the shop until fixed.
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='assortment_items')
    quantity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(fields=['assortment', 'product'], name='assortment_item_unique_product'),
            models.CheckConstraint(condition=models.Q(quantity__gte=1), name='assortment_item_quantity_positive'),
        ]

    def __str__(self):
        return f'{self.quantity} x {self.product.name}'
