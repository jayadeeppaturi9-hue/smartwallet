from rest_framework import serializers
from .models import AnalysisResult


class AnalysisResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisResult
        fields = [
            'id',
            'investigation',
            'analysis_type',
            'summary',
            'result',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
