from rest_framework import serializers
from .models import Recipe, RecipeIngredient
from ingredients.models import Ingredient
from products.serializers import ProductSerializer


class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    unit = serializers.CharField(source='ingredient.unit', read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ['id', 'ingredient', 'ingredient_name', 'unit', 'quantity']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value


class RecipeSerializer(serializers.ModelSerializer):
    recipe_ingredients = RecipeIngredientSerializer(many=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    production_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True,
    )
    cost_per_unit = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True,
    )

    class Meta:
        model = Recipe
        fields = [
            'id',
            'product',
            'product_name',
            'yield_quantity',
            'notes',
            'recipe_ingredients',
            'production_cost',
            'cost_per_unit',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'product_name', 'production_cost', 'cost_per_unit',
            'created_at', 'updated_at',
        ]

    def validate_product(self, value):
        if self.instance is None:
            if Recipe.objects.filter(product=value).exists():
                raise serializers.ValidationError('This product already has a recipe.')
        return value

    def validate_yield_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError('Yield must be at least 1 unit.')
        return value

    def validate_recipe_ingredients(self, value):
        if not value:
            raise serializers.ValidationError('A recipe must have at least one ingredient.')
        ingredient_ids = [item['ingredient'].id for item in value]
        if len(ingredient_ids) != len(set(ingredient_ids)):
            raise serializers.ValidationError('Duplicate ingredients are not allowed.')
        return value

    def create(self, validated_data):
        ingredients_data = validated_data.pop('recipe_ingredients')
        recipe = Recipe.objects.create(**validated_data)

        RecipeIngredient.objects.bulk_create([
            RecipeIngredient(
                recipe=recipe,
                ingredient=item['ingredient'],
                quantity=item['quantity'],
            )
            for item in ingredients_data
        ])
        return recipe

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop('recipe_ingredients', None)

        instance.notes = validated_data.get('notes', instance.notes)
        instance.product = validated_data.get('product', instance.product)
        instance.yield_quantity = validated_data.get('yield_quantity', instance.yield_quantity)
        instance.save()

        if ingredients_data is not None:
            instance.recipe_ingredients.all().delete()
            RecipeIngredient.objects.bulk_create([
                RecipeIngredient(
                    recipe=instance,
                    ingredient=item['ingredient'],
                    quantity=item['quantity'],
                )
                for item in ingredients_data
            ])
        return instance