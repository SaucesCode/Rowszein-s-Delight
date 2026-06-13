from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Ingredient
from django.db import models
from .serializers import IngredientSerializer


class IngredientListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IngredientSerializer
    queryset = Ingredient.objects.all()

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({
            'success': True,
            'data': response.data,
            'message': '',
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Ingredient created successfully.',
        }, status=status.HTTP_201_CREATED)


class IngredientDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IngredientSerializer
    queryset = Ingredient.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': '',
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Ingredient updated successfully.',
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Ingredient deleted successfully.',
        }, status=status.HTTP_200_OK)


class LowStockIngredientView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get all ingredients where quantity <= minimum_stock
        # Exclude ingredients where minimum_stock is 0 (not configured)
        low_stock = Ingredient.objects.filter(
            minimum_stock__gt=0,
            quantity__lte=models.F('minimum_stock'),
        )

        serializer = IngredientSerializer(low_stock, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': '',
        })