"""Inclusive date-only query filters for recorded business dates."""
from datetime import date
import re
from zoneinfo import ZoneInfo

from rest_framework.exceptions import ValidationError


MANILA = ZoneInfo('Asia/Manila')
ISO_DATE = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}')


class DateFilterError(ValidationError):
    def __init__(self, field, message):
        super().__init__({'error': {field: [message]}})
        self.detail['success'] = False


def _boundary(params, name):
    values = params.getlist(name)
    if not values:
        return None
    if len(values) != 1:
        raise DateFilterError(name, 'Supply this date once.')
    value = values[0]
    if ISO_DATE.fullmatch(value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise DateFilterError(name, 'Enter a valid calendar date in YYYY-MM-DD format.')


def date_bounds(params, *, default_from=None, default_to=None):
    start = _boundary(params, 'date_from') or default_from
    end = _boundary(params, 'date_to') or default_to
    if start is not None and end is not None and start > end:
        raise DateFilterError('date_to', 'The end date must be on or after the start date.')
    return start, end


def filter_by_business_date(queryset, params):
    """Filter history by the model's recorded date, leaving omitted bounds open."""
    start, end = date_bounds(params)
    if start is not None:
        queryset = queryset.filter(date__gte=start)
    if end is not None:
        queryset = queryset.filter(date__lte=end)
    return queryset


def report_date_bounds(params, today):
    """Preserve the reporting default for each omitted boundary."""
    return date_bounds(params, default_from=today.replace(month=1, day=1), default_to=today)
