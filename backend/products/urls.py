from django.urls import path
from .views import (
    AssortmentDetailView,
    AssortmentListCreateView,
    BoxSizeDetailView,
    BoxSizeListCreateView,
    CategoryDetailView,
    CategoryListCreateView,
    ProductDetailView,
    ProductListCreateView,
    PublicBoxesView,
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('boxes/', PublicBoxesView.as_view(), name='public-boxes'),
    path('box-sizes/', BoxSizeListCreateView.as_view(), name='box-size-list-create'),
    path('box-sizes/<int:pk>/', BoxSizeDetailView.as_view(), name='box-size-detail'),
    path('assortments/', AssortmentListCreateView.as_view(), name='assortment-list-create'),
    path('assortments/<int:pk>/', AssortmentDetailView.as_view(), name='assortment-detail'),
    path('', ProductListCreateView.as_view(), name='product-list-create'),
    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
]
