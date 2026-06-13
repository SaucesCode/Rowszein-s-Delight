from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source='get_category_display',
        read_only=True,
    )

    class Meta:
        model = Expense
        fields = [
            'id',
            'category',
            'category_display',
            'amount',
            'description',
            'date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'category_display', 'created_at', 'updated_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value