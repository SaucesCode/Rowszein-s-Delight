from accounts.permissions import BusinessPermission, visible_sales
from backend.date_filters import MANILA, filter_by_business_date, report_date_bounds
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from datetime import datetime
from decimal import Decimal, localcontext
import csv
import io

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .models import Sale
from .serializers import SaleSerializer, CancellationSerializer
from .services import execute_sale, request_identity, current_items, sale_data
from rest_framework.exceptions import APIException, PermissionDenied
from django.utils import timezone
from .reporting import financial_summary


def command_response(request, *, action, data=None, pk=None, reason=''):
    try:
        key, revision = request_identity(request.headers.get('Idempotency-Key'), request.headers.get('If-Match'), action != 'sale_create')
        result = execute_sale(action=action, actor=request.user, key=key, expected_revision=revision,
                              data=data, sale_id=pk, reason=reason)
    except PermissionDenied:
        raise
    except APIException as error:
        return Response({'success': False, 'error': error.detail}, status=error.status_code)
    response = Response(result.body, status=result.status)
    response['Idempotency-Replayed'] = 'true' if result.replayed else 'false'
    response['ETag'] = f'"{result.body["data"]["revision"]}"'
    return response


class SaleListCreateView(generics.ListCreateAPIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'sales.read', 'POST': 'sales.create', 'OPTIONS': 'sales.read'}
    serializer_class = SaleSerializer

    def get_queryset(self):
        queryset = visible_sales(Sale.objects.prefetch_related('sale_items__product'), self.request.user)
        return filter_by_business_date(queryset, self.request.query_params)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({
            'success': True,
            'data': response.data,
            'message': '',
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        return command_response(request, action='sale_create', data=serializer.validated_data)


class SaleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'sales.read', 'PUT': 'sales.update', 'PATCH': 'sales.update', 'DELETE': 'sales.cancel', 'OPTIONS': 'sales.read'}
    serializer_class = SaleSerializer
    queryset = Sale.objects.prefetch_related('sale_items__product')

    def get_queryset(self):
        return visible_sales(super().get_queryset(), self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': '',
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        # Validate shape/values before the service obtains locks or writes.
        serializer = self.get_serializer(data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)
        return command_response(request, action='sale_update', pk=kwargs['pk'], data=serializer.validated_data)

    def destroy(self, request, *args, **kwargs):
        serializer = CancellationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'success': False, 'error': serializer.errors}, status=400)
        return command_response(request, action='sale_cancel', pk=kwargs['pk'], reason=serializer.validated_data['reason'])


class SaleFinancialSummaryView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'finance.read', 'OPTIONS': 'finance.read'}

    def get(self, request):
        date_from, date_to = report_date_bounds(request.query_params, timezone.localdate(timezone=MANILA))
        return Response({'success': True, 'data': financial_summary(date_from, date_to), 'message': ''})


class SaleExportCSVView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'sales.export', 'OPTIONS': 'sales.export'}

    def get(self, request):
        queryset = filter_by_business_date(Sale.objects.prefetch_related('sale_items__product'), request.query_params)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="sales.csv"'

        writer = csv.writer(response)
        writer.writerow(['Sale ID', 'Original Date', 'Status', 'Current Items', 'Notes', 'Original Amount', 'Current Transaction Value (not net sales)'])

        for sale in queryset:
            items_summary = ', '.join(f"{item['product_name']} x{item['quantity']}" for item in current_items(sale))
            writer.writerow([
                sale.id,
                sale.date,
                sale.status,
                items_summary,
                sale.notes,
                sale.total_amount,
                sale_data(sale)['total_amount'],
            ])

        return response


class SaleExportPDFView(APIView):
    permission_classes = [BusinessPermission]
    business_actions = {'GET': 'sales.export', 'OPTIONS': 'sales.export'}

    def get(self, request):
        queryset = filter_by_business_date(Sale.objects.prefetch_related('sale_items__product'), request.query_params)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph("Sales History (not posting-date net sales)", styles['Title']))
        elements.append(Paragraph("Original transaction values include cancelled records. For gross, adjustments, cancellations and net sales use the posting-date financial report. Cancellation does not record a cash refund.", styles['Normal']))
        elements.append(Paragraph(
            f"Rowszein's Delight — Generated {datetime.now().strftime('%B %d, %Y')}",
            styles['Normal']
        ))
        elements.append(Spacer(1, 20))

        table_data = [['Sale ID', 'Date', 'Items', 'Notes', 'Total']]

        total_revenue = Decimal('0.00')
        for sale in queryset:
            items_summary = ', '.join(
                f"{item.product.name} x{item.quantity}"
                for item in sale.sale_items.all()
            )
            table_data.append([
                f"{sale.id} ({sale.status})",
                str(sale.date),
                items_summary,
                sale.notes or '—',
                f"₱{sale.total_amount:,.2f}",
            ])
            with localcontext() as context:
                context.prec = 50
                total_revenue += sale.total_amount

        table_data.append(['', '', '', 'Original values', f"₱{total_revenue:,.2f}"])

        table = Table(table_data, colWidths=[50, 70, 180, 100, 80])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ]))

        elements.append(table)
        doc.build(elements)

        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="sales.pdf"'
        return response
