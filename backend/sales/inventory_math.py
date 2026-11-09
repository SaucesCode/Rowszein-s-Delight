"""Exact stock arithmetic. Database integration awaits migration execution QA."""
from dataclasses import dataclass
from decimal import Decimal, localcontext
from hashlib import sha256
import json

QUANTUM = Decimal("0.000000001")
MAX_QUANTITY = Decimal("99999999999.999999999")  # Proposed Decimal(20, 9).
MAX_MONEY = Decimal("99999999.99")  # Existing Decimal(10, 2).
MAX_BATCH_QUANTITY = Decimal("99999999.99")  # Existing RecipeIngredient precision.
MAX_ACTIVE_UNITS = 9223372036854775807
MAX_YIELD = 2147483647
UNITS = frozenset({"kg", "g", "l", "ml", "pcs", "cup", "tbsp", "tsp"})


class InsufficientStock(ValueError):
    pass


def _integer(value, lower, upper, name):
    if type(value) is not int or not lower <= value <= upper:
        raise ValueError(f"{name} must be an integer between {lower} and {upper}")


def _scaled(value, places, maximum):
    if not isinstance(value, Decimal) or not value.is_finite():
        raise ValueError("A finite Decimal is required; floats are not accepted")
    if value < 0 or value > maximum:
        raise ValueError("Decimal value is outside the supported nonnegative range")
    with localcontext() as context:
        context.prec = 50
        scaled = value.scaleb(places)
        if scaled != scaled.to_integral_value():
            raise ValueError(f"At most {places} fractional places are supported")
        return int(scaled)


def quantity_quanta(value):
    return _scaled(value, 9, MAX_QUANTITY)


def quantity_text(value):
    return format(_from_quanta(quantity_quanta(value)), ".9f")


def money_text(value):
    """Validate existing cent precision, without silently rounding prices."""
    cents = _scaled(value, 2, MAX_MONEY)
    with localcontext() as context:
        context.prec = 50
        return format(Decimal(cents).scaleb(-2), ".2f")


def signed_money_text(value):
    """Preserve signed historical values without permitting new invalid prices."""
    magnitude = money_text(value.copy_abs())
    return '-' + magnitude if value < 0 else magnitude


def _from_quanta(value):
    with localcontext() as context:
        context.prec = 50
        return Decimal(value).scaleb(-9)


@dataclass(frozen=True)
class Basis:
    batch_quantity: Decimal
    yield_quantity: int
    unit: str

    def __post_init__(self):
        if _scaled(self.batch_quantity, 2, MAX_BATCH_QUANTITY) == 0:
            raise ValueError("Batch quantity must be positive")
        _integer(self.yield_quantity, 1, MAX_YIELD, "Yield")
        if quantity_quanta(self.batch_quantity) < self.yield_quantity:
            raise ValueError("Per-unit consumption below the stock quantum requires a different measurement unit")
        if self.unit not in UNITS:
            raise ValueError("Unsupported ingredient unit")


def cumulative_quanta(basis, active_units):
    """Exact positive HALF_UP division; no repeating Decimal intermediates.

    Cumulative consumption is not a stock-column value and can exceed the
    maximum instantaneous stock after many replenishments. It remains an int.
    """
    _integer(active_units, 0, MAX_ACTIVE_UNITS, "Active units")
    numerator = quantity_quanta(basis.batch_quantity) * active_units
    quotient, remainder = divmod(numerator, basis.yield_quantity)
    return quotient + int(2 * remainder >= basis.yield_quantity)


@dataclass(frozen=True)
class Allocation:
    start: int
    end: int
    applied_quantity: Decimal


def allocate(basis, allocated_units, units):
    """Consume a never-rewound cursor interval, not the active-unit count."""
    _integer(allocated_units, 0, MAX_ACTIVE_UNITS, 'Allocation cursor')
    _integer(units, 1, MAX_ACTIVE_UNITS, 'Units')
    end = allocated_units + units
    _integer(end, 1, MAX_ACTIVE_UNITS, 'Allocation end')
    amount = cumulative_quanta(basis, end) - cumulative_quanta(basis, allocated_units)
    value = _from_quanta(amount)
    quantity_quanta(value)  # Reject unrepresentable snapshots, never round them.
    return Allocation(allocated_units, end, value)


def apply_deltas(available, deltas):
    """Exact stored-snapshot credits/new deductions; no historical re-rounding."""
    result = quantity_quanta(available)
    for value in deltas:
        if not isinstance(value, Decimal) or not value.is_finite():
            raise ValueError('A finite signed Decimal is required')
        result += (1 if value >= 0 else -1) * quantity_quanta(value.copy_abs())
    if result < 0:
        raise InsufficientStock('Aggregate projected ingredient stock would be negative')
    if result > quantity_quanta(MAX_QUANTITY):
        raise ValueError('Aggregate projected stock would exceed the supported range')
    return _from_quanta(result)


@dataclass(frozen=True)
class Change:
    basis: Basis
    before_units: int
    after_units: int


@dataclass(frozen=True)
class Projection:
    quantity_delta: Decimal
    resulting_quantity: Decimal


def project_stock(available, unit, changes):
    """Prior design experiment, retained only for its historical probe tests.

    NOT the approved cancellation/update algorithm: services must use allocate
    and apply_deltas with exact snapshots, never recompute active-unit rounding.
    """
    if unit not in UNITS:
        raise ValueError("Unsupported ingredient unit")
    available_quanta = quantity_quanta(available)
    delta = 0
    for change in changes:
        if change.basis.unit != unit:
            raise ValueError("Ingredient unit mismatch; automatic conversion is forbidden")
        delta += cumulative_quanta(change.basis, change.before_units)
        delta -= cumulative_quanta(change.basis, change.after_units)
    resulting = available_quanta + delta
    if resulting < 0:
        raise InsufficientStock("Aggregate projected ingredient stock would be negative")
    if resulting > quantity_quanta(MAX_QUANTITY):
        raise ValueError("Aggregate projected ingredient stock exceeds the supported range")
    return Projection(_from_quanta(delta), _from_quanta(resulting))


def intent_fingerprint(canonical_intent):
    """Hash already normalized JSON data, preserving explicit money/unit types.

    Callers must canonicalize semantic fields (money_text, quantity_text,
    dates, sorted product IDs) before hashing. No floats or implicit Decimal
    conversion; strings such as '1.0' and '1.00' are not normalized generically.
    """
    def validate(value, depth=0):
        if depth > 32:
            raise ValueError("Intent exceeds the supported nesting depth")
        if value is None or type(value) in (str, bool, int):
            return
        if type(value) is list:
            for item in value:
                validate(item, depth + 1)
            return
        if type(value) is dict and all(type(key) is str for key in value):
            for item in value.values():
                validate(item, depth + 1)
            return
        raise ValueError("Intent must use canonical JSON values without floats or Decimals")

    if type(canonical_intent) is not dict:
        raise ValueError("Intent must be an object")
    validate(canonical_intent)
    encoded = json.dumps(canonical_intent, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return sha256(encoded.encode("utf-8")).hexdigest()
