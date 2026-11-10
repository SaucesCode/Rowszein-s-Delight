from django.contrib.admin.apps import AdminConfig


class BusinessAdminConfig(AdminConfig):
    default_site = 'accounts.admin_site.BusinessAdminSite'
