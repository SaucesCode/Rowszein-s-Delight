from rest_framework import serializers
from .models import Ingredient


class IngredientSerializer(serializers.ModelSerializer):
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
        ]
        read_only_fields = ['id', 'is_low_stock', 'category_display', 'image_url', 'created_at', 'updated_at']
        extra_kwargs = {
            'image': {'write_only': True, 'required': False},
        }

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

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