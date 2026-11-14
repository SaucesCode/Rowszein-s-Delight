from accounts.permissions import BusinessPermission
from backend.date_filters import MANILA, report_date_bounds
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, F
from django.db.models.functions import TruncMonth
from django.utils import timezone

from sales.models import Sale
from expenses.models import Expense
from ingredients.models import Ingredient
from ingredients.serializers import IngredientSerializer
from products.models import Product
from recipes.models import Recipe
from sales.reporting import financial_summary, partner_payouts
from sales.services import current_items
from decimal import Decimal, localcontext


class DashboardView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'finance.read', 'OPTIONS': 'finance.read'}

    def get(self, request):
        today = timezone.localdate(timezone=MANILA)
        date_from, date_to = report_date_bounds(request.query_params, today)

        # --- Filtered Totals ---
        sales_report = financial_summary(date_from, date_to)
        total_sales = Decimal(sales_report['totals']['net_sales'])

        total_expenses = Expense.objects.filter(
            date__gte=date_from,
            date__lte=date_to,
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Partner items: only the patong is Rowszein's; their price is owed to the partner.
        payouts = partner_payouts(date_from, date_to)
        total_payouts = Decimal(payouts['total'])

        with localcontext() as context:
            context.prec = 50
            net_profit = float(total_sales - total_payouts - total_expenses)

        # --- This month (always current month, unaffected by filter) ---
        monthly_sales = Decimal(financial_summary(today.replace(day=1), today)['totals']['net_sales'])
        monthly_payouts = Decimal(partner_payouts(today.replace(day=1), today)['total'])

        monthly_expenses = Expense.objects.filter(
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        with localcontext() as context:
            context.prec = 50
            monthly_profit = float(monthly_sales - monthly_payouts - monthly_expenses)

        # --- Best selling (filtered) ---
        # Current recorded product mix by ORIGINAL sale date, not a financial
        # posting-date ledger. Never aggregate stale original SaleItem rows.
        product_mix = {}
        with localcontext() as context:
            context.prec = 50
            for sale in Sale.objects.filter(date__gte=date_from, date__lte=date_to, status='recorded').prefetch_related('sale_items__product'):
                for item in current_items(sale):
                    row = product_mix.setdefault(item['product'], {'product__id': item['product'], 'product__name': item['product_name'], 'total_quantity': 0, 'total_revenue': Decimal('0')})
                    row['total_quantity'] += item['quantity']
                    row['total_revenue'] += Decimal(item['unit_price']) * item['quantity']
        best_selling = sorted(product_mix.values(), key=lambda row: (-row['total_quantity'], row['product__id']))[:5]

        # --- Monthly chart (filtered year range) ---
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

        sales_by_month = {month: Decimal(values['net_sales']) for month, values in sales_report['months'].items()}
        payouts_by_month = {month: Decimal(value) for month, value in payouts['by_month'].items()}
        expenses_by_month = {
            entry['month'].strftime('%Y-%m'): entry['total']
            for entry in monthly_expenses_chart
        }
        keys = []
        year, month = date_from.year, 1 if date_from.year == date_to.year else date_from.month
        last = date_to.year * 12 + (12 if date_from.year == date_to.year else date_to.month)
        while year * 12 + month <= last:
            keys.append(f'{year:04d}-{month:02d}')
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        with localcontext() as context:
            context.prec = 50
            chart_data = [
                {
                    'month': months[int(key[-2:]) - 1] if date_from.year == date_to.year else key,
                    'sales': float(sales_by_month.get(key, 0)),
                    'expenses': float(expenses_by_month.get(key, 0)),
                    'payouts': float(payouts_by_month.get(key, 0)),
                    'profit': float(sales_by_month.get(key, 0) - payouts_by_month.get(key, 0) - expenses_by_month.get(key, 0)),
                }
                for key in keys
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
                    **sales_report['totals'],
                    'total_sales': float(total_sales),
                    'total_expenses': float(total_expenses),
                    'partner_payouts': payouts['total'],
                    'net_profit': net_profit,
                },
                'this_month': {
                    'sales': float(monthly_sales),
                    'partner_payouts': float(monthly_payouts),
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
                'refund_status': 'not_tracked',
                'product_mix_scope': 'current recorded items by original sale date; not posting-date net sales',
            },
            'message': '',
        })


class ProfitMarginView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'finance.read', 'OPTIONS': 'finance.read'}

    def get(self, request):
        products = Product.objects.all().order_by('name')
        result = []

        for product in products:
            selling_price = float(product.price)
            is_partner = product.partner_id is not None
            has_recipe = False

            if is_partner:
                # Their price is the cost; the profit per item is the patong.
                production_cost = float(product.partner_payout)
            else:
                try:
                    recipe = Recipe.objects.prefetch_related(
                        'recipe_ingredients__ingredient'
                    ).get(product=product)
                    production_cost = float(recipe.cost_per_unit)
                    has_recipe = True
                except Recipe.DoesNotExist:
                    production_cost = 0

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
                'is_partner': is_partner,
                'is_available': product.is_available,
            })

        return Response({
            'success': True,
            'data': result,
            'message': '',
        })
