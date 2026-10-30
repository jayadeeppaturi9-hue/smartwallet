from django.db import models


class Transaction(models.Model):
    """
    Represents an on-chain blockchain transaction retrieved from an external provider.
    Enforces exact decimal representation for financial quantities, uniqueness per chain,
    and optimized indexing for forensics queries.
    """
    tx_hash = models.CharField(max_length=128, db_index=True)
    blockchain = models.CharField(max_length=32, default='ethereum', db_index=True)

    sender = models.CharField(max_length=128, db_index=True)
    receiver = models.CharField(max_length=128, db_index=True, null=True, blank=True)

    asset = models.CharField(max_length=32, default='ETH')
    amount = models.DecimalField(max_digits=36, decimal_places=18, default=0)

    timestamp = models.DateTimeField(db_index=True)
    block_number = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)

    status = models.CharField(
        max_length=20,
        default='confirmed',
        choices=(
            ('confirmed', 'Confirmed'),
            ('pending', 'Pending'),
            ('failed', 'Failed'),
        )
    )

    gas_used = models.DecimalField(max_digits=24, decimal_places=0, null=True, blank=True)
    gas_price = models.DecimalField(max_digits=24, decimal_places=0, null=True, blank=True)
    fee = models.DecimalField(max_digits=36, decimal_places=18, null=True, blank=True)

    raw_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        constraints = [
            models.UniqueConstraint(
                fields=['tx_hash', 'blockchain'],
                name='unique_transaction_hash_per_blockchain'
            )
        ]
        indexes = [
            models.Index(fields=['tx_hash']),
            models.Index(fields=['sender']),
            models.Index(fields=['receiver']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['block_number']),
            models.Index(fields=['sender', 'timestamp']),
            models.Index(fields=['receiver', 'timestamp']),
            models.Index(fields=['tx_hash', 'blockchain']),
        ]

    def save(self, *args, **kwargs):
        if self.tx_hash:
            self.tx_hash = self.tx_hash.strip().lower()
        if self.sender:
            self.sender = self.sender.strip().lower()
        if self.receiver:
            self.receiver = self.receiver.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.blockchain}:{self.tx_hash}"

