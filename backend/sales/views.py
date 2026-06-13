from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from datetime import datetime

from .models import Sale
from .serializers import SaleSerializer
from .services import deduct_inventory_for_sale, restore_inventory_for_sale


def parse_date(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


class SaleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SaleSerializer

    def get_queryset(self):
        queryset = Sale.objects.prefetch_related('sale_items__product')

        date_from = parse_date(self.request.query_params.get('date_from'))
        date_to = parse_date(self.request.query_params.get('date_to'))

        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset

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

        sale = serializer.save()
        deduct_inventory_for_sale(sale)

        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Sale recorded successfully.',
        }, status=status.HTTP_201_CREATED)


class SaleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SaleSerializer
    queryset = Sale.objects.prefetch_related('sale_items__product')

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

        restore_inventory_for_sale(instance)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        sale = serializer.save()
        deduct_inventory_for_sale(sale)

        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Sale updated successfully.',
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        restore_inventory_for_sale(instance)
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Sale deleted successfully.',
        }, status=status.HTTP_200_OK)