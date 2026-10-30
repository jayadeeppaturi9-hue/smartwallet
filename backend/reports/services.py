import logging
from django.utils import timezone
from .models import Report
from investigations.models import Investigation
from wallets.models import Wallet
from transactions.models import Transaction
from vasps.models import VASPAddress, VASPAttribution
from analysis.transaction_analyzer import TransactionAnalyzer
from analysis.fund_flow_analyzer import FundFlowAnalyzer
from analysis.ai_explainer import AIInvestigationExplainer
from graph.builder import GraphBuilder

logger = logging.getLogger('investigations')


class ReportService:
    """
    Assembles a formal forensic dossier report from actual stored analysis records.
    Every completed investigation automatically generates an associated Report.
    """

    @classmethod
    def generate_investigation_report(
        cls,
        investigation: Investigation,
        user=None,
        notes: str = ''
    ) -> Report:
        """
        Generates and stores the complete forensic investigation report adhering to Section 10 structure.
        """
        wallet = investigation.wallet
        clean_addr = wallet.address.lower().strip()
        network = wallet.blockchain

        # 1. Fetch real transactions
        txs = list(Transaction.objects.filter(blockchain=network).filter(
            sender__iexact=clean_addr
        ) | Transaction.objects.filter(blockchain=network).filter(
            receiver__iexact=clean_addr
        ))

        # 2. Extract real metrics
        tx_features = TransactionAnalyzer.analyze_wallet_transactions(txs, clean_addr)
        flow_features = FundFlowAnalyzer.analyze_flows(txs, clean_addr, blockchain=network)

        # 3. Build graph representation
        G = GraphBuilder.build_networkx_graph(
            subject_address=clean_addr,
            transactions=txs,
            max_depth=investigation.depth,
            blockchain=network
        )
        graph_data = GraphBuilder.export_cytoscape_elements(G, max_depth=investigation.depth)

        # 4. Fetch attributions
        attrs = list(VASPAttribution.objects.filter(investigation=investigation).select_related('vasp').order_by('rank'))

        # Check VASP database status and determine exact forensic state
        has_vasp_db = VASPAddress.objects.filter(blockchain=network).exists()
        attribution_list = []
        for a in attrs:
            m_type = a.evidence.get('match_type', 'DIRECT_INTERACTION')
            rel_type = a.evidence.get('relationship_type', 'Direct VASP Interaction')
            attribution_list.append({
                'rank': a.rank,
                'vasp_name': a.vasp.name,
                'vasp_id': a.vasp.id,
                'match_type': m_type,
                'relationship_type': rel_type,
                'address_matched': a.evidence.get('address_matched', ''),
                'source': a.evidence.get('source') or a.vasp.source,
                'score': a.score,
                'confidence': a.confidence,
                'jurisdiction': a.vasp.jurisdiction,
                'observed_evidence': a.evidence.get('observed_evidence', []),
                'system_attribution': a.evidence.get('system_attribution', []),
                'distance_hops': a.evidence.get('distance_hops', 1),
                'interaction_count': a.evidence.get('interaction_count', 0),
                'total_volume': a.evidence.get('total_volume', 0.0),
                'observed_transactions': a.evidence.get('observed_transactions', []),
            })

        if not has_vasp_db:
            vasp_state = 'VASP INTELLIGENCE NOT CONFIGURED'
        elif any(a.get('match_type') == 'KNOWN_VASP_MATCH' for a in attribution_list):
            vasp_state = 'KNOWN VASP ADDRESS MATCH'
        elif any(a.get('match_type') == 'DIRECT_INTERACTION' for a in attribution_list):
            vasp_state = 'DIRECT VASP INTERACTION'
        elif any(a.get('match_type') == 'INDIRECT_RELATIONSHIP' for a in attribution_list):
            vasp_state = 'INDIRECT VASP RELATIONSHIP'
        else:
            vasp_state = 'NO VASP ASSOCIATION IDENTIFIED'

        # 5. Generate AI Explanation
        ai_explanation = AIInvestigationExplainer.generate_explanation(
            wallet_address=clean_addr,
            blockchain_network=network,
            depth=investigation.depth,
            tx_features=tx_features,
            flow_features=flow_features,
            graph_data=graph_data,
            attribution_results=attribution_list,
            vasp_state=vasp_state,
            error_message=investigation.error_message
        )

        # 6. Executive Summary
        exec_summary = (
            f"Forensic investigation #{investigation.id} ({investigation.name or 'Case ' + str(investigation.id)}) "
            f"for subject wallet {clean_addr} on {network.capitalize()}. "
            f"The engine analyzed {len(txs)} confirmed transactions across {tx_features['unique_counterparties']} counterparties, "
            f"constructing a relationship topology of {len(graph_data['nodes'])} nodes and {len(graph_data['edges'])} edges. "
        )
        if vasp_state == 'KNOWN VASP ADDRESS MATCH':
            top_v = attribution_list[0]
            exec_summary += (
                f"Exact Known VASP Address Match: Subject wallet matches registered {top_v['vasp_name']} address "
                f"(Confidence: {top_v['confidence']}, Source: {top_v['source']})."
            )
        elif vasp_state in ('DIRECT VASP INTERACTION', 'INDIRECT VASP RELATIONSHIP'):
            top_v = attribution_list[0]
            exec_summary += (
                f"{vasp_state.title()}: Identified {len(attribution_list)} candidate VASP mapping(s). Top candidate: {top_v['vasp_name']} "
                f"(Attribution Score: {top_v['score']:.1f}%, Confidence: {top_v['confidence']})."
            )
        elif vasp_state == 'NO VASP ASSOCIATION IDENTIFIED':
            exec_summary += "No VASP association identified from the available on-chain evidence."
        elif vasp_state == 'VASP INTELLIGENCE NOT CONFIGURED':
            exec_summary += "VASP address intelligence database is currently unconfigured for this blockchain."

        # 7. Complete Structured Findings
        findings = {
            'header': {
                'system_title': 'Smart Wallet-to-VASP Mapping',
                'report_type': 'Forensic Blockchain Investigation Report',
                'generated_at': timezone.now().isoformat(),
            },
            'investigation_details': {
                'investigation_name': investigation.name or f"Case #{investigation.id}",
                'investigation_id': investigation.id,
                'reference_id': investigation.reference_id or f"INV-{investigation.id:04d}",
                'created_date': investigation.created_at.isoformat() if investigation.created_at else None,
                'completed_date': (investigation.completed_at or timezone.now()).isoformat(),
                'wallet_address': clean_addr,
                'blockchain_network': network,
                'analysis_depth': investigation.depth,
                'investigation_status': investigation.status,
            },
            'executive_summary': exec_summary,
            'wallet_analysis': {
                'address': clean_addr,
                'blockchain': network,
                'balance': float(wallet.balance) if wallet.balance is not None else 0.0,
                'risk_level': investigation.risk_level or wallet.risk_level or 'low',
                'transactions_analyzed': len(txs),
                'incoming_activity': {
                    'count': tx_features['incoming_transaction_count'],
                    'total_inflow': tx_features['total_inflow'],
                },
                'outgoing_activity': {
                    'count': tx_features['outgoing_transaction_count'],
                    'total_outflow': tx_features['total_outflow'],
                },
                'counterparties_count': tx_features['unique_counterparties'],
            },
            'transaction_findings': tx_features,
            'fund_flow_findings': {
                'unique_counterparties': flow_features['unique_counterparties_count'],
                'top_counterparties': flow_features['top_counterparties'],
                'direct_vasp_interactions': flow_features['direct_vasp_interactions'],
            },
            'relationship_analysis': {
                'total_nodes': len(graph_data['nodes']),
                'total_edges': len(graph_data['edges']),
                'traversal_depth': investigation.depth,
                'node_hierarchy': {
                    'target_wallet': clean_addr,
                    'direct_counterparties_count': sum(1 for n in graph_data['nodes'] if n.get('hops') == 1),
                    'intermediary_wallets_count': sum(1 for n in graph_data['nodes'] if n.get('hops', 0) > 1 and not n.get('is_vasp')),
                    'known_vasp_nodes_count': sum(1 for n in graph_data['nodes'] if n.get('is_vasp')),
                }
            },
            'vasp_intelligence': {
                'vasp_state': vasp_state,
                'candidates': attribution_list,
                'message': (
                    "Exact Known VASP Address Match: Subject wallet corresponds directly to a registered VASP entity address." if vasp_state == 'KNOWN VASP ADDRESS MATCH'
                    else "Direct VASP Interaction: Observed confirmed on-chain transfers with registered VASP addresses." if vasp_state == 'DIRECT VASP INTERACTION'
                    else "Indirect VASP Relationship: Fund flow path links to known VASP addresses across multiple hops." if vasp_state == 'INDIRECT VASP RELATIONSHIP'
                    else "No VASP Association Identified: Analyzed transactions produced no match against registered VASP directory clusters." if vasp_state == 'NO VASP ASSOCIATION IDENTIFIED'
                    else "VASP intelligence unavailable: database not configured."
                )
            },
            'ai_investigation_explanation': ai_explanation,
            'evidence': {
                'observed_evidence': ai_explanation['evidence_breakdown']['observed_evidence'],
                'system_attribution': ai_explanation['evidence_breakdown']['system_attribution'],
            },
            'conclusion': ai_explanation['conclusion'],
            'data_sources': {
                'blockchain_data': 'Blockchain Provider (Alchemy API)',
                'vasp_intelligence': 'Configured VASP Intelligence Database',
                'attribution': 'Backend Heuristic Analysis',
                'explanation': 'AI Analysis of Stored Investigation Results',
            }
        }

        # 8. Create or update Report record
        title = f"Investigation Report #{investigation.id} - {clean_addr[:10]}"
        ref_id = f"REP-{investigation.id:04d}-{int(timezone.now().timestamp())}"

        # Update existing report if already created for this investigation or create new
        report, _ = Report.objects.update_or_create(
            investigation=investigation,
            defaults={
                'title': title,
                'reference_id': ref_id,
                'wallet_address': clean_addr,
                'summary': exec_summary,
                'findings': findings,
                'conclusion': ai_explanation['conclusion'],
                'status': 'completed',
                'risk_level': investigation.risk_level or 'low',
                'notes': notes or investigation.options.get('notes', ''),
                'created_by': user if user and user.is_authenticated else investigation.created_by,
            }
        )

        return report

    @classmethod
    def generate_report(
        cls,
        title: str,
        notes: str = '',
        wallet_address: str = None,
        investigation_id: int = None,
        user=None
    ) -> Report:
        """
        Legacy/Direct wrapper to support manual generation requests.
        """
        investigation = None
        if investigation_id:
            investigation = Investigation.objects.filter(id=investigation_id).first()

        if investigation:
            return cls.generate_investigation_report(investigation, user=user, notes=notes)

        # Fallback if no investigation exists: create one first to maintain DB consistency
        clean_addr = wallet_address.strip().lower() if wallet_address else '0x0000000000000000000000000000000000000000'
        wallet, _ = Wallet.objects.get_or_create(address=clean_addr, defaults={'blockchain': 'ethereum'})
        investigation = Investigation.objects.create(
            wallet=wallet,
            name=title or f"Manual Investigation - {clean_addr[:8]}",
            status='COMPLETED',
            depth=2,
            summary=f"Directly generated forensic report for {clean_addr}."
        )
        return cls.generate_investigation_report(investigation, user=user, notes=notes)
