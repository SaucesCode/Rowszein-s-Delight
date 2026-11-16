from django.urls import path

from .views import (ConfirmOrderView, DeclineOrderView, OrderStatusView, OwnerOrderDetailView, OwnerOrderListView,
                    PlaceOrderView)

urlpatterns = [
    path('', PlaceOrderView.as_view(), name='order-place'),
    path('status/<str:token>/', OrderStatusView.as_view(), name='order-status'),
    path('manage/', OwnerOrderListView.as_view(), name='order-manage-list'),
    path('manage/<int:pk>/', OwnerOrderDetailView.as_view(), name='order-manage-detail'),
    path('manage/<int:pk>/confirm/', ConfirmOrderView.as_view(), name='order-confirm'),
    path('manage/<int:pk>/decline/', DeclineOrderView.as_view(), name='order-decline'),
]
