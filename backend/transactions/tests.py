from decimal import Decimal
from datetime import datetime, timezone
from django.test import TestCase
from django.db import IntegrityError
from transactions.models import Transaction
from transactions.serializers import TransactionSerializer


class TransactionModelTestCase(TestCase):
    def setUp(self):
        self.tx_hash = "0x5c504ed432cb51138b309d25e14136535a0ed3c1048ac400043a47cb39d6d0b6"
        self.sender = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        self.receiver = "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe"
        self.timestamp = datetime(2026, 3, 15, 10, 30, tzinfo=timezone.utc)

    def test_transaction_creation_and_normalization(self):
        tx = Transaction.objects.create(
            tx_hash=self.tx_hash.upper(),
            blockchain='ethereum',
            sender=self.sender,
            receiver=self.receiver,
            asset='ETH',
            amount=Decimal('3.141592653589793238'),
            timestamp=self.timestamp,
            block_number=19450000,
            status='confirmed',
            gas_used=Decimal('21000'),
            gas_price=Decimal('25000000000'),
            fee=Decimal('0.000525'),
            raw_data={'provider': 'alchemy'}
        )
        self.assertEqual(tx.tx_hash, self.tx_hash.lower())
        self.assertEqual(tx.sender, self.sender.lower())
        self.assertEqual(tx.receiver, self.receiver.lower())
        self.assertEqual(tx.amount, Decimal('3.141592653589793238'))

    def test_transaction_uniqueness_per_blockchain(self):
        from django.db import transaction
        Transaction.objects.create(
            tx_hash=self.tx_hash,
            blockchain='ethereum',
            sender=self.sender,
            timestamp=self.timestamp,
            amount=Decimal('1.0')
        )

        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Transaction.objects.create(
                    tx_hash=self.tx_hash,
                    blockchain='ethereum',
                    sender=self.sender,
                    timestamp=self.timestamp,
                    amount=Decimal('2.0')
                )

        # Same tx hash on polygon should be allowed
        poly_tx = Transaction.objects.create(
            tx_hash=self.tx_hash,
            blockchain='polygon',
            sender=self.sender,
            timestamp=self.timestamp,
            amount=Decimal('1.0')
        )
        self.assertIsNotNone(poly_tx.id)


    def test_transaction_serializer_compatibility(self):
        tx = Transaction.objects.create(
            tx_hash=self.tx_hash,
            blockchain='ethereum',
            sender=self.sender,
            receiver=self.receiver,
            amount=Decimal('1.25'),
            timestamp=self.timestamp
        )
        serializer = TransactionSerializer(tx)
        data = serializer.data
        self.assertEqual(data['tx_hash'], self.tx_hash.lower())
        self.assertEqual(Decimal(data['amount']), Decimal('1.25'))
        self.assertIn('direction', data)
