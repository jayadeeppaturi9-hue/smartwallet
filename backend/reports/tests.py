from django.test import TestCase
from django.contrib.auth.models import User
from investigations.models import Investigation
from wallets.models import Wallet
from reports.models import Report, InvestigationReport
from reports.serializers import ReportSerializer


class ReportModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='report_author', password='password123')
        self.wallet = Wallet.objects.create(
            address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            blockchain='ethereum'
        )
        self.investigation = Investigation.objects.create(
            name="Forensics Case #1",
            wallet=self.wallet,
            created_by=self.user
        )

    def test_report_creation_and_properties(self):
        report = Report.objects.create(
            investigation=self.investigation,
            title="Final Forensic Summary - Vitalik Wallet",
            reference_id="RPT-2026-99",
            wallet_address=self.wallet.address,
            summary="Wallet demonstrates direct interactions with known VASP clusters.",
            findings={
                "candidate_vasps": ["Kraken Exchange"],
                "hop_distance": 1,
                "confidence": "high"
            },
            conclusion="Subject wallet is attributed to customer deposit cluster.",
            status="completed",
            risk_level="low",
            created_by=self.user
        )

        self.assertEqual(report.title, "Final Forensic Summary - Vitalik Wallet")
        self.assertEqual(report.findings["confidence"], "high")
        self.assertEqual(report.conclusion, "Subject wallet is attributed to customer deposit cluster.")
        self.assertIsNotNone(report.generated_at)
        self.assertEqual(report.generated_at, report.created_at)

    def test_investigation_report_alias(self):
        self.assertIs(InvestigationReport, Report)

    def test_cascade_delete_with_investigation(self):
        Report.objects.create(
            investigation=self.investigation,
            title="Temp Report",
            wallet_address=self.wallet.address
        )
        self.assertEqual(Report.objects.count(), 1)
        self.investigation.delete()
        self.assertEqual(Report.objects.count(), 0)

    def test_report_serializer_compatibility(self):
        report = Report.objects.create(
            investigation=self.investigation,
            title="Serializer Test Report",
            wallet_address=self.wallet.address,
            summary="Executive summary content",
            findings={"total_nodes": 12}
        )
        data = ReportSerializer(report).data
        self.assertEqual(data["title"], "Serializer Test Report")
        self.assertEqual(data["findings"]["total_nodes"], 12)
