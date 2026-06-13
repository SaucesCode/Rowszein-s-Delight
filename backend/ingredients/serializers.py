from rest_framework import serializers
from .models import Ingredient


class IngredientSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

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
            'is_low_stock',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_low_stock', 'created_at', 'updated_at']

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
        return value

    def validate_cost_per_unit(self, value):
        if value <= 0:
            raise serializers.ValidationError('Cost per unit must be greater than zero.')
        return value

    def validate_minimum_stock(self, value):
        if value < 0:
            raise serializers.ValidationError('Minimum stock cannot be negative.')
        return value