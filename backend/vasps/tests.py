from django.test import TestCase
from django.db import IntegrityError
from vasps.models import VASP, VASPAddress, VASPAttribution
from wallets.models import Wallet
from vasps.serializers import VASPSerializer, VASPAddressSerializer, VASPAttributionSerializer


class VaspDatabaseTestCase(TestCase):
    def setUp(self):
        self.vasp = VASP.objects.create(
            name="Kraken Exchange",
            description="Global digital asset exchange",
            website="https://kraken.com",
            jurisdiction="United States",
            status="ACTIVE",
            source="Manual Operator Intelligence"
        )
        self.address = "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2"

    def test_vasp_creation_and_uniqueness(self):
        from django.db import transaction
        self.assertEqual(self.vasp.name, "Kraken Exchange")
        self.assertEqual(self.vasp.status, "ACTIVE")

        # Duplicate name must raise IntegrityError
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                VASP.objects.create(name="Kraken Exchange")

    def test_vasp_address_creation_and_normalization(self):
        addr = VASPAddress.objects.create(
            vasp=self.vasp,
            address=self.address,
            blockchain='ethereum',
            address_type='hot_wallet',
            confidence=0.98,
            source='Etherscan Label Intelligence'
        )
        self.assertEqual(addr.address, self.address.lower())
        self.assertEqual(addr.confidence, 0.98)

    def test_vasp_address_uniqueness_per_blockchain(self):
        from django.db import transaction
        VASPAddress.objects.create(
            vasp=self.vasp,
            address=self.address,
            blockchain='ethereum'
        )

        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                VASPAddress.objects.create(
                    vasp=self.vasp,
                    address=self.address,
                    blockchain='ethereum'
                )


    def test_vasp_attribution_creation_and_structured_evidence(self):
        wallet = Wallet.objects.create(
            address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            blockchain='ethereum'
        )

        evidence_payload = {
            'direct_interactions': 2,
            'hop_distance': 1,
            'interaction_count': 6,
            'fund_flow_connection': True,
            'signals': {
                'deposit_pattern': True,
                'cluster_similarity': 0.88
            }
        }

        attr = VASPAttribution.objects.create(
            wallet=wallet,
            vasp=self.vasp,
            score=88.5,
            confidence='high',
            rank=1,
            evidence=evidence_payload
        )

        self.assertEqual(attr.score, 88.5)
        self.assertEqual(attr.confidence, 'high')
        self.assertEqual(attr.rank, 1)
        self.assertEqual(attr.evidence['direct_interactions'], 2)
        self.assertTrue(attr.evidence['fund_flow_connection'])

    def test_vasp_cascade_delete(self):
        VASPAddress.objects.create(
            vasp=self.vasp,
            address=self.address,
            blockchain='ethereum'
        )
        self.assertEqual(VASPAddress.objects.count(), 1)
        self.vasp.delete()
        self.assertEqual(VASPAddress.objects.count(), 0)

    def test_vasp_serializers_compatibility(self):
        vasp_data = VASPSerializer(self.vasp).data
        self.assertEqual(vasp_data['name'], "Kraken Exchange")
        self.assertEqual(vasp_data['status'], "ACTIVE")
