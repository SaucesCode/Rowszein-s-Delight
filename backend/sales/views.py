from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from datetime import datetime
import csv
import io

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .models import Sale
from .serializers import SaleSerializer
from .services import deduct_inventory_for_sale, restore_inventory_for_sale


def parse_date(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


class SaleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SaleSerializer

    def get_queryset(self):
        queryset = Sale.objects.prefetch_related('sale_items__product')
        date_from = parse_date(self.request.query_params.get('date_from'))
        date_to = parse_date(self.request.query_params.get('date_to'))
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        return queryset

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

        sale = serializer.save()
        deduct_inventory_for_sale(sale)

        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Sale recorded successfully.',
        }, status=status.HTTP_201_CREATED)


class SaleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SaleSerializer
    queryset = Sale.objects.prefetch_related('sale_items__product')

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
        instance = self.get_object()
        restore_inventory_for_sale(instance)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)
        sale = serializer.save()
        deduct_inventory_for_sale(sale)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Sale updated successfully.',
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        restore_inventory_for_sale(instance)
        instance.delete()
        return Response({
            'success': True,
            'data': None,
            'message': 'Sale deleted successfully.',
        }, status=status.HTTP_200_OK)


class SaleExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Sale.objects.prefetch_related('sale_items__product')
        date_from = parse_date(request.query_params.get('date_from'))
        date_to = parse_date(request.query_params.get('date_to'))
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="sales.csv"'

        writer = csv.writer(response)
        writer.writerow(['Sale ID', 'Date', 'Items', 'Notes', 'Total Amount'])

        for sale in queryset:
            items_summary = ', '.join(
                f"{item.product.name} x{item.quantity}"
                for item in sale.sale_items.all()
            )
            writer.writerow([
                sale.id,
                sale.date,
                items_summary,
                sale.notes,
                sale.total_amount,
            ])

        return response


class SaleExportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Sale.objects.prefetch_related('sale_items__product')
        date_from = parse_date(request.query_params.get('date_from'))
        date_to = parse_date(request.query_params.get('date_to'))
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph("Sales Report", styles['Title']))
        elements.append(Paragraph(
            f"Rowszein's Delight — Generated {datetime.now().strftime('%B %d, %Y')}",
            styles['Normal']
        ))
        elements.append(Spacer(1, 20))

        table_data = [['Sale ID', 'Date', 'Items', 'Notes', 'Total']]

        total_revenue = 0
        for sale in queryset:
            items_summary = ', '.join(
                f"{item.product.name} x{item.quantity}"
                for item in sale.sale_items.all()
            )
            table_data.append([
                str(sale.id),
                str(sale.date),
                items_summary,
                sale.notes or '—',
                f"₱{sale.total_amount:,.2f}",
            ])
            total_revenue += float(sale.total_amount)

        table_data.append(['', '', '', 'Total Revenue', f"₱{total_revenue:,.2f}"])

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