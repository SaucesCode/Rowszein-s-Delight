"""The shop's own details the owner can change: delivery hours, towns, days off, ordering and contact."""
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

PAYMENT_METHODS = ('gcash', 'maya', 'bank_transfer', 'cod')


class ShopSettings(models.Model):
    """Always exactly one row (pk=1), created by the seed migration."""
    messenger_url = models.URLField(max_length=200)
    facebook_url = models.URLField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    notice = models.CharField(max_length=160, blank=True)
    orders_paused = models.BooleanField(default=False)
    pause_message = models.CharField(max_length=160, blank=True)
    lead_days = models.PositiveSmallIntegerField(default=1)
    order_cutoff = models.TimeField(null=True, blank=True)
    show_hours = models.BooleanField(default=False)
    payment_methods = models.JSONField(default=list, blank=True)
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='+')

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(pk=1), name='shop_settings_singleton'),
            models.CheckConstraint(condition=Q(lead_days__lte=7), name='shop_settings_lead_days'),
        ]

    @classmethod
    def load(cls):
        return cls.objects.get(pk=1)


class DeliveryHours(models.Model):
    """One row per weekday; 0 is Monday."""
    weekday = models.PositiveSmallIntegerField(unique=True)
    is_open = models.BooleanField(default=True)
    opens = models.TimeField(null=True, blank=True)
    closes = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ['weekday']
        constraints = [
            models.CheckConstraint(condition=Q(weekday__lte=6), name='delivery_hours_weekday_range'),
            models.CheckConstraint(
                condition=Q(is_open=False) | Q(opens__isnull=False, closes__isnull=False, opens__lt=models.F('closes')),
                name='delivery_hours_open_window',
            ),
        ]


class DeliveryTown(models.Model):
    name = models.CharField(max_length=60)
    is_active = models.BooleanField(default=True)
    # Null means the fee is confirmed when the shop replies.
    fee = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(Lower('name'), name='delivery_town_name_ci_unique'),
            models.CheckConstraint(condition=Q(fee__isnull=True) | Q(fee__gte=0, fee__lte=1000),
                                   name='delivery_town_fee_range'),
        ]


class DayOff(models.Model):
    starts = models.DateField()
    ends = models.DateField()
    note = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ['starts', 'id']
        constraints = [models.CheckConstraint(condition=Q(starts__lte=models.F('ends')), name='day_off_order')]
