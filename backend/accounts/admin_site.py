from django.contrib.admin import AdminSite
from django.contrib.admin.forms import AdminAuthenticationForm
from .permissions import business_role


class BusinessAdminAuthenticationForm(AdminAuthenticationForm):
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if business_role(user) != 'admin':
            raise self.get_invalid_login_error()


class BusinessAdminSite(AdminSite):
    login_form = BusinessAdminAuthenticationForm

    def has_permission(self, request):
        return super().has_permission(request) and business_role(request.user) == 'admin'
