from django.db import models


class AnalysisResult(models.Model):
    """
    Stores structured forensic analysis output generated during an investigation.
    Allows specialized modules (fund flow, graph, attribution, risk) to persist their structured JSON telemetry.
    """
    ANALYSIS_TYPE_CHOICES = (
        ('TRANSACTION_ANALYSIS', 'Transaction Pattern Analysis'),
        ('FUND_FLOW_ANALYSIS', 'Fund Flow Direction Analysis'),
        ('GRAPH_ANALYSIS', 'Graph Relationship & Hop Analysis'),
        ('VASP_ATTRIBUTION', 'VASP Candidate Attribution Scoring'),
        ('RISK_ANALYSIS', 'Risk & Exposure Assessment'),
    )

    investigation = models.ForeignKey(
        'investigations.Investigation',
        related_name='analysis_results',
        on_delete=models.CASCADE
    )
    analysis_type = models.CharField(
        max_length=50,
        choices=ANALYSIS_TYPE_CHOICES,
        db_index=True
    )
    summary = models.TextField(blank=True, default='')
    result = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['investigation', 'analysis_type']),
            models.Index(fields=['analysis_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.investigation.id} - {self.analysis_type} ({self.created_at:%Y-%m-%d %H:%M})"
