"""Explicit business capabilities. Django technical flags never grant them."""
from django.db import connection
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

STAFF = frozenset({'self.read', 'catalog.read', 'stock.read', 'sales.read', 'sales.create'})
OWNER = STAFF | frozenset({'catalog.manage', 'stock.manage', 'stock.adjust', 'recipes.manage',
    'sales.update', 'sales.cancel', 'sales.export', 'finance.read', 'expenses.manage', 'partners.pay'})
ROLE_CAPABILITIES = {'staff': STAFF, 'admin': OWNER}
COMMAND_CAPABILITIES = {'sale_create':'sales.create', 'sale_update':'sales.update',
    'sale_cancel':'sales.cancel', 'stock_adjust':'stock.adjust'}


def business_role(user):
    if user and user.is_authenticated and user.is_active and user.role in ROLE_CAPABILITIES:
        return user.role
    return None


def can(user, capability):
    return capability in ROLE_CAPABILITIES.get(business_role(user), ())


def current_actor_role(actor, *, lock=False):
    """Re-read current authority; optionally hold a shared PostgreSQL row lock.

    FOR SHARE allows parallel commands by one actor (including DB-UUID races),
    while serializing against role/active updates until transaction completion.
    Caller must already be inside atomic() when lock=True.
    """
    from .models import User
    if not actor or not actor.pk:
        return None
    table = connection.ops.quote_name(User._meta.db_table)
    suffix = ' FOR SHARE' if lock and connection.vendor == 'postgresql' else ''
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT role, is_active FROM {table} WHERE id = %s{suffix}', [actor.pk])
        row = cursor.fetchone()
    return row[0] if row and row[1] and row[0] in ROLE_CAPABILITIES else None


def authorize_command(actor, action, *, lock=False):
    role = current_actor_role(actor, lock=lock)
    if COMMAND_CAPABILITIES.get(action) not in ROLE_CAPABILITIES.get(role, ()):
        raise PermissionDenied()
    return role


def visible_sales(queryset, user):
    if business_role(user) == 'admin':
        return queryset
    if business_role(user) == 'staff':
        from sales.models import InventoryOperation
        creation = InventoryOperation.objects.filter(actor=user, action='sale_create').values('sale_id')
        return queryset.filter(pk__in=creation, inventory_tracking='tracked', financial_tracking='ledger')
    return queryset.none()


class BusinessPermission(BasePermission):
    """No action mapping means no access, including for an owner."""
    def has_permission(self, request, view):
        method = 'GET' if request.method == 'HEAD' else request.method
        capability = getattr(view, 'business_actions', {}).get(method)
        if capability == 'catalog.public':
            return not request.user.is_authenticated or can(request.user, 'catalog.read')
        return capability is not None and can(request.user, capability)

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False
        from sales.models import Sale
        if isinstance(obj, Sale):
            return visible_sales(Sale.objects.filter(pk=obj.pk), request.user).exists()
        return True
