"""Which delivery days the shop accepts, from the owner's Shop settings. All dates are Manila dates."""
from datetime import date, datetime, timedelta

from django.utils import timezone

from shop.models import DayOff, DeliveryHours, ShopSettings

MAX_DAYS_AHEAD = 30


def current_time() -> datetime:
    """The orders feature's clock; tests replace it without touching the session limiter's clock."""
    return timezone.now()


def day_label(day: date) -> str:
    """"Nov 18"."""
    return f'{day:%b} {day.day}'


def earliest_delivery_date(now: datetime) -> date:
    """Today plus the lead time, and one more day once today's order cutoff has passed."""
    settings = ShopSettings.load()
    local = timezone.localtime(now)
    earliest = local.date() + timedelta(days=settings.lead_days)
    if settings.order_cutoff is not None and local.time() > settings.order_cutoff:
        earliest += timedelta(days=1)
    return earliest


def delivery_date_problem(day: date, now: datetime) -> str | None:
    """The customer-facing reason a day can't be chosen, or None when it can."""
    earliest = earliest_delivery_date(now)
    if day < earliest:
        return f'Pick a delivery day from {day_label(earliest)}.'
    refused = f"We don't deliver on {day_label(day)}. Pick another day."
    if day > earliest + timedelta(days=MAX_DAYS_AHEAD):
        return refused
    if DayOff.objects.filter(starts__lte=day, ends__gte=day).exists():
        return refused
    if ShopSettings.load().show_hours and DeliveryHours.objects.filter(weekday=day.weekday(), is_open=False).exists():
        return refused
    return None
