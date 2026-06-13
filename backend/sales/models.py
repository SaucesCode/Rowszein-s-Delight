from django.db import models
from products.models import Product


class Sale(models.Model):
    date = models.DateField()
    notes = models.TextField(blank=True, default='')
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"Sale #{self.id} - ₱{self.total_amount} ({self.date})"

    def compute_total(self):
        total = sum(
            item.quantity * item.unit_price
            for item in self.sale_items.all()
        )
        self.total_amount = total
        self.save()


class SaleItem(models.Model):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name='sale_items',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='sale_items',
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ['sale', 'product']

    def __str__(self):
        return f"{self.product.name} x{self.quantity} @ ₱{self.unit_price}"

    @property
    def subtotal(self):
        return self.quantity * self.unit_price