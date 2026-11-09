from django.db import models
from django.db.models import F, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models.lookups import GreaterThanOrEqual
from decimal import Decimal
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
    inventory_tracking = models.CharField(max_length=14, default='legacy_unknown', choices=[('legacy_unknown', 'Legacy unknown'), ('tracked', 'Tracked')])
    financial_tracking = models.CharField(max_length=13, default='legacy_source', choices=[('legacy_source', 'Legacy source'), ('ledger', 'Ledger')])
    status = models.CharField(max_length=9, default='recorded', choices=[('recorded', 'Recorded'), ('cancelled', 'Cancelled')])
    revision = models.BigIntegerField(default=0)
    # Original SaleItem rows and total_amount are preserved. This is a current
    # projection; every committed version is retained in InventoryOperation.
    current_items = models.JSONField(null=True, blank=True, default=None)
    cancellation_operation = models.OneToOneField('InventoryOperation', null=True, blank=True, default=None, on_delete=models.PROTECT, related_name='cancelled_sale')

    class Meta:
        ordering = ['-date', '-created_at']
        constraints = [
            models.CheckConstraint(condition=Q(inventory_tracking__in=['legacy_unknown', 'tracked']), name='sale_tracking_valid'),
            models.CheckConstraint(condition=Q(financial_tracking__in=['legacy_source', 'ledger']), name='sale_financial_tracking_valid'),
            models.CheckConstraint(condition=Q(status__in=['recorded', 'cancelled']), name='sale_status_valid'),
            models.CheckConstraint(condition=Q(revision__gte=0) & (~Q(inventory_tracking='tracked') | Q(revision__gte=1)), name='sale_revision_valid'),
            models.CheckConstraint(condition=(Q(status='recorded', cancellation_operation__isnull=True) | Q(status='cancelled', cancellation_operation__isnull=False)), name='sale_cancel_link_valid'),
        ]

    def delete(self, *args, **kwargs):
        raise ValidationError('Sales must be cancelled through the transaction service, never deleted.')

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
    subtotal_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    class Meta:
        unique_together = ['sale', 'product']

    def __str__(self):
        return f"{self.product.name} x{self.quantity} @ ₱{self.unit_price}"

    @property
    def subtotal(self):
        return self.quantity * self.unit_price

    def save(self, *args, **kwargs):
        self.subtotal_amount = self.quantity * self.unit_price
        if not self._state.adding:
            raise ValidationError('Original sale items are immutable; use a new sale projection.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Original sale items must be retained.')


class RetainedRecord(models.Model):
    """Application guard; raw SQL/QuerySet bypass requires separate DB privileges."""
    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        raise ValidationError('Audit records must be retained.')


class ImmutableRecord(RetainedRecord):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError('Committed audit records cannot be changed.')
        return super().save(*args, **kwargs)


class InventoryOperation(ImmutableRecord):
    actor = models.ForeignKey('accounts.User', on_delete=models.PROTECT, db_index=False)
    client_key = models.UUIDField()
    action = models.CharField(max_length=16, choices=[(x, x) for x in ['sale_create', 'sale_update', 'sale_cancel', 'stock_adjust']])
    sale = models.ForeignKey(Sale, null=True, blank=True, on_delete=models.PROTECT, db_index=False, related_name='operations')
    ingredient = models.ForeignKey('ingredients.Ingredient', null=True, blank=True, on_delete=models.PROTECT, related_name='operations')
    request_fingerprint = models.CharField(max_length=64)
    reason = models.TextField(blank=True, default='')
    schema_version = models.SmallIntegerField(default=1)
    before_snapshot = models.JSONField(default=dict)
    response_status = models.SmallIntegerField()
    response_body = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['actor', 'client_key'], name='invop_actor_key_unique'),
            # Independent of request UUID and actor.
            models.UniqueConstraint(fields=['sale'], condition=Q(action='sale_cancel'), name='invop_sale_cancel_once'),
            models.CheckConstraint(condition=Q(action__in=['sale_create', 'sale_update', 'sale_cancel', 'stock_adjust']), name='invop_action_valid'),
            models.CheckConstraint(condition=(Q(action='stock_adjust', ingredient__isnull=False, sale__isnull=True) | Q(action__in=['sale_create', 'sale_update', 'sale_cancel'], sale__isnull=False, ingredient__isnull=True)), name='invop_target_valid'),
            models.CheckConstraint(condition=(Q(action='sale_create', response_status=201) | Q(action__in=['sale_update', 'sale_cancel', 'stock_adjust'], response_status=200)), name='invop_response_valid'),
            models.CheckConstraint(condition=Q(request_fingerprint__regex=r'^[0-9a-f]{64}$'), name='invop_fingerprint_valid'),
            models.CheckConstraint(condition=Q(schema_version=1), name='invop_version_valid'),
            models.CheckConstraint(condition=~Q(action__in=['sale_cancel', 'stock_adjust']) | ~Q(reason=''), name='invop_reason_required'),
        ]
        indexes = [models.Index(fields=['sale', 'created_at', 'id'], name='invop_sale_time_idx')]


class ConsumptionBasis(RetainedRecord):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_index=False)
    ingredient = models.ForeignKey('ingredients.Ingredient', on_delete=models.PROTECT)
    unit = models.CharField(max_length=10)
    batch_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    yield_quantity = models.IntegerField()
    allocated_units = models.BigIntegerField(default=0)
    active_units = models.BigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['product', 'ingredient', 'unit', 'batch_quantity', 'yield_quantity'], name='basis_rate_unique'),
            models.CheckConstraint(condition=Q(unit__in=['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp']), name='basis_unit_valid'),
            models.CheckConstraint(condition=Q(batch_quantity__gt=0), name='basis_batch_positive'),
            models.CheckConstraint(condition=Q(yield_quantity__gte=1), name='basis_yield_positive'),
            models.CheckConstraint(condition=Q(active_units__gte=0, allocated_units__gte=F('active_units')), name='basis_counts_valid'),
            models.CheckConstraint(condition=GreaterThanOrEqual(F('batch_quantity') * models.Value(Decimal('1000000000')), F('yield_quantity')), name='basis_min_quantum'),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            old = type(self).objects.get(pk=self.pk)
            if any(getattr(self, field) != getattr(old, field) for field in ['product_id', 'ingredient_id', 'unit', 'batch_quantity', 'yield_quantity']) or self.allocated_units < old.allocated_units:
                raise ValidationError('Basis rates are immutable and allocation cursors cannot decrease.')
        return super().save(*args, **kwargs)


class SaleConsumption(RetainedRecord):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, db_index=False, related_name='consumptions')
    sale_revision = models.BigIntegerField()
    basis = models.ForeignKey(ConsumptionBasis, on_delete=models.PROTECT, related_name='consumptions')
    operation = models.ForeignKey(InventoryOperation, on_delete=models.PROTECT, related_name='consumptions')
    allocation_start = models.BigIntegerField()
    units = models.BigIntegerField()
    applied_quantity = models.DecimalField(max_digits=20, decimal_places=9)
    reversed_by = models.ForeignKey(InventoryOperation, null=True, blank=True, on_delete=models.PROTECT, related_name='reversed_consumptions')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['sale', 'sale_revision', 'basis'], name='sc_sale_rev_basis_unique'),
            models.UniqueConstraint(fields=['basis', 'allocation_start'], name='sc_basis_start_unique'),
            models.UniqueConstraint(fields=['sale', 'basis'], condition=Q(reversed_by__isnull=True), name='sc_active_sale_basis_unique'),
            models.CheckConstraint(condition=Q(sale_revision__gte=1, allocation_start__gte=0, units__gte=1, applied_quantity__gt=0), name='sc_values_positive'),
            models.CheckConstraint(condition=Q(allocation_start__lte=9223372036854775807 - F('units')), name='sc_counter_range'),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            old = type(self).objects.get(pk=self.pk)
            fields = ['sale_id', 'sale_revision', 'basis_id', 'operation_id', 'allocation_start', 'units', 'applied_quantity']
            if any(getattr(old, f) != getattr(self, f) for f in fields) or old.reversed_by_id is not None or self.reversed_by_id is None:
                raise ValidationError('Only a one-time reversal marker may be added to a consumption snapshot.')
        return super().save(*args, **kwargs)


class StockMovement(ImmutableRecord):
    operation = models.ForeignKey(InventoryOperation, on_delete=models.PROTECT, db_index=False, related_name='movements')
    ingredient = models.ForeignKey('ingredients.Ingredient', on_delete=models.PROTECT, db_index=False, related_name='movements')
    stock_revision = models.BigIntegerField()
    unit = models.CharField(max_length=10)
    quantity_delta = models.DecimalField(max_digits=20, decimal_places=9)
    balance_after = models.DecimalField(max_digits=20, decimal_places=9)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['operation', 'ingredient'], name='movement_op_ing_unique'),
            models.UniqueConstraint(fields=['ingredient', 'stock_revision'], name='movement_ing_rev_unique'),
            models.CheckConstraint(condition=Q(unit__in=['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp']), name='movement_unit_valid'),
            models.CheckConstraint(condition=~Q(quantity_delta=0), name='movement_delta_nonzero'),
            models.CheckConstraint(condition=Q(balance_after__gte=0, stock_revision__gte=1), name='movement_balance_valid'),
        ]


class SaleFinancialEntry(ImmutableRecord):
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name='financial_entries')
    operation = models.OneToOneField(InventoryOperation, on_delete=models.PROTECT, related_name='financial_entry')
    sale_revision = models.BigIntegerField()
    kind = models.CharField(max_length=16, choices=[(x, x) for x in ['gross_sale', 'sale_adjustment', 'cancellation']])
    effective_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['sale', 'sale_revision'], name='finance_sale_revision_unique'),
            models.UniqueConstraint(fields=['sale'], condition=Q(kind='gross_sale'), name='finance_gross_once'),
            models.UniqueConstraint(fields=['sale'], condition=Q(kind='cancellation'), name='finance_cancel_once'),
            models.CheckConstraint(condition=(Q(kind='gross_sale', amount__gt=0) | Q(kind='sale_adjustment') & ~Q(amount=0) | Q(kind='cancellation', amount__lt=0)), name='finance_sign_valid'),
            models.CheckConstraint(condition=Q(sale_revision__gte=1), name='finance_revision_positive'),
        ]
        indexes = [models.Index(fields=['effective_date', 'kind', 'id'], name='finance_date_kind_idx')]
