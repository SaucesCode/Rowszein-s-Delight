from accounts.permissions import BusinessPermission, business_role
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Ingredient
from django.db import models
from .serializers import IngredientSerializer
from .serializers import OperationalIngredientSerializer
from .serializers import StockAdjustmentSerializer
from django.db import transaction
from rest_framework.exceptions import APIException, PermissionDenied
from sales.services import adjust_stock, request_identity


class StockProjection:
    def get_serializer_class(self):
        return IngredientSerializer if business_role(self.request.user) == 'admin' else OperationalIngredientSerializer


class IngredientListCreateView(StockProjection, generics.ListCreateAPIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'stock.read', 'POST': 'stock.manage', 'OPTIONS': 'stock.read'}
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


class IngredientDetailView(StockProjection, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'stock.read', 'PUT': 'stock.manage', 'PATCH': 'stock.manage', 'DELETE': 'stock.manage', 'OPTIONS': 'stock.read'}
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

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        self.queryset = Ingredient.objects.select_for_update()
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        if 'quantity' in serializer.validated_data:
            if serializer.validated_data['quantity'] != instance.quantity:
                return Response({'success': False, 'error': 'Use the revision-checked stock adjustment endpoint.'}, status=409)
            serializer.validated_data.pop('quantity')
        if serializer.validated_data.get('unit', instance.unit) != instance.unit and instance.ledger_started_at is not None:
            return Response({'success': False, 'error': 'Tracked units cannot be changed without explicit conversion.'}, status=409)
        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Ingredient updated successfully.',
        })

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        self.queryset = Ingredient.objects.select_for_update()
        instance = self.get_object()
        if instance.ledger_started_at is not None or instance.recipe_ingredients.exists():
            return Response({'success': False, 'error': 'Referenced or tracked inventory must be retained.'}, status=409)
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Ingredient deleted successfully.',
        }, status=status.HTTP_200_OK)


class LowStockIngredientView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'stock.read', 'OPTIONS': 'stock.read'}

    def get(self, request):
        # Get all ingredients where quantity <= minimum_stock
        # Exclude ingredients where minimum_stock is 0 (not configured)
        low_stock = Ingredient.objects.filter(
            minimum_stock__gt=0,
            quantity__lte=models.F('minimum_stock'),
        )

        projection = IngredientSerializer if business_role(request.user) == 'admin' else OperationalIngredientSerializer
        serializer = projection(low_stock, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data,
            'message': '',
        })


class StockAdjustmentView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'POST': 'stock.adjust', 'OPTIONS': 'stock.adjust'}

    def post(self, request, pk):
        serializer = StockAdjustmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'success': False, 'error': serializer.errors}, status=400)
        try:
            key, revision = request_identity(request.headers.get('Idempotency-Key'), request.headers.get('If-Match'), True)
            result = adjust_stock(actor=request.user, key=key, ingredient_id=pk, expected_revision=revision, **serializer.validated_data)
        except PermissionDenied:
            raise
        except APIException as error:
            return Response({'success': False, 'error': error.detail}, status=error.status_code)
        response = Response(result.body, status=result.status)
        response['Idempotency-Replayed'] = 'true' if result.replayed else 'false'
        return response
