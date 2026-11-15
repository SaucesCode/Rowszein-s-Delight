from django.urls import path

from .views import OrderStatusView, PlaceOrderView

urlpatterns = [
    path('', PlaceOrderView.as_view(), name='order-place'),
    path('status/<str:token>/', OrderStatusView.as_view(), name='order-status'),
]
