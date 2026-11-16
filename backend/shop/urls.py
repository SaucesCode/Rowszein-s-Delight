from django.urls import path

from .views import ManageShopSettingsView, PublicShopSettingsView

urlpatterns = [
    path('settings/', PublicShopSettingsView.as_view(), name='shop-settings'),
    path('settings/manage/', ManageShopSettingsView.as_view(), name='shop-settings-manage'),
]
