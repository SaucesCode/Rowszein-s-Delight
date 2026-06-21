from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, F
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import datetime, date

from sales.models import Sale, SaleItem
from expenses.models import Expense
from ingredients.models import Ingredient
from ingredients.serializers import IngredientSerializer
from products.models import Product
from recipes.models import Recipe


def parse_date(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        current_year = today.year

        # --- Date filters ---
        date_from = parse_date(request.query_params.get('date_from'))
        date_to = parse_date(request.query_params.get('date_to'))

        # Default to current year if no filters
        if not date_from:
            date_from = date(current_year, 1, 1)
        if not date_to:
            date_to = today

        # --- Filtered Totals ---
        total_sales = Sale.objects.filter(
            date__gte=date_from,
            date__lte=date_to,
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        total_expenses = Expense.objects.filter(
            date__gte=date_from,
            date__lte=date_to,
        ).aggregate(total=Sum('amount'))['total'] or 0

        net_profit = float(total_sales) - float(total_expenses)

        # --- This month (always current month, unaffected by filter) ---
        monthly_sales = Sale.objects.filter(
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        monthly_expenses = Expense.objects.filter(
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        monthly_profit = float(monthly_sales) - float(monthly_expenses)

        # --- Best selling (filtered) ---
        best_selling = (
            SaleItem.objects
            .filter(
                sale__date__gte=date_from,
                sale__date__lte=date_to,
            )
            .values('product__id', 'product__name')
            .annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('subtotal_amount'),
            )
            .order_by('-total_quantity')[:5]
        )

        # --- Monthly chart (filtered year range) ---
        monthly_sales_chart = (
            Sale.objects
            .filter(date__gte=date_from, date__lte=date_to)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('total_amount'))
            .order_by('month')
        )

        monthly_expenses_chart = (
            Expense.objects
            .filter(date__gte=date_from, date__lte=date_to)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ]

        sales_by_month = {
            entry['month'].month: float(entry['total'])
            for entry in monthly_sales_chart
        }
        expenses_by_month = {
            entry['month'].month: float(entry['total'])
            for entry in monthly_expenses_chart
        }

        chart_data = [
            {
                'month': months[i],
                'sales': sales_by_month.get(i + 1, 0),
                'expenses': expenses_by_month.get(i + 1, 0),
                'profit': sales_by_month.get(i + 1, 0) - expenses_by_month.get(i + 1, 0),
            }
            for i in range(12)
        ]

        # --- Low stock (unaffected by date filter) ---
        low_stock = Ingredient.objects.filter(
            minimum_stock__gt=0,
            quantity__lte=F('minimum_stock'),
        )
        low_stock_data = IngredientSerializer(low_stock, many=True).data

        return Response({
            'success': True,
            'data': {
                'filters': {
                    'date_from': date_from.isoformat(),
                    'date_to': date_to.isoformat(),
                },
                'totals': {
                    'total_sales': float(total_sales),
                    'total_expenses': float(total_expenses),
                    'net_profit': net_profit,
                },
                'this_month': {
                    'sales': float(monthly_sales),
                    'expenses': float(monthly_expenses),
                    'profit': monthly_profit,
                },
                'best_selling': [
                    {
                        'product_id': item['product__id'],
                        'product_name': item['product__name'],
                        'total_quantity': item['total_quantity'],
                        'total_revenue': float(item['total_revenue'] or 0),
                    }
                    for item in best_selling
                ],
                'chart_data': chart_data,
                'low_stock': low_stock_data,
            },
            'message': '',
        })


class ProfitMarginView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Product.objects.all().order_by('name')
        result = []

        for product in products:
            selling_price = float(product.price)

            try:
                recipe = Recipe.objects.prefetch_related(
                    'recipe_ingredients__ingredient'
                ).get(product=product)
                production_cost = float(recipe.cost_per_unit)
                has_recipe = True
            except Recipe.DoesNotExist:
                production_cost = 0
                has_recipe = False

            profit_per_unit = selling_price - production_cost
            margin_percent = (
                round((profit_per_unit / selling_price) * 100, 2)
                if selling_price > 0 else 0
            )

            result.append({
                'product_id': product.id,
                'product_name': product.name,
                'selling_price': selling_price,
                'production_cost': production_cost,
                'profit_per_unit': round(profit_per_unit, 2),
                'margin_percent': margin_percent,
                'has_recipe': has_recipe,
                'is_available': product.is_available,
            })

        return Response({
            'success': True,
            'data': result,
            'message': '',
        })