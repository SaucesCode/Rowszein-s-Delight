from django.contrib import admin
from .models import Ingredient


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'quantity', 'unit', 'cost_per_unit', 'minimum_stock', 'is_low_stock')
    list_filter = ('category', 'unit')
    search_fields = ('name', 'supplier')

    def get_readonly_fields(self, request, obj=None):
        audit = ('stock_revision', 'ledger_opening_quantity', 'ledger_started_at')
        return audit + (('quantity', 'unit') if obj else ())

    def has_delete_permission(self, request, obj=None):
        return False
