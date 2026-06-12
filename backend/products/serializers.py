from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'price',
            'image',
            'image_url',
            'is_available',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'image_url', 'created_at', 'updated_at']
        extra_kwargs = {
            'image': {'write_only': True, 'required': False},
        }

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def validate_name(self, value):
        qs = Product.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A product with this name already exists.')
        return value

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be greater than zero.')
        return value