from django.contrib import admin
from .models import Ingredient


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'quantity', 'unit', 'cost_per_unit', 'minimum_stock', 'is_low_stock')
    list_filter = ('category', 'unit')
    search_fields = ('name', 'supplier')