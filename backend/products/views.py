from accounts.permissions import BusinessPermission, business_role
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count
from django.db import transaction
from django.db.models.deletion import ProtectedError

from rest_framework.views import APIView

from .boxes import assortments_with_items, shop_assortments, shop_box_sizes
from .models import BoxSize, Category, Product
from .serializers import CategorySerializer, ProductSerializer
from .serializers import OperationalCategorySerializer, OperationalProductSerializer
from .serializers import AssortmentSerializer, BoxSizeSerializer, PublicAssortmentSerializer, PublicBoxSizeSerializer
from accounts.authentication import PublicCatalogAuthentication
from backend.catalog_listing import CatalogListing


class CatalogProjection:
    def get_serializer_class(self):
        if business_role(self.request.user) == 'admin':
            return self.serializer_class
        return self.operational_serializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated:
            if queryset.model is Product:
                return queryset.filter(is_available=True, category__is_active=True)
            return queryset.filter(is_active=True)
        return queryset


class CategoryListCreateView(CatalogListing, CatalogProjection, generics.ListCreateAPIView):
    listing_kind = 'categories'
    authentication_classes = [PublicCatalogAuthentication]
    operational_serializer = OperationalCategorySerializer
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'POST': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.annotate(product_count=Count('products')) if business_role(self.request.user) == 'admin' else queryset

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
            'message': 'Category created successfully.',
        }, status=status.HTTP_201_CREATED)


class CategoryDetailView(CatalogProjection, generics.RetrieveUpdateDestroyAPIView):
    operational_serializer = OperationalCategorySerializer
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.read', 'PUT': 'catalog.manage', 'PATCH': 'catalog.manage', 'DELETE': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = CategorySerializer
    queryset = Category.objects.annotate(product_count=Count('products'))

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
            'message': 'Category updated successfully.',
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Category deleted successfully.',
        }, status=status.HTTP_200_OK)


class ProductListCreateView(CatalogListing, CatalogProjection, generics.ListCreateAPIView):
    listing_kind = 'products'
    authentication_classes = [PublicCatalogAuthentication]
    operational_serializer = OperationalProductSerializer
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'POST': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related('category')
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        return {'request': self.request}

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
            'message': 'Product created successfully.',
        }, status=status.HTTP_201_CREATED)


class ProductDetailView(CatalogProjection, generics.RetrieveUpdateDestroyAPIView):
    operational_serializer = OperationalProductSerializer
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.read', 'PUT': 'catalog.manage', 'PATCH': 'catalog.manage', 'DELETE': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related('category')
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        return {'request': self.request}

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
            'message': 'Product updated successfully.',
        })

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        self.queryset = Product.objects.select_for_update()
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response({'success': False, 'error': 'This product is referenced by retained sales or consumption history and cannot be deleted.'}, status=409)
        return Response({
            'success': True,
            'data': None,
            'message': 'Product deleted successfully.',
        }, status=status.HTTP_200_OK)


# ── Boxes ───────────────────────────────────────────────────────────────────

def _ok(data, message='', status_code=status.HTTP_200_OK):
    return Response({'success': True, 'data': data, 'message': message}, status=status_code)


def _invalid(errors):
    return Response({'success': False, 'error': errors}, status=status.HTTP_400_BAD_REQUEST)


class BoxCatalogView:
    """Owner manages boxes; staff may read them. Small lists, so no paging."""
    permission_classes = [BusinessPermission]
    pagination_class = None
    created_message = ''
    updated_message = ''
    deleted_message = ''

    def list(self, request, *args, **kwargs):
        return _ok(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return _ok(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return _invalid(serializer.errors)
        instance = serializer.save()
        return _ok(self.get_serializer(self.get_queryset().get(pk=instance.pk)).data, self.created_message, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        if not serializer.is_valid():
            return _invalid(serializer.errors)
        instance = serializer.save()
        return _ok(self.get_serializer(self.get_queryset().get(pk=instance.pk)).data, self.updated_message)


class BoxSizeListCreateView(BoxCatalogView, generics.ListCreateAPIView):
    business_actions = {'GET': 'catalog.read', 'POST': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = BoxSizeSerializer
    queryset = BoxSize.objects.all()
    created_message = 'Box size added.'


class BoxSizeDetailView(BoxCatalogView, generics.RetrieveUpdateDestroyAPIView):
    business_actions = {'GET': 'catalog.read', 'PUT': 'catalog.manage', 'PATCH': 'catalog.manage', 'DELETE': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = BoxSizeSerializer
    queryset = BoxSize.objects.all()
    updated_message = 'Box size saved.'

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response({'success': False, 'error': 'Ready-made boxes use this size. Delete them or move them to another size first.'}, status=status.HTTP_409_CONFLICT)
        return _ok(None, 'Box size deleted.')


class AssortmentListCreateView(BoxCatalogView, generics.ListCreateAPIView):
    business_actions = {'GET': 'catalog.read', 'POST': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = AssortmentSerializer
    created_message = 'Ready-made box added.'

    def get_queryset(self):
        return assortments_with_items()


class AssortmentDetailView(BoxCatalogView, generics.RetrieveUpdateDestroyAPIView):
    business_actions = {'GET': 'catalog.read', 'PUT': 'catalog.manage', 'PATCH': 'catalog.manage', 'DELETE': 'catalog.manage', 'OPTIONS': 'catalog.read'}
    serializer_class = AssortmentSerializer
    updated_message = 'Ready-made box saved.'

    def get_queryset(self):
        return assortments_with_items()

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return _ok(None, 'Ready-made box deleted.')


class PublicBoxesView(APIView):
    """What the shop shows: box sizes on sale and ready-made boxes that are complete and on sale."""
    authentication_classes = [PublicCatalogAuthentication]
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def get(self, request):
        return _ok({
            'sizes': PublicBoxSizeSerializer(shop_box_sizes(), many=True).data,
            'assortments': PublicAssortmentSerializer(shop_assortments(), many=True, context={'request': request}).data,
        })
