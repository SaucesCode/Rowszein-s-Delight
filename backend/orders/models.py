"""Orders customers send from the online shop, and the outbox for the owner's new-order emails."""
from django.conf import settings
from django.db import models
from django.db.models import Q

STATUSES = ('waiting', 'confirmed', 'declined')
EMAIL_STATUSES = ('pending', 'sent', 'failed')


class OnlineOrder(models.Model):
    """A server-priced snapshot of what the customer sent. Confirming it records a sale."""
    number = models.CharField(max_length=16, unique=True)
    token = models.CharField(max_length=64, unique=True)
    client_key = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=10, default='waiting', choices=[(s, s.title()) for s in STATUSES])

    customer_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=16, blank=True)
    address = models.CharField(max_length=200, blank=True)
    note = models.CharField(max_length=300, blank=True)
    town = models.ForeignKey('shop.DeliveryTown', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    town_name = models.CharField(max_length=60)
    # Null means the fee is confirmed when the shop replies.
    delivery_fee = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    delivery_date = models.DateField()
    payment_method = models.CharField(max_length=20, blank=True)

    items = models.JSONField(default=list)
    boxes = models.JSONField(default=list)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    owner_message = models.CharField(max_length=300, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='+')
    sale = models.OneToOneField('sales.Sale', null=True, blank=True, on_delete=models.PROTECT, related_name='online_order')
    contact_cleared_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=Q(status__in=STATUSES), name='online_order_status_valid'),
            models.CheckConstraint(
                condition=Q(status='confirmed', sale__isnull=False) | (~Q(status='confirmed') & Q(sale__isnull=True)),
                name='online_order_sale_only_when_confirmed',
            ),
            models.CheckConstraint(condition=Q(subtotal__gte=0, total__gte=0), name='online_order_total_not_negative'),
        ]
        indexes = [
            models.Index(fields=['status', 'created_at'], name='online_order_status_time'),
            models.Index(fields=['delivery_date'], name='online_order_delivery'),
        ]

    @property
    def shown_status(self) -> str:
        """What the owner and customer see: a confirmed order whose sale was cancelled reads as cancelled."""
        if self.status == 'confirmed' and self.sale is not None and self.sale.status == 'cancelled':
            return 'cancelled'
        return self.status


class OrderEmail(models.Model):
    """One new-order email to the owner. Written with the order; sent after commit and retried."""
    order = models.ForeignKey(OnlineOrder, on_delete=models.CASCADE, related_name='emails')
    status = models.CharField(max_length=7, default='pending', choices=[(s, s.title()) for s in EMAIL_STATUSES])
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=200, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'id']
        constraints = [models.CheckConstraint(condition=Q(status__in=EMAIL_STATUSES), name='order_email_status_valid')]
