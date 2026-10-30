from django.db import models
from django.contrib.auth.models import User


class Investigation(models.Model):
    """
    Forensic investigation case tracking the execution lifecycle and results for a subject wallet.
    All data is driven by real user investigations and real blockchain analysis.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Execution'),
        ('RUNNING', 'Running Analysis'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )

    name = models.CharField(max_length=255, blank=True, null=True)
    reference_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)

    wallet = models.ForeignKey(
        'wallets.Wallet',
        related_name='investigations',
        on_delete=models.CASCADE
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    depth = models.PositiveSmallIntegerField(default=2)
    options = models.JSONField(default=dict, blank=True)

    risk_level = models.CharField(
        max_length=20,
        default='low',
        choices=(
            ('low', 'Low Risk'),
            ('medium', 'Medium Risk'),
            ('high', 'High Risk'),
            ('critical', 'Critical Risk'),
        )
    )

    summary = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        User,
        related_name='investigations',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['wallet']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['reference_id']),
        ]

    def __str__(self):
        label = self.name or self.reference_id or f"Case #{self.id}"
        return f"{label} [{self.wallet.address}] ({self.status})"

