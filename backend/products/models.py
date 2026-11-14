from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


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


class Partner(models.Model):
    """A collab partner whose food Rowszein sells for them at their price plus a patong."""
    name = models.CharField(max_length=100, unique=True)
    blurb = models.CharField(max_length=160, blank=True, default='')
    contact = models.CharField(max_length=200, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

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
    # A partner's item: Rowszein pays the partner `partner_payout` ("their price")
    # for each one sold; the patong is always price - partner_payout.
    partner = models.ForeignKey(Partner, null=True, blank=True, on_delete=models.PROTECT, related_name='products')
    partner_payout = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.CheckConstraint(condition=models.Q(box_extra__gte=0), name='product_box_extra_not_negative'),
            models.CheckConstraint(
                condition=(Q(partner__isnull=True, partner_payout=0)
                           | Q(partner__isnull=False, partner_payout__gt=0, partner_payout__lte=F('price'))),
                name='product_partner_payout_rule',
            ),
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


class PartnerPayment(models.Model):
    """Money paid out to a partner. Never edited or deleted; a mistake is voided with a reason."""
    partner = models.ForeignKey(Partner, on_delete=models.PROTECT, related_name='payments')
    date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=200, blank=True, default='')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    void_reason = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        ordering = ['-date', '-id']
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name='partner_payment_amount_positive'),
            models.CheckConstraint(
                condition=(Q(voided_at__isnull=True, voided_by__isnull=True, void_reason='')
                           | (Q(voided_at__isnull=False, voided_by__isnull=False) & ~Q(void_reason=''))),
                name='partner_payment_void_complete',
            ),
        ]

    def __str__(self):
        return f'{self.partner.name} {self.amount} on {self.date}'
