"""Bounded, allowlisted read contracts; never changes business write services."""
import re
from decimal import Decimal
from django.db import connection
from django.db.models import Q, F, Sum, Count, DecimalField, ExpressionWrapper, Value, FloatField
from django.db.models.functions import Coalesce, NullIf, Cast
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from accounts.permissions import business_role
from ingredients.models import Ingredient


def invalid():
    raise ValidationError({'parameters': 'Unsupported or malformed listing parameters.'})


def positive(value, maximum=9223372036854775807):
    if not re.fullmatch(r'[1-9][0-9]{0,18}', value) or int(value)>maximum:
        invalid()
    return int(value)


class ListingPagination(PageNumberPagination):
    page_size=20
    page_size_query_param='page_size'
    max_page_size=20
    def get_page_number(self, request, paginator):
        value=request.query_params.get('page', '').strip() or '1'
        return paginator.num_pages if value in self.last_page_strings else int(value)


class CatalogListing:
    pagination_class=ListingPagination
    listing_kind=None

    def filter_queryset(self, queryset):
        kind=self.listing_kind
        owner=business_role(self.request.user)=='admin'
        extra={'products': {'category','is_available','is_featured','category_active'},
            'categories': {'is_active'},'ingredients': {'unit','status'}|({'category'} if owner else set()),'recipes': {'category'}}[kind]
        allowed={'page','page_size','search','ordering','id','format'}|extra
        raw=self.request.query_params
        if any(key not in allowed or len(raw.getlist(key))!=1 for key in raw): invalid()
        params={key:value.strip() for key,value in raw.items() if value.strip()}
        for key,maximum in [('page',999999999),('page_size',20)]:
            if key in params and not (key=='page' and params[key] in self.pagination_class.last_page_strings):
                positive(params[key],maximum)
        if 'id' in params: queryset=queryset.filter(pk=positive(params['id']))
        if 'category' in params:
            if kind=='ingredients':
                if params['category'] not in Ingredient.Category.values: invalid()
                queryset=queryset.filter(category=params['category'])
            else:
                path='product__category_id' if kind=='recipes' else 'category_id'
                queryset=queryset.filter(**{path:positive(params['category'])})
        for key,path in [('is_available','is_available'),('is_featured','is_featured'),('category_active','category__is_active'),('is_active','is_active')]:
            if key in params:
                if params[key] not in ['true','false']: invalid()
                queryset=queryset.filter(**{path:params[key]=='true'})
        search=params.get('search','')
        if len(search)>100: invalid()
        fields={'products':['name','description'],'categories':['name','description'],
            'ingredients':['name']+(['category','supplier'] if owner else []),'recipes':['product__name']}[kind]
        if search:
            query=Q()
            for field in fields: query|=Q(**{field+'__icontains':search})
            queryset=queryset.filter(query)
        orders={'products': {'name':'name','price':'price'},
            'categories': {'name':'name','sort_order':'sort_order'},
            'ingredients': {'name':'name','quantity':'quantity'},
            'recipes': {'name':'product__name'}}[kind]
        if kind=='products' and owner:
            orders['created_at']='created_at'
        if kind=='ingredients':
            if 'unit' in params:
                if params['unit'] not in Ingredient.Unit.values: invalid()
                queryset=queryset.filter(unit=params['unit'])
            if 'status' in params:
                conditions={'out_of_stock':Q(quantity__lte=0),'low_stock':Q(quantity__gt=0,quantity__lte=F('minimum_stock')),
                    'healthy':Q(quantity__gt=0)&Q(quantity__gt=F('minimum_stock'))}
                if params['status'] not in conditions: invalid()
                queryset=queryset.filter(conditions[params['status']])
            if owner: orders.update(minimum_stock='minimum_stock',cost_per_unit='cost_per_unit',value='_listing_value')
        ordering=params.get('ordering','sort_order' if kind=='categories' else 'name')
        token=ordering.removeprefix('-')
        if kind=='recipes' and ordering=='most_ingredients':
            queryset=queryset.annotate(_ingredients=Count('recipe_ingredients'))
            column='-_ingredients'
        elif kind=='recipes' and ordering in ['batch_cost_desc','cost_per_unit_asc']:
            money=DecimalField(max_digits=40,decimal_places=12)
            queryset=queryset.annotate(_batch=Coalesce(Sum(F('recipe_ingredients__quantity')*F('recipe_ingredients__ingredient__cost_per_unit'),output_field=money),Value(Decimal('0'),output_field=money)))
            column='-_batch'
            if ordering=='cost_per_unit_asc':
                # SQLite otherwise integer-divides numeric values stored as integers.
                # This read-only ranking never supplies serialized recipe costs.
                divisor=NullIf(Cast('yield_quantity',FloatField()),Value(0.0)) if connection.vendor=='sqlite' else NullIf(F('yield_quantity'),0)
                unit_cost=ExpressionWrapper(F('_batch')/divisor,output_field=money)
                queryset=queryset.annotate(_unit=Coalesce(unit_cost,F('_batch'),output_field=money))
                column='_unit'
        else:
            if token not in orders: invalid()
            column=('-' if ordering.startswith('-') else '')+orders[token]
            if token=='value':
                queryset=queryset.annotate(_listing_value=ExpressionWrapper(F('quantity')*F('cost_per_unit'),output_field=DecimalField(max_digits=40,decimal_places=11)))
        # Category sort-order ties retain the original name ordering.
        return queryset.order_by(column,*(['name'] if kind=='categories' and token=='sort_order' else []),'pk')
