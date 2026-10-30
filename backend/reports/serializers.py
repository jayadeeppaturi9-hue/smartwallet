from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = [
            'id',
            'investigation',
            'title',
            'reference_id',
            'wallet_address',
            'summary',
            'findings',
            'status',
            'risk_level',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'reference_id',
            'summary',
            'findings',
            'status',
            'risk_level',
            'created_at',
            'updated_at',
        ]


class CreateReportSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    wallet_address = serializers.CharField(max_length=128, required=False, allow_blank=True)
    investigation_id = serializers.IntegerField(required=False)
    format = serializers.CharField(default='json')
