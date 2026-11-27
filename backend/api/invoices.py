from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from pathlib import Path

from django.db import transaction
from django.http import FileResponse
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError

from .booking_views import StaffOnly
from .models import Invoice, InvoiceItem


CENT = Decimal('0.01')


def invoice_totals(items, tax_rate, amount_paid):
    line_amounts = [(quantity * price).quantize(CENT, rounding=ROUND_HALF_UP) for quantity, price in items]
    subtotal = sum(line_amounts, Decimal('0.00'))
    tax = (subtotal * tax_rate / 100).quantize(CENT, rounding=ROUND_HALF_UP)
    total = subtotal + tax
    return line_amounts, subtotal, tax, total, total - amount_paid


class InvoiceItemSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal('0.01'))
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'))

    class Meta:
        model = InvoiceItem
        fields = ['description', 'quantity', 'unit_price']


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, allow_empty=False, max_length=50)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal('0'), max_value=Decimal('100'))
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'))
    subtotal = serializers.SerializerMethodField()
    tax_amount = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'number', 'issue_date', 'due_date', 'currency',
            'issuer_name', 'issuer_address', 'issuer_email', 'issuer_phone', 'issuer_tax_id',
            'client_name', 'client_contact', 'client_address', 'client_email', 'client_phone', 'client_tax_id',
            'service_details', 'payment_instructions', 'booking_terms', 'notes',
            'tax_rate', 'amount_paid', 'items', 'subtotal', 'tax_amount', 'total', 'balance_due',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'number', 'subtotal', 'tax_amount', 'total', 'balance_due', 'created_at', 'updated_at']

    def validate(self, attrs):
        if attrs.get('due_date') and attrs['due_date'] < attrs['issue_date']:
            raise serializers.ValidationError({'due_date': 'Due date cannot be before the invoice date.'})
        items = [(item['quantity'], item['unit_price']) for item in attrs['items']]
        if invoice_totals(items, attrs['tax_rate'], attrs['amount_paid'])[-1] < 0:
            raise serializers.ValidationError({'amount_paid': 'Amount paid cannot exceed the invoice total.'})
        return attrs

    def _totals(self, invoice):
        if not hasattr(invoice, '_calculated_totals'):
            invoice._calculated_totals = invoice_totals(
                ((item.quantity, item.unit_price) for item in invoice.items.all()),
                invoice.tax_rate,
                invoice.amount_paid,
            )
        return invoice._calculated_totals

    def get_subtotal(self, invoice):
        return f'{self._totals(invoice)[1]:.2f}'

    def get_tax_amount(self, invoice):
        return f'{self._totals(invoice)[2]:.2f}'

    def get_total(self, invoice):
        return f'{self._totals(invoice)[3]:.2f}'

    def get_balance_due(self, invoice):
        return f'{self._totals(invoice)[4]:.2f}'

    def create(self, validated_data):
        items = validated_data.pop('items')
        invoice = Invoice.objects.create(**validated_data)
        self._replace_items(invoice, items)
        return invoice

    def update(self, instance, validated_data):
        items = validated_data.pop('items')
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._replace_items(instance, items)
        return instance

    @staticmethod
    def _replace_items(invoice, items):
        invoice.items.all().delete()
        InvoiceItem.objects.bulk_create([
            InvoiceItem(invoice=invoice, position=index, **item)
            for index, item in enumerate(items)
        ])
        invoice._prefetched_objects_cache = {}


def build_invoice_document(invoice):
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    document.styles['Normal'].font.size = Pt(10)

    logo = document.add_paragraph()
    logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    logo.add_run().add_picture(str(Path(__file__).with_name('invoice-logo.png')), width=Inches(1.1))
    heading = document.add_heading('INVOICE', level=0)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    document.add_paragraph(
        f'Invoice number: {invoice.number}\nInvoice date: {invoice.issue_date.isoformat()}'
        + (f'\nDue date: {invoice.due_date.isoformat()}' if invoice.due_date else '')
        + f'\nCurrency: {invoice.currency}'
    )

    def add_party(title, name, address, email, phone, tax_id, contact=''):
        document.add_heading(title, level=2)
        lines = [name, contact, address, f'Email: {email}' if email else '',
                 f'Phone: {phone}' if phone else '', f'Tax ID: {tax_id}' if tax_id else '']
        document.add_paragraph('\n'.join(line for line in lines if line))

    add_party('From', invoice.issuer_name, invoice.issuer_address, invoice.issuer_email,
              invoice.issuer_phone, invoice.issuer_tax_id)
    add_party('Bill to', invoice.client_name, invoice.client_address, invoice.client_email,
              invoice.client_phone, invoice.client_tax_id, invoice.client_contact)
    if invoice.service_details:
        document.add_heading('Trip / service details', level=2)
        document.add_paragraph(invoice.service_details)

    items = list(invoice.items.all())
    line_amounts, subtotal, tax, total, balance = invoice_totals(
        ((item.quantity, item.unit_price) for item in items), invoice.tax_rate, invoice.amount_paid,
    )
    table = document.add_table(rows=1, cols=4)
    table.style = 'Table Grid'
    for cell, label in zip(table.rows[0].cells, ['Description', 'Quantity', 'Unit price', 'Amount']):
        cell.text = label
        for run in cell.paragraphs[0].runs:
            run.bold = True
    for item, amount in zip(items, line_amounts):
        cells = table.add_row().cells
        cells[0].text = item.description
        cells[1].text = f'{item.quantity:.2f}'
        cells[2].text = f'{invoice.currency} {item.unit_price:,.2f}'
        cells[3].text = f'{invoice.currency} {amount:,.2f}'

    totals = document.add_paragraph()
    totals.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    totals.add_run(
        f'Subtotal: {invoice.currency} {subtotal:,.2f}\n'
        f'Tax ({invoice.tax_rate:.2f}%): {invoice.currency} {tax:,.2f}\n'
        f'Total: {invoice.currency} {total:,.2f}\n'
        f'Amount paid: {invoice.currency} {invoice.amount_paid:,.2f}\n'
    )
    totals.add_run(f'Balance due: {invoice.currency} {balance:,.2f}').bold = True

    for title, text in [
        ('Payment instructions', invoice.payment_instructions),
        ('Booking terms', invoice.booking_terms),
        ('Notes', invoice.notes),
    ]:
        if text:
            document.add_heading(title, level=2)
            document.add_paragraph(text)
    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [StaffOnly]
    http_method_names = ['get', 'post', 'put', 'head', 'options']

    def get_queryset(self):
        queryset = Invoice.objects.prefetch_related('items')
        return queryset.select_for_update() if self.action in ('update', 'document') else queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    @transaction.atomic
    def document(self, request, pk=None):
        invoice = self.get_object()
        if not invoice.items.exists():
            raise ValidationError({'detail': 'This invoice has no line items.'})
        response = FileResponse(
            build_invoice_document(invoice),
            as_attachment=True,
            filename=f'{invoice.number}.docx',
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        response['Cache-Control'] = 'no-store'
        return response
