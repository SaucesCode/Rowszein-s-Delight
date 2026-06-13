from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from sales.models import Sale, SaleItem
from expenses.models import Expense


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        current_year = today.year

        # --- Totals ---
        total_sales = Sale.objects.aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        total_expenses = Expense.objects.aggregate(
            total=Sum('amount')
        )['total'] or 0

        net_profit = float(total_sales) - float(total_expenses)

        # --- This month ---
        monthly_sales = Sale.objects.filter(
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        monthly_expenses = Expense.objects.filter(
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        monthly_profit = float(monthly_sales) - float(monthly_expenses)

        # --- Best selling products (top 5) ---
        best_selling = (
            SaleItem.objects
            .values('product__id', 'product__name')
            .annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('subtotal_amount'),
            )
            .order_by('-total_quantity')[:5]
        )

        # --- Monthly breakdown for current year ---
        monthly_sales_chart = (
            Sale.objects
            .filter(date__year=current_year)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('total_amount'))
            .order_by('month')
        )

        monthly_expenses_chart = (
            Expense.objects
            .filter(date__year=current_year)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        # Build chart data — all 12 months
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

        return Response({
            'success': True,
            'data': {
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
            },
            'message': '',
        })