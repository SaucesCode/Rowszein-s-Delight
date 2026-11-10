from decimal import Decimal
from unittest.mock import patch
from django.test import SimpleTestCase
from sales.storage_precision import validate_quantity_storage


class StoragePrecisionTests(SimpleTestCase):
    @patch('sales.storage_precision.connection')
    def test_postgresql_retains_full_approved_quantity_range(self, database):
        database.vendor = 'postgresql'
        for value in ['99999999999.999999999', '-99999999999.999999999', '1000000.000000001']:
            self.assertEqual(validate_quantity_storage(Decimal(value)), Decimal(value))

    @patch('sales.storage_precision.connection')
    def test_sqlite_accepts_safe_values_with_insignificant_zeros(self, database):
        database.vendor = 'sqlite'
        for value in ['1000000.000000000', '0.000000001', '19.993333333', '99999999999.000000000', '0.000000000']:
            self.assertEqual(validate_quantity_storage(Decimal(value)), Decimal(value))

    @patch('sales.storage_precision.connection')
    def test_sqlite_rejects_unsafe_signed_quantities_and_balances(self, database):
        database.vendor = 'sqlite'
        for value in ['1000000.000000001', '-1000000.000000001', '99999999999.999999999']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_quantity_storage(Decimal(value))

    @patch('sales.storage_precision.connection')
    def test_no_engine_accepts_floats_nonfinite_or_subquantum_values(self, database):
        for vendor in ['sqlite', 'postgresql']:
            database.vendor = vendor
            for value in [1.5, Decimal('NaN'), Decimal('Infinity'), Decimal('.0000000001')]:
                with self.subTest(vendor=vendor, value=value), self.assertRaises(ValueError):
                    validate_quantity_storage(value)
