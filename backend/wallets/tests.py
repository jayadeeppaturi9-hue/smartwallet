from decimal import Decimal
from django.test import TestCase
from django.db import IntegrityError
from django.core.exceptions import ValidationError
from wallets.models import Wallet, WalletRelationship
from wallets.serializers import WalletSerializer, WalletRelationshipSerializer


class WalletModelTestCase(TestCase):
    def setUp(self):
        self.valid_address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        self.counterparty_address = "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe"

    def test_wallet_creation_and_normalization(self):
        # Mixed-case address should be normalized to lowercase
        wallet = Wallet.objects.create(
            address=self.valid_address,
            blockchain='ethereum',
            balance=Decimal('10.500000000000000000'),
            label="Test Vitalik Wallet"
        )
        self.assertEqual(wallet.address, self.valid_address.lower())
        self.assertEqual(wallet.balance, Decimal('10.500000000000000000'))
        self.assertEqual(str(wallet), f"ethereum:{self.valid_address.lower()}")

    def test_wallet_address_validation_clean(self):
        invalid_wallet = Wallet(address="0xInvalidHexCharsZZZ", blockchain="ethereum")
        with self.assertRaises(ValidationError):
            invalid_wallet.clean()

    def test_wallet_uniqueness_per_blockchain(self):
        from django.db import transaction
        Wallet.objects.create(address=self.valid_address, blockchain='ethereum')
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Wallet.objects.create(address=self.valid_address, blockchain='ethereum')

        # Same address on another blockchain should be allowed
        polygon_wallet = Wallet.objects.create(address=self.valid_address, blockchain='polygon')
        self.assertIsNotNone(polygon_wallet.id)

    def test_wallet_relationship_creation_and_uniqueness(self):
        from django.db import transaction
        w1 = Wallet.objects.create(address=self.valid_address, blockchain='ethereum')
        w2 = Wallet.objects.create(address=self.counterparty_address, blockchain='ethereum')

        rel = WalletRelationship.objects.create(
            source_wallet=w1,
            target_wallet=w2,
            relationship_type='DIRECT_TRANSFER',
            transaction_count=5,
            total_volume=Decimal('25.750000000000000000'),
            hop_distance=1
        )
        self.assertEqual(rel.transaction_count, 5)
        self.assertEqual(rel.hop_distance, 1)

        # Duplicate relationship of same type between same wallets must raise IntegrityError
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                WalletRelationship.objects.create(
                    source_wallet=w1,
                    target_wallet=w2,
                    relationship_type='DIRECT_TRANSFER'
                )


    def test_wallet_cascade_deletes_relationships(self):
        w1 = Wallet.objects.create(address=self.valid_address, blockchain='ethereum')
        w2 = Wallet.objects.create(address=self.counterparty_address, blockchain='ethereum')
        WalletRelationship.objects.create(
            source_wallet=w1,
            target_wallet=w2,
            relationship_type='DIRECT_TRANSFER'
        )

        self.assertEqual(WalletRelationship.objects.count(), 1)
        w1.delete()
        self.assertEqual(WalletRelationship.objects.count(), 0)

    def test_wallet_serializer_compatibility(self):
        w = Wallet.objects.create(
            address=self.valid_address,
            blockchain='ethereum',
            balance=Decimal('2.5')
        )
        serializer = WalletSerializer(w)
        data = serializer.data
        self.assertEqual(data['address'], self.valid_address.lower())
        self.assertEqual(Decimal(data['balance']), Decimal('2.5'))
