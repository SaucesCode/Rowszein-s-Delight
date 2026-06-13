from django.urls import path
from .views import (
    SaleListCreateView,
    SaleDetailView,
    SaleExportCSVView,
    SaleExportPDFView,
)

urlpatterns = [
    path('', SaleListCreateView.as_view(), name='sale-list-create'),
    path('<int:pk>/', SaleDetailView.as_view(), name='sale-detail'),
    path('export/csv/', SaleExportCSVView.as_view(), name='sale-export-csv'),
    path('export/pdf/', SaleExportPDFView.as_view(), name='sale-export-pdf'),
]