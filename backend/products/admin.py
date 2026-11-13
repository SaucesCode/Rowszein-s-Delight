from django.contrib import admin
from .models import Assortment, AssortmentItem, BoxSize, Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'sort_order')
    list_filter = ('is_active',)
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')
    ordering = ('sort_order', 'name')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'box_extra', 'is_available', 'is_featured')
    list_filter = ('category', 'is_available', 'is_featured')
    search_fields = ('name', 'description')
    list_select_related = ('category',)


@admin.register(BoxSize)
class BoxSizeAdmin(admin.ModelAdmin):
    list_display = ('size', 'price', 'is_available')
    list_filter = ('is_available',)


class AssortmentItemInline(admin.TabularInline):
    model = AssortmentItem
    extra = 0


@admin.register(Assortment)
class AssortmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'box_size', 'is_available', 'sort_order')
    list_filter = ('is_available', 'box_size')
    search_fields = ('name',)
    inlines = [AssortmentItemInline]
