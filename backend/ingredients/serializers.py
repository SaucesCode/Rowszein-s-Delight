from rest_framework import serializers
from backend.uploads import validate_photo
from .models import Ingredient
from sales.storage_precision import validate_quantity_storage


class IngredientSerializer(serializers.ModelSerializer):
    stock_revision = serializers.CharField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = [
            'id',
            'name',
            'quantity',
            'unit',
            'cost_per_unit',
            'supplier',
            'minimum_stock',
            'category',
            'category_display',
            'notes',
            'image',
            'image_url',
            'is_low_stock',
            'created_at',
            'updated_at',
            'stock_revision',
        ]
        read_only_fields = ['id', 'is_low_stock', 'category_display', 'image_url', 'created_at', 'updated_at', 'stock_revision']
        extra_kwargs = {
            'image': {'write_only': True, 'required': False},
        }

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def validate_image(self, value):
        return validate_photo(value)

    def validate_name(self, value):
        qs = Ingredient.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An ingredient with this name already exists.')
        return value

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError('Quantity cannot be negative.')
        try:
            validate_quantity_storage(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error
        return value

    def validate_cost_per_unit(self, value):
        if value <= 0:
            raise serializers.ValidationError('Cost per unit must be greater than zero.')
        return value

    def validate_minimum_stock(self, value):
        if value < 0:
            raise serializers.ValidationError('Minimum stock cannot be negative.')
        return value


class OperationalIngredientSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'quantity', 'unit', 'is_low_stock']
        read_only_fields = fields


class StockAdjustmentSerializer(serializers.Serializer):
    delta = serializers.DecimalField(max_digits=20, decimal_places=9)
    reason = serializers.CharField(max_length=2000, allow_blank=False)

    def validate_delta(self, value):
        if not value:
            raise serializers.ValidationError('Adjustment must be nonzero.')
        try:
            validate_quantity_storage(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error
        return value
