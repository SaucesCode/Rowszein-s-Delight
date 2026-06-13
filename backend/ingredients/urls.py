from django.urls import path
from .views import IngredientListCreateView, IngredientDetailView, LowStockIngredientView

urlpatterns = [
    path('', IngredientListCreateView.as_view(), name='ingredient-list-create'),
    path('<int:pk>/', IngredientDetailView.as_view(), name='ingredient-detail'),
    path('low-stock/', LowStockIngredientView.as_view(), name='ingredient-low-stock'),
]