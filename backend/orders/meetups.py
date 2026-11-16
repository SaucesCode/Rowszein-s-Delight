"""Which days and times a meet-up place takes orders. All dates and times are Manila time."""
from datetime import date, datetime, time, timedelta

from django.utils import timezone

from shop.models import DayOff, MeetupPlace

from .delivery import MAX_DAYS_AHEAD, day_label, earliest_delivery_date

STEP_MINUTES = 30
NOTICE_MINUTES = 60


def time_label(at: time) -> str:
    """"3:00 PM"."""
    return f'{at.hour % 12 or 12}:{at.minute:02d} {"AM" if at.hour < 12 else "PM"}'


def weekday_label(day: date) -> str:
    """"Sat, Nov 21"."""
    return f'{day:%a}, {day_label(day)}'


def _minutes(at: time) -> int:
    return at.hour * 60 + at.minute


def _grid(place: MeetupPlace, day: date) -> list[time]:
    """Every 30 minutes from opening until 30 minutes before closing, on the place's hours for that weekday."""
    hours = next((row for row in place.hours.all() if row.weekday == day.weekday()), None)
    if hours is None or not hours.is_open:
        return []
    start, last = _minutes(hours.opens), _minutes(hours.closes) - STEP_MINUTES
    return [time(minute // 60, minute % 60) for minute in range(start, last + 1, STEP_MINUTES)]


def meetup_times(place: MeetupPlace, day: date, now: datetime) -> list[time]:
    """The times a customer can pick; today's start at least an hour from now."""
    times = _grid(place, day)
    local = timezone.localtime(now)
    if day == local.date():
        soonest = _minutes(local.time()) + NOTICE_MINUTES + (1 if local.second or local.microsecond else 0)
        times = [at for at in times if _minutes(at) >= soonest]
    return times


def meetup_day_problem(place: MeetupPlace, day: date, now: datetime) -> str | None:
    """The customer-facing reason a day can't be picked for this place, or None."""
    earliest = earliest_delivery_date(now)
    if day < earliest:
        return f'Pick a day from {day_label(earliest)}.'
    refused = f"We don't meet there on {day_label(day)}. Pick another day."
    if day > earliest + timedelta(days=MAX_DAYS_AHEAD):
        return refused
    if DayOff.objects.filter(starts__lte=day, ends__gte=day).exists():
        return refused
    if not meetup_times(place, day, now):
        return refused
    return None


def meetup_time_problem(place: MeetupPlace, day: date, at: time, now: datetime) -> str | None:
    grid = _grid(place, day)
    if not grid:
        return None  # the day itself is refused
    if at not in grid:
        return f'Pick a time between {time_label(grid[0])} and {time_label(grid[-1])}.'
    if at not in meetup_times(place, day, now):
        return 'Pick a time at least an hour from now.'
    return None
