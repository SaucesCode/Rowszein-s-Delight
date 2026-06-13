from django.urls import path
from .views import (
    ExpenseListCreateView,
    ExpenseDetailView,
    ExpenseExportCSVView,
    ExpenseExportPDFView,
)

urlpatterns = [
    path('', ExpenseListCreateView.as_view(), name='expense-list-create'),
    path('<int:pk>/', ExpenseDetailView.as_view(), name='expense-detail'),
    path('export/csv/', ExpenseExportCSVView.as_view(), name='expense-export-csv'),
    path('export/pdf/', ExpenseExportPDFView.as_view(), name='expense-export-pdf'),
]