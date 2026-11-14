from collections import Counter
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from backend.date_filters import MANILA
from backend.uploads import validate_photo
from recipes.models import Recipe

from .boxes import assortment_price, is_complete
from .models import Assortment, AssortmentItem, BoxSize, Category, Partner, PartnerPayment, Product


class OperationalPartnerSerializer(serializers.ModelSerializer):
    """What staff and the public may see about a partner: never contact details or notes."""

    class Meta:
        model = Partner
        fields = ['id', 'name', 'blurb', 'is_active', 'sort_order']
        read_only_fields = fields


class PartnerSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Partner
        fields = ['id', 'name', 'blurb', 'contact', 'notes', 'is_active', 'sort_order',
                  'product_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'product_count', 'created_at', 'updated_at']

    def validate_name(self, value):
        value = value.strip()
        taken = Partner.objects.filter(name__iexact=value)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError('A partner with this name already exists.')
        return value


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'is_active',
            'sort_order',
            'product_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'product_count', 'created_at', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True,
    )
    partner = OperationalPartnerSerializer(read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.all(),
        source='partner',
        write_only=True,
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'price',
            'image',
            'image_url',
            'category',
            'category_id',
            'is_available',
            'is_featured',
            'box_extra',
            'partner',
            'partner_id',
            'partner_payout',
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

    def validate_image(self, value):
        return validate_photo(value)

    def validate_box_extra(self, value):
        if value < 0:
            raise serializers.ValidationError('The extra in a box cannot be negative.')
        return value

    def validate(self, attrs):
        """Partner items: their price (partner_payout) above 0, patong (price - payout) never below 0."""
        current = self.instance
        partner = attrs['partner'] if 'partner' in attrs else getattr(current, 'partner', None)
        if partner is None and 'partner_payout' not in attrs:
            attrs['partner_payout'] = Decimal('0.00')
        payout = attrs.get('partner_payout', getattr(current, 'partner_payout', Decimal('0.00')))
        price = attrs.get('price', getattr(current, 'price', None))
        if partner is None:
            if payout != 0:
                raise serializers.ValidationError({'partner_payout': 'Only partner items have a partner price.'})
            return attrs
        if payout <= 0:
            raise serializers.ValidationError({'partner_payout': 'Enter their price, above ₱0.'})
        if price is not None and payout > price:
            raise serializers.ValidationError({'partner_payout': "Your patong can't be less than ₱0."})
        attrs['box_extra'] = Decimal('0.00')
        if current is not None and current.partner_id is None:
            if Recipe.objects.filter(product=current).exists():
                raise serializers.ValidationError({'partner_id': "This item has a recipe, so it's made here."})
            if current.assortment_items.exists():
                raise serializers.ValidationError({'partner_id': 'This item is in a ready-made box. Take it out first.'})
        return attrs


class OperationalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'slug', 'name', 'description', 'is_active', 'sort_order']
        read_only_fields = fields


class OperationalProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category = OperationalCategorySerializer(read_only=True)
    partner = OperationalPartnerSerializer(read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'image_url', 'category', 'is_available', 'is_featured', 'box_extra', 'partner']
        read_only_fields = fields

    def get_image_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if obj.image and request else None


class BoxSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoxSize
        fields = ['id', 'size', 'price', 'is_available', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be greater than zero.')
        return value

    def validate_size(self, value):
        if self.instance and value != self.instance.size and self.instance.assortments.exists():
            raise serializers.ValidationError('Ready-made boxes use this size. Move them to another size first.')
        return value


class AssortmentItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    name = serializers.CharField(source='product.name', read_only=True)
    category = serializers.CharField(source='product.category.name', read_only=True)
    box_extra = serializers.DecimalField(source='product.box_extra', max_digits=10, decimal_places=2, read_only=True)
    is_available = serializers.BooleanField(source='product.is_available', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = AssortmentItem
        fields = ['product_id', 'name', 'category', 'quantity', 'box_extra', 'is_available', 'image_url']

    def get_image_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.product.image.url) if obj.product.image and request else None


class AssortmentItemInputSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), source='product')
    quantity = serializers.IntegerField(min_value=1, max_value=48)


class AssortmentSerializer(serializers.ModelSerializer):
    box_size = BoxSizeSerializer(read_only=True)
    box_size_id = serializers.PrimaryKeyRelatedField(queryset=BoxSize.objects.all(), source='box_size', write_only=True)
    items = AssortmentItemSerializer(many=True, read_only=True)
    contents = AssortmentItemInputSerializer(many=True, write_only=True, required=False)
    price = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()

    class Meta:
        model = Assortment
        fields = [
            'id', 'name', 'description', 'box_size', 'box_size_id', 'items', 'contents',
            'price', 'is_complete', 'is_available', 'sort_order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_price(self, obj):
        return str(assortment_price(obj))

    def get_is_complete(self, obj):
        return is_complete(obj)

    def validate_name(self, value):
        existing = Assortment.objects.filter(name__iexact=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('A ready-made box with this name already exists.')
        return value

    def validate(self, attrs):
        box_size = attrs.get('box_size') or getattr(self.instance, 'box_size', None)
        contents = attrs.get('contents')
        if contents is None and self.instance is not None:
            # An update without contents keeps the current donuts; they must still fit a new size.
            contents = [{'product': item.product, 'quantity': item.quantity} for item in self.instance.items.all()]
        if contents is None:
            raise serializers.ValidationError({'contents': 'Choose the donuts that go in this box.'})
        partner_item = next((entry['product'] for entry in contents if entry['product'].partner_id), None)
        if partner_item:
            raise serializers.ValidationError({'contents': f"{partner_item.name} is a partner item and can't go in a box."})
        repeated = [product.name for product, count in Counter(entry['product'] for entry in contents).items() if count > 1]
        if repeated:
            raise serializers.ValidationError({'contents': f'{repeated[0]} is listed twice. Combine it into one line.'})
        total = sum(entry['quantity'] for entry in contents)
        if box_size and total != box_size.size:
            missing = box_size.size - total
            if missing > 0:
                message = f'Add {missing} more to fill the box of {box_size.size}.'
            else:
                message = f'Take out {-missing} to fit the box of {box_size.size}.'
            raise serializers.ValidationError({'contents': message})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        contents = validated_data.pop('contents')
        assortment = Assortment.objects.create(**validated_data)
        self._replace_contents(assortment, contents)
        return assortment

    @transaction.atomic
    def update(self, instance, validated_data):
        contents = validated_data.pop('contents', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if contents is not None:
            self._replace_contents(instance, contents)
        return instance

    @staticmethod
    def _replace_contents(assortment, contents):
        assortment.items.all().delete()
        AssortmentItem.objects.bulk_create(
            AssortmentItem(assortment=assortment, product=entry['product'], quantity=entry['quantity'])
            for entry in contents
        )


class PublicBoxSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoxSize
        fields = ['id', 'size', 'price']
        read_only_fields = fields


class PublicAssortmentSerializer(serializers.ModelSerializer):
    size = serializers.IntegerField(source='box_size.size', read_only=True)
    box_size_id = serializers.IntegerField(source='box_size.id', read_only=True)
    items = AssortmentItemSerializer(many=True, read_only=True)
    price = serializers.SerializerMethodField()

    class Meta:
        model = Assortment
        fields = ['id', 'name', 'description', 'box_size_id', 'size', 'items', 'price']
        read_only_fields = fields

    def get_price(self, obj):
        return str(assortment_price(obj))


class PartnerPaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = PartnerPayment
        fields = ['id', 'date', 'amount', 'note', 'recorded_by_name', 'created_at', 'voided_at', 'void_reason']
        read_only_fields = ['id', 'recorded_by_name', 'created_at', 'voided_at', 'void_reason']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Enter an amount above ₱0.')
        return value

    def validate_date(self, value):
        if value > timezone.localdate(timezone=MANILA):
            raise serializers.ValidationError("The payment date can't be in the future.")
        return value
