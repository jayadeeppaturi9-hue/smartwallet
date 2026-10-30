from django.db import models
from django.core.exceptions import ValidationError
from blockchain.validators import validate_blockchain_address


class Wallet(models.Model):
    """
    Represents a unique cryptocurrency wallet on a specific blockchain network.
    Normalizes addresses and enforces database-level uniqueness per blockchain network.
    """
    address = models.CharField(max_length=128, db_index=True)
    blockchain = models.CharField(max_length=32, default='ethereum', db_index=True)
    label = models.CharField(max_length=255, blank=True, null=True)

    # Dynamic metrics calculated from actual on-chain transaction analysis
    balance = models.DecimalField(max_digits=36, decimal_places=18, null=True, blank=True)
    total_inflow = models.DecimalField(max_digits=36, decimal_places=18, default=0)
    total_outflow = models.DecimalField(max_digits=36, decimal_places=18, default=0)
    transaction_count = models.PositiveIntegerField(default=0)
    inflow_count = models.PositiveIntegerField(default=0)
    outflow_count = models.PositiveIntegerField(default=0)

    # Assessed forensic risk rating
    risk_score = models.FloatField(default=0.0)
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

    first_seen = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['address', 'blockchain'],
                name='unique_wallet_address_per_blockchain'
            )
        ]
        indexes = [
            models.Index(fields=['address']),
            models.Index(fields=['blockchain']),
            models.Index(fields=['address', 'blockchain']),
            models.Index(fields=['risk_level']),
            models.Index(fields=['created_at']),
        ]

    def clean(self):
        super().clean()
        if self.address:
            self.address = self.address.strip()
            if self.blockchain in ('ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'binance-smart-chain'):
                self.address = self.address.lower()
            is_valid, msg = validate_blockchain_address(self.address, self.blockchain)
            if not is_valid:
                raise ValidationError({'address': msg})

    def save(self, *args, **kwargs):
        if self.address:
            self.address = self.address.strip()
            if self.blockchain in ('ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'binance-smart-chain'):
                self.address = self.address.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.blockchain}:{self.address}"


class WalletRelationship(models.Model):
    """
    Represents an observed or traversed fund-flow relationship between two wallets.
    Generated dynamically based on actual on-chain transaction analysis.
    """
    source_wallet = models.ForeignKey(
        Wallet, related_name='outgoing_relationships', on_delete=models.CASCADE
    )
    target_wallet = models.ForeignKey(
        Wallet, related_name='incoming_relationships', on_delete=models.CASCADE
    )
    relationship_type = models.CharField(
        max_length=50,
        default='DIRECT_TRANSFER',
        choices=(
            ('DIRECT_TRANSFER', 'Direct Transfer'),
            ('INDIRECT_RELATIONSHIP', 'Indirect Relationship'),
            ('INDIRECT_HOP', 'Indirect Multi-Hop'),
            ('VASP_INTERACTION', 'VASP Interaction'),
            ('SWEEP_CONSOLIDATION', 'Sweep Consolidation'),
            ('SMART_CONTRACT_CALL', 'Contract Call'),
            ('OTHER', 'Other Interaction'),
        )
    )
    transaction_count = models.PositiveIntegerField(default=1)
    total_volume = models.DecimalField(max_digits=36, decimal_places=18, default=0)
    hop_distance = models.PositiveSmallIntegerField(default=1)
    first_seen = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['source_wallet', 'target_wallet', 'relationship_type'],
                name='unique_wallet_relationship'
            )
        ]
        indexes = [
            models.Index(fields=['source_wallet', 'target_wallet']),
            models.Index(fields=['relationship_type']),
            models.Index(fields=['hop_distance']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['hop_distance', '-total_volume']

    def __str__(self):
        return f"{self.source_wallet.address} -> {self.target_wallet.address} ({self.relationship_type}, Hop {self.hop_distance})"

