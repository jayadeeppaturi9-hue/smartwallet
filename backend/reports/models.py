from django.db import models
from django.contrib.auth.models import User


class Report(models.Model):
    """
    Forensic investigation report compiled from actual analysis findings.
    Preserves comprehensive information to reopen and display previously generated reports.
    """
    investigation = models.ForeignKey(
        'investigations.Investigation',
        related_name='reports',
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    title = models.CharField(max_length=255)
    reference_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    wallet_address = models.CharField(max_length=128, db_index=True)

    summary = models.TextField(blank=True, default='')
    findings = models.JSONField(default=dict, blank=True)
    conclusion = models.TextField(blank=True, default='')

    status = models.CharField(max_length=20, default='completed', db_index=True)
    risk_level = models.CharField(max_length=20, default='low')
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        User,
        related_name='reports',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def generated_at(self):
        return self.created_at

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['investigation']),
            models.Index(fields=['wallet_address']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.title} ({self.wallet_address})"


# Model alias for conceptual compliance with specification
InvestigationReport = Report

