from django.urls import path
from .views import DashboardView, ProfitMarginView

urlpatterns = [
    path('', DashboardView.as_view(), name='dashboard'),
    path('profit-margins/', ProfitMarginView.as_view(), name='profit-margins'),
]