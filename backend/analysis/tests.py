from django.test import TestCase
from investigations.models import Investigation
from wallets.models import Wallet
from analysis.models import AnalysisResult
from analysis.serializers import AnalysisResultSerializer


class AnalysisResultTestCase(TestCase):
    def setUp(self):
        self.wallet = Wallet.objects.create(
            address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            blockchain='ethereum'
        )
        self.investigation = Investigation.objects.create(
            name="Analysis Test Investigation",
            wallet=self.wallet
        )

    def test_analysis_result_creation_all_types(self):
        types = [
            ('TRANSACTION_ANALYSIS', {'tx_count': 12, 'avg_value': 1.45}),
            ('FUND_FLOW_ANALYSIS', {'net_inflow': 5.2, 'counterparties': 4}),
            ('GRAPH_ANALYSIS', {'nodes': 8, 'edges': 10, 'max_depth': 2}),
            ('VASP_ATTRIBUTION', {'top_candidate': 'Coinbase', 'confidence': 'high'}),
            ('RISK_ANALYSIS', {'risk_score': 0.15, 'sanctions_hit': False}),
        ]

        for a_type, data in types:
            res = AnalysisResult.objects.create(
                investigation=self.investigation,
                analysis_type=a_type,
                summary=f"Automated {a_type} result",
                result=data
            )
            self.assertEqual(res.analysis_type, a_type)
            self.assertEqual(res.result, data)

        self.assertEqual(AnalysisResult.objects.filter(investigation=self.investigation).count(), 5)

    def test_analysis_result_cascade_delete(self):
        AnalysisResult.objects.create(
            investigation=self.investigation,
            analysis_type='GRAPH_ANALYSIS',
            result={'nodes': 3}
        )
        self.assertEqual(AnalysisResult.objects.count(), 1)
        self.investigation.delete()
        self.assertEqual(AnalysisResult.objects.count(), 0)

    def test_analysis_result_serializer_compatibility(self):
        res = AnalysisResult.objects.create(
            investigation=self.investigation,
            analysis_type='RISK_ANALYSIS',
            summary="Low risk exposure detected.",
            result={'score': 0.05}
        )
        data = AnalysisResultSerializer(res).data
        self.assertEqual(data['analysis_type'], 'RISK_ANALYSIS')
        self.assertEqual(data['result']['score'], 0.05)
