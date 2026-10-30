from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from investigations.models import Investigation
from wallets.models import Wallet
from investigations.serializers import InvestigationSerializer, CreateInvestigationSerializer


class InvestigationDatabaseTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='investigator_1', password='secure_password_123')
        self.wallet = Wallet.objects.create(
            address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            blockchain='ethereum'
        )

    def test_investigation_creation_and_lifecycle(self):
        inv = Investigation.objects.create(
            name="Operation DeepTrace",
            reference_id="CASE-2026-001",
            wallet=self.wallet,
            status='PENDING',
            created_by=self.user,
            depth=2
        )
        self.assertEqual(inv.status, 'PENDING')
        self.assertEqual(inv.wallet.address, self.wallet.address)
        self.assertEqual(inv.created_by, self.user)

        # Transition status
        inv.status = 'RUNNING'
        inv.save()
        self.assertEqual(Investigation.objects.get(id=inv.id).status, 'RUNNING')

        inv.status = 'COMPLETED'
        inv.summary = 'Analysis completed with VASP attribution.'
        inv.save()
        self.assertEqual(Investigation.objects.get(id=inv.id).status, 'COMPLETED')

    def test_user_deletion_sets_null_preserving_investigation(self):
        inv = Investigation.objects.create(
            wallet=self.wallet,
            created_by=self.user
        )
        self.assertEqual(inv.created_by, self.user)

        # Delete user
        self.user.delete()
        inv.refresh_from_db()
        self.assertIsNone(inv.created_by)
        self.assertEqual(Investigation.objects.count(), 1)

    def test_wallet_deletion_cascades_to_investigation(self):
        Investigation.objects.create(
            wallet=self.wallet,
            created_by=self.user
        )
        self.assertEqual(Investigation.objects.count(), 1)
        self.wallet.delete()
        self.assertEqual(Investigation.objects.count(), 0)

    def test_investigation_serializer_compatibility(self):
        inv = Investigation.objects.create(
            name="Serializer Check",
            wallet=self.wallet,
            created_by=self.user
        )
        data = InvestigationSerializer(inv).data
        self.assertEqual(data['wallet_address'], self.wallet.address)
        self.assertEqual(data['status'], 'PENDING')
        self.assertIn('attributions_count', data)


class InvestigationApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_dashboard_empty_stats(self):
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Must return real zero values when DB is empty, no fake statistics!
        self.assertEqual(data['total_investigations'], 0)
        self.assertEqual(data['total_wallets_analyzed'], 0)
        self.assertEqual(data['total_transactions_analyzed'], 0)
        self.assertEqual(data['total_vasp_matches'], 0)
        self.assertEqual(data['confidence_distribution'], [])

    def test_invalid_address_rejection(self):
        payload = {
            'wallet_address': 'not-a-valid-address',
            'blockchain_network': 'ethereum',
        }
        response = self.client.post('/api/investigations/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('wallet_address', response.json())

    def test_investigations_list_empty(self):
        response = self.client.get('/api/investigations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['count'], 0)
        self.assertEqual(data['results'], [])

    def test_investigations_list_and_retrieve(self):
        wallet = Wallet.objects.create(
            address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            blockchain='ethereum'
        )
        inv = Investigation.objects.create(
            name="Test Case",
            reference_id="INV-TEST-001",
            wallet=wallet,
            status='COMPLETED'
        )
        # Test List endpoint
        list_resp = self.client.get('/api/investigations/')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        list_data = list_resp.json()
        self.assertEqual(list_data['count'], 1)
        self.assertEqual(len(list_data['results']), 1)
        self.assertEqual(list_data['results'][0]['wallet_address'], wallet.address)

        # Test Retrieve endpoint
        detail_resp = self.client.get(f'/api/investigations/{inv.id}/')
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        detail_data = detail_resp.json()
        self.assertEqual(detail_data['id'], inv.id)
        self.assertEqual(detail_data['wallet_address'], wallet.address)
        self.assertEqual(detail_data['status'], 'COMPLETED')

