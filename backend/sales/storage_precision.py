"""Reject quantities the configured storage engine cannot round-trip exactly."""
from decimal import Decimal
from django.db import connection
from sales.inventory_math import quantity_quanta


def validate_quantity_storage(value):
    if not isinstance(value, Decimal):
        raise ValueError('Stock storage requires a finite Decimal')
    quantity_quanta(value.copy_abs())
    if connection.vendor == 'sqlite':
        # Django's SQLite Decimal converter explicitly uses precision=15.
        # Trim insignificant trailing zeros without ambient-context rounding.
        digits = list(value.as_tuple().digits)
        while len(digits) > 1 and digits[-1] == 0:
            digits.pop()
        if len(digits) > 15:
            raise ValueError('SQLite cannot safely store this stock quantity at nine-decimal precision. Use PostgreSQL for the full supported range.')
    return value
