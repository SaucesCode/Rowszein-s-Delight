from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Recipe
from .serializers import RecipeSerializer
from django.db import transaction
from products.models import Product


class RecipeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RecipeSerializer
    queryset = Recipe.objects.select_related(
        'product'
    ).prefetch_related(
        'recipe_ingredients__ingredient'
    )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({
            'success': True,
            'data': response.data,
            'message': '',
        })

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        list(Product.objects.select_for_update().filter(pk=serializer.validated_data['product'].pk).order_by('pk'))
        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Recipe created successfully.',
        }, status=status.HTTP_201_CREATED)


class RecipeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RecipeSerializer
    queryset = Recipe.objects.select_related(
        'product'
    ).prefetch_related(
        'recipe_ingredients__ingredient'
    )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': '',
        })

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        product_ids = {instance.product_id, serializer.validated_data.get('product', instance.product).pk}
        list(Product.objects.select_for_update().filter(pk__in=product_ids).order_by('pk'))
        # Reload after locks: serialization must not write a stale recipe.
        instance = Recipe.objects.select_for_update().get(pk=instance.pk)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Recipe updated successfully.',
        })

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        list(Product.objects.select_for_update().filter(pk=instance.product_id).order_by('pk'))
        instance = Recipe.objects.select_for_update().get(pk=instance.pk)
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Recipe deleted successfully.',
        }, status=status.HTTP_200_OK)
