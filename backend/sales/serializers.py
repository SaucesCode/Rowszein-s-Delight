from rest_framework import serializers
from .models import Sale, SaleItem
from products.models import Product


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
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be at least 1.')
        return value

    def validate_unit_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Unit price must be greater than zero.')
        return value


class SaleSerializer(serializers.ModelSerializer):
    sale_items = SaleItemSerializer(many=True)
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
            'total_amount',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'total_amount', 'created_at', 'updated_at']

    def validate_sale_items(self, value):
        if not value:
            raise serializers.ValidationError('A sale must have at least one item.')

        product_ids = [item['product'].id for item in value]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError('Duplicate products are not allowed.')

        return value

    def create(self, validated_data):
        items_data = validated_data.pop('sale_items')

        sale = Sale.objects.create(**validated_data)

        SaleItem.objects.bulk_create([
            SaleItem(
                sale=sale,
                product=item['product'],
                quantity=item['quantity'],
                unit_price=item['unit_price'],
            )
            for item in items_data
        ])

        sale.compute_total()
        return sale

    def update(self, instance, validated_data):
        items_data = validated_data.pop('sale_items', None)

        instance.date = validated_data.get('date', instance.date)
        instance.notes = validated_data.get('notes', instance.notes)
        instance.save()

        if items_data is not None:
            instance.sale_items.all().delete()
            SaleItem.objects.bulk_create([
                SaleItem(
                    sale=instance,
                    product=item['product'],
                    quantity=item['quantity'],
                    unit_price=item['unit_price'],
                )
                for item in items_data
            ])
            instance.compute_total()

        return instance