from decimal import Decimal

from rest_framework import serializers
from .models import Sale, SaleItem
from products.models import Assortment, BoxSize, Product


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'product',
            'product_name',
            'quantity',
            'unit_price',
            'subtotal',
            'subtotal_amount',
        ]
        read_only_fields = ['subtotal', 'subtotal_amount']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be at least 1.')
        return value

    def validate_unit_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Unit price must be greater than zero.')
        return value


class BoxContentInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=48)


class SaleBoxInputSerializer(serializers.Serializer):
    """One box on a sale: keep a saved box by key, or add a filled size or a ready-made box."""
    key = serializers.CharField(max_length=64, required=False)
    box_size = serializers.PrimaryKeyRelatedField(queryset=BoxSize.objects.all(), required=False)
    assortment = serializers.PrimaryKeyRelatedField(queryset=Assortment.objects.select_related('box_size'), required=False)
    contents = BoxContentInputSerializer(many=True, required=False, max_length=12)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), required=False)

    def validate(self, attrs):
        if sum(name in attrs for name in ('key', 'box_size', 'assortment')) != 1:
            raise serializers.ValidationError('Choose a box size or a ready-made box.')
        if 'contents' in attrs and 'box_size' not in attrs:
            raise serializers.ValidationError('Only a box size takes contents.')
        if 'box_size' in attrs and not attrs.get('contents'):
            raise serializers.ValidationError('Choose the flavours for this box.')
        if 'key' in attrs and 'price' in attrs:
            raise serializers.ValidationError('A saved box keeps its price.')
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    sale_items = SaleItemSerializer(many=True, required=False)
    boxes = SaleBoxInputSerializer(many=True, required=False, max_length=50)
    total_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Sale
        fields = [
            'id',
            'date',
            'notes',
            'sale_items',
            'boxes',
            'total_amount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'total_amount', 'created_at', 'updated_at']

    def validate(self, attrs):
        if not self.partial and not attrs.get('sale_items') and not attrs.get('boxes'):
            raise serializers.ValidationError('Add at least one item or box.')
        return attrs

    def validate_sale_items(self, value):
        product_ids = [item['product'].id for item in value]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError('Duplicate products are not allowed.')

        return value

    def create(self, validated_data):
        raise serializers.ValidationError('Use the transactional sale command service.')

    def update(self, instance, validated_data):
        raise serializers.ValidationError('Use the transactional sale command service.')

    def to_representation(self, instance):
        from .services import sale_data
        return sale_data(instance)


class CancellationSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000, allow_blank=False)
