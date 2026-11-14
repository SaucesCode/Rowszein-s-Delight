from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import BusinessPermission

from .serializers import ShopSettingsInputSerializer, flatten_errors, managed_document, public_document
from .services import StaleRevision, save_settings


def _ok(data, message=''):
    return Response({'success': True, 'data': data, 'message': message})


class PublicShopSettingsView(APIView):
    """What the shop shows customers: contact links, delivery hours and towns, days off, ordering rules."""
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'catalog.public', 'OPTIONS': 'catalog.read'}

    def get(self, request):
        return _ok(public_document())


class ManageShopSettingsView(APIView):
    """The owner's Shop settings page. PUT replaces the whole document."""
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'shop.manage', 'PUT': 'shop.manage', 'OPTIONS': 'shop.manage'}

    def get(self, request):
        return _ok(managed_document())

    def put(self, request):
        serializer = ShopSettingsInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'success': False, 'error': flatten_errors(serializer.errors)},
                            status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            save_settings(request.user, data, data['revision'])
        except StaleRevision:
            return Response({
                'success': False,
                'error': {'code': 'conflict',
                          'message': 'These settings were changed in another tab or by someone else.'},
                'data': managed_document(),
            }, status=status.HTTP_409_CONFLICT)
        return _ok(managed_document(), 'Shop settings saved.')
