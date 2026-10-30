from rest_framework import serializers
from .models import Investigation
from blockchain.validators import validate_blockchain_address
from vasps.serializers import VASPAttributionSerializer
from vasps.models import VASPAddress
from transactions.models import Transaction
from analysis.models import AnalysisResult


class InvestigationSerializer(serializers.ModelSerializer):
    wallet_address = serializers.CharField(source='wallet.address', read_only=True)
    blockchain_network = serializers.CharField(source='wallet.blockchain', read_only=True)
    attributions = VASPAttributionSerializer(many=True, read_only=True)
    attributions_count = serializers.IntegerField(source='attributions.count', read_only=True)

    # Dynamic fields for Universal Investigation requirements
    timeline = serializers.SerializerMethodField()
    vasp_state = serializers.SerializerMethodField()
    vasp_state_message = serializers.SerializerMethodField()
    ai_explanation = serializers.SerializerMethodField()
    investigation_summary = serializers.SerializerMethodField()
    report_id = serializers.SerializerMethodField()
    report_reference_id = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()
    data_sources = serializers.SerializerMethodField()

    class Meta:
        model = Investigation
        fields = [
            'id',
            'name',
            'reference_id',
            'wallet_address',
            'blockchain_network',
            'status',
            'depth',
            'options',
            'risk_level',
            'summary',
            'error_message',
            'attributions_count',
            'attributions',
            'timeline',
            'vasp_state',
            'vasp_state_message',
            'ai_explanation',
            'investigation_summary',
            'report_id',
            'report_reference_id',
            'has_report',
            'data_sources',
            'created_at',
            'updated_at',
            'started_at',
            'completed_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'risk_level',
            'summary',
            'error_message',
            'created_at',
            'updated_at',
            'started_at',
            'completed_at',
        ]

    def get_timeline(self, obj):
        options = obj.options or {}
        if 'timeline' in options and isinstance(options['timeline'], list) and options['timeline']:
            return options['timeline']

        # Dynamic fallback for completed investigations
        if obj.status == 'COMPLETED':
            return [
                {'stage': 'INVESTIGATION_CREATED', 'label': 'Investigation Created', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'WALLET_VALIDATED', 'label': 'Wallet Validated', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'BLOCKCHAIN_DATA_RETRIEVED', 'label': 'Blockchain Data Retrieved', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'TRANSACTIONS_STORED', 'label': 'Transactions Stored', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'TRANSACTION_ANALYSIS_COMPLETE', 'label': 'Transaction Analysis Complete', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'FUND_FLOW_ANALYSIS_COMPLETE', 'label': 'Fund Flow Analysis Complete', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'GRAPH_GENERATED', 'label': 'Graph Generated', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'VASP_INTELLIGENCE_CHECKED', 'label': 'VASP Intelligence Checked', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'ATTRIBUTION_CALCULATED', 'label': 'Attribution Calculated', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'AI_EXPLANATION_GENERATED', 'label': 'AI Explanation Generated', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'REPORT_GENERATED', 'label': 'Report Generated', 'status': 'completed', 'timestamp': obj.completed_at.isoformat() if obj.completed_at else None},
                {'stage': 'INVESTIGATION_COMPLETE', 'label': 'Investigation Complete', 'status': 'completed', 'timestamp': obj.completed_at.isoformat() if obj.completed_at else None},
            ]
        elif obj.status == 'FAILED':
            return [
                {'stage': 'INVESTIGATION_CREATED', 'label': 'Investigation Created', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
                {'stage': 'PIPELINE_ERROR', 'label': 'Analysis Failed', 'status': 'failed', 'timestamp': obj.completed_at.isoformat() if obj.completed_at else None, 'details': obj.error_message},
            ]
        return [
            {'stage': 'INVESTIGATION_CREATED', 'label': 'Investigation Created', 'status': 'completed', 'timestamp': obj.created_at.isoformat() if obj.created_at else None},
            {'stage': 'ANALYSIS_IN_PROGRESS', 'label': 'Processing Pipeline', 'status': 'running', 'timestamp': None},
        ]

    def get_vasp_state(self, obj):
        options = obj.options or {}
        if 'vasp_state' in options and options['vasp_state']:
            state = options['vasp_state']
            # Map legacy states if any existed in older options
            legacy_map = {
                'CANDIDATES_FOUND': 'DIRECT VASP INTERACTION',
                'NO_VASP_FOUND': 'NO VASP ASSOCIATION IDENTIFIED',
                'DATABASE_UNAVAILABLE': 'VASP INTELLIGENCE NOT CONFIGURED',
                'PROVIDER_FAILURE': 'ANALYSIS FAILED',
                'ATTRIBUTION_PENDING': 'VASP ANALYSIS IN PROGRESS',
            }
            return legacy_map.get(state, state)

        if obj.status == 'FAILED':
            return 'ANALYSIS FAILED'
        if obj.status in ('PENDING', 'RUNNING'):
            return 'VASP ANALYSIS IN PROGRESS'

        # Check real DB counts
        blockchain = getattr(obj.wallet, 'blockchain', 'ethereum')
        has_vasps = VASPAddress.objects.filter(blockchain=blockchain).exists()
        if not has_vasps:
            return 'VASP INTELLIGENCE NOT CONFIGURED'

        attrs = obj.attributions.all()
        if attrs.exists():
            for a in attrs:
                m_type = a.evidence.get('match_type')
                if m_type == 'KNOWN_VASP_MATCH':
                    return 'KNOWN VASP ADDRESS MATCH'
            for a in attrs:
                m_type = a.evidence.get('match_type')
                if m_type == 'DIRECT_INTERACTION':
                    return 'DIRECT VASP INTERACTION'
            return 'INDIRECT VASP RELATIONSHIP'

        return 'NO VASP ASSOCIATION IDENTIFIED'

    def get_vasp_state_message(self, obj):
        state = self.get_vasp_state(obj)
        messages = {
            'VASP ANALYSIS IN PROGRESS': 'VASP attribution analysis is actively running. Blockchain nodes and heuristic algorithms are being evaluated.',
            'VASP INTELLIGENCE NOT CONFIGURED': 'VASP intelligence unavailable. Blockchain analysis succeeded, but no verified VASP address intelligence is configured for this network.',
            'KNOWN VASP ADDRESS MATCH': 'Exact Known VASP Address Match: The investigated wallet address corresponds directly to a registered VASP entity address.',
            'DIRECT VASP INTERACTION': 'Direct VASP Interaction: Observed verified on-chain transfers directly between the subject wallet and known VASP cluster addresses.',
            'INDIRECT VASP RELATIONSHIP': 'Indirect VASP Relationship: Multi-hop graph analysis traced fund-flow paths connecting to known VASP addresses.',
            'NO VASP ASSOCIATION IDENTIFIED': 'No VASP Association Identified: Analyzed transactions and counterparties produced no match against registered VASP directory clusters.',
            'ANALYSIS FAILED': f"Blockchain forensic analysis failed: {obj.error_message or 'Provider error or address rejected.'}",
        }
        return messages.get(state, '')

    def get_ai_explanation(self, obj):
        options = obj.options or {}
        if 'ai_explanation' in options:
            return options['ai_explanation']

        # If not in options, check if Report exists and has it
        rep = obj.reports.first()
        if rep and isinstance(rep.findings, dict) and 'ai_investigation_explanation' in rep.findings:
            return rep.findings['ai_investigation_explanation']

        return {
            'analysis_scope': f"Investigation for {obj.wallet.address} on {obj.wallet.blockchain}.",
            'discoveries': [obj.summary or "Blockchain forensic analysis recorded."],
            'interpretation': "Heuristic analysis evaluated on-chain relationships.",
            'conclusion': "Investigation concluded based on observed blockchain telemetry.",
            'evidence_breakdown': {
                'observed_evidence': [],
                'system_attribution': [],
            }
        }

    def get_investigation_summary(self, obj):
        # Retrieve actual counts from DB records
        wallet = obj.wallet
        clean_addr = wallet.address.lower().strip()
        tx_qs = Transaction.objects.filter(blockchain=wallet.blockchain).filter(
            models_sender_receiver(clean_addr)
        )
        total_tx = tx_qs.count()
        incoming = tx_qs.filter(receiver__iexact=clean_addr)
        outgoing = tx_qs.filter(sender__iexact=clean_addr)

        in_count = incoming.count()
        out_count = outgoing.count()

        in_sum = sum(float(t.amount or 0) for t in incoming[:500])
        out_sum = sum(float(t.amount or 0) for t in outgoing[:500])

        counterparties = set()
        for t in tx_qs[:300]:
            if t.sender and t.sender.lower() != clean_addr:
                counterparties.add(t.sender.lower())
            if t.receiver and t.receiver.lower() != clean_addr:
                counterparties.add(t.receiver.lower())

        # Check graph result if available
        graph_res = AnalysisResult.objects.filter(investigation=obj, analysis_type='GRAPH_ANALYSIS').first()
        if graph_res and isinstance(graph_res.result, dict):
            nodes_count = graph_res.result.get('nodes_count', len(counterparties) + 1)
            edges_count = graph_res.result.get('edges_count', total_tx)
        else:
            nodes_count = len(counterparties) + 1
            edges_count = total_tx

        vasp_count = obj.attributions.count()
        vasp_addrs = VASPAddress.objects.filter(blockchain=wallet.blockchain).filter(address__in=counterparties).count()

        return {
            'transactions_analyzed': total_tx,
            'incoming_transactions': in_count,
            'outgoing_transactions': out_count,
            'total_inflow': round(in_sum, 6),
            'total_outflow': round(out_sum, 6),
            'unique_counterparties': len(counterparties),
            'graph_nodes': nodes_count,
            'graph_relationships': edges_count,
            'vasp_linked_addresses': vasp_addrs,
            'vasp_candidates': vasp_count,
        }

    def get_report_id(self, obj):
        options = obj.options or {}
        if 'report_id' in options:
            return options['report_id']
        rep = obj.reports.first()
        return rep.id if rep else None

    def get_report_reference_id(self, obj):
        options = obj.options or {}
        if 'report_reference_id' in options:
            return options['report_reference_id']
        rep = obj.reports.first()
        return rep.reference_id if rep else None

    def get_has_report(self, obj):
        return obj.reports.exists()

    def get_data_sources(self, obj):
        return {
            'blockchain_data': 'Blockchain Provider (Alchemy API)',
            'vasp_intelligence': 'Configured VASP Intelligence Database',
            'attribution': 'Backend Heuristic Analysis',
            'explanation': 'AI Analysis of Stored Investigation Results',
        }


def models_sender_receiver(address):
    from django.db.models import Q
    return Q(sender__iexact=address) | Q(receiver__iexact=address)


class CreateInvestigationSerializer(serializers.Serializer):
    wallet_address = serializers.CharField(max_length=128, required=True)
    blockchain_network = serializers.CharField(max_length=32, default='ethereum')
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    depth = serializers.IntegerField(default=2, min_value=1, max_value=3)
    options = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        address = attrs.get('wallet_address', '').strip()
        network = attrs.get('blockchain_network', 'ethereum').strip().lower()

        is_valid, err_msg = validate_blockchain_address(address, network)
        if not is_valid:
            raise serializers.ValidationError({'wallet_address': err_msg})

        attrs['wallet_address'] = address
        attrs['blockchain_network'] = network
        return attrs
