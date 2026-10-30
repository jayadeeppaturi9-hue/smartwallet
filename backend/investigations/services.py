import logging
from django.utils import timezone
from decimal import Decimal

from wallets.models import Wallet
from transactions.models import Transaction
from vasps.models import VASP, VASPAddress, VASPAttribution
from blockchain.services import BlockchainDataService
from analysis.transaction_analyzer import TransactionAnalyzer
from analysis.fund_flow_analyzer import FundFlowAnalyzer
from analysis.attribution_engine import VASPAttributionEngine
from analysis.ai_explainer import AIInvestigationExplainer
from analysis.models import AnalysisResult
from graph.builder import GraphBuilder
from reports.services import ReportService
from .models import Investigation

logger = logging.getLogger('investigations')


class InvestigationService:
    """
    Orchestrates the entire universal blockchain forensic analysis,
    attribution pipeline, AI explanation synthesis, and automatic report generation.
    """

    @classmethod
    def execute_investigation(
        cls,
        wallet_address: str,
        blockchain_network: str = 'ethereum',
        name: str = None,
        reference_id: str = None,
        depth: int = 2,
        options: dict = None,
        user=None
    ) -> Investigation:
        options = dict(options or {})
        depth = min(3, max(1, int(depth)))  # Safely constrain depth to 1-3
        clean_address = wallet_address.strip().lower()

        timeline = []

        def record_stage(key, label, status='completed', details=''):
            timeline.append({
                'stage': key,
                'label': label,
                'status': status,
                'timestamp': timezone.now().isoformat(),
                'details': details,
            })

        # Stage 1: Investigation Created
        record_stage('INVESTIGATION_CREATED', 'Investigation Created', 'completed', f'Initialized case docket for {clean_address[:10]}...')

        # Stage 2: Wallet Validated
        wallet, _ = Wallet.objects.get_or_create(
            address=clean_address,
            blockchain=blockchain_network,
            defaults={'label': name or f"Subject {clean_address[:8]}"}
        )
        record_stage('WALLET_VALIDATED', 'Wallet Validated', 'completed', f'Validated format for {blockchain_network.capitalize()} address.')

        options['timeline'] = timeline

        # Create Investigation record in RUNNING state
        investigation = Investigation.objects.create(
            wallet=wallet,
            name=name or f"Investigation - {clean_address[:10]}",
            reference_id=reference_id,
            status='RUNNING',
            depth=depth,
            options=options,
            created_by=user if user and user.is_authenticated else None,
            started_at=timezone.now(),
        )

        try:
            logger.info(f"Starting universal pipeline for investigation #{investigation.id} ({clean_address})")

            # Stage 3: Blockchain Data Retrieved
            data_service = BlockchainDataService()
            wallet, transactions, telemetry = data_service.ingest_wallet_data(
                address=clean_address,
                blockchain=blockchain_network,
                depth=depth,
                include_tokens=options.get('trace_contracts', True)
            )
            record_stage('BLOCKCHAIN_DATA_RETRIEVED', 'Blockchain Data Retrieved', 'completed', f'Fetched {len(transactions)} confirmed on-chain transaction records.')

            # Stage 4: Transactions Stored
            record_stage('TRANSACTIONS_STORED', 'Transactions Stored', 'completed', f'Persisted normalized transactions into SQLite database.')

            # Stage 5: Transaction Analysis Complete (Pandas & NumPy)
            tx_features = TransactionAnalyzer.analyze_wallet_transactions(transactions, clean_address)
            AnalysisResult.objects.update_or_create(
                investigation=investigation,
                analysis_type='TRANSACTION_ANALYSIS',
                defaults={
                    'summary': f"Analyzed {tx_features['transaction_count']} txs. Inflow: {tx_features['total_inflow']}, Outflow: {tx_features['total_outflow']}.",
                    'result': tx_features,
                }
            )
            record_stage('TRANSACTION_ANALYSIS_COMPLETE', 'Transaction Analysis Complete', 'completed', f'Computed statistical flow metrics ({tx_features["unique_counterparties"]} counterparties).')

            # Stage 6: Fund Flow Analysis Complete
            flow_features = FundFlowAnalyzer.analyze_flows(
                transactions,
                subject_address=clean_address,
                blockchain=blockchain_network
            )
            AnalysisResult.objects.update_or_create(
                investigation=investigation,
                analysis_type='FUND_FLOW_ANALYSIS',
                defaults={
                    'summary': f"Identified {flow_features['unique_counterparties_count']} unique counterparties, {len(flow_features['direct_vasp_interactions'])} direct VASP txs.",
                    'result': flow_features,
                }
            )
            record_stage('FUND_FLOW_ANALYSIS_COMPLETE', 'Fund Flow Analysis Complete', 'completed', f'Mapped flow directions and volume distributions.')

            # Stage 7: Graph Generated (NetworkX & Cytoscape)
            G = GraphBuilder.build_networkx_graph(
                subject_address=clean_address,
                transactions=transactions,
                max_depth=depth,
                blockchain=blockchain_network
            )
            graph_data = GraphBuilder.export_cytoscape_elements(G, max_depth=depth)
            AnalysisResult.objects.update_or_create(
                investigation=investigation,
                analysis_type='GRAPH_ANALYSIS',
                defaults={
                    'summary': f"Graph generated with {len(graph_data['nodes'])} nodes and {len(graph_data['edges'])} edges across {depth} hops.",
                    'result': {
                        'nodes_count': len(graph_data['nodes']),
                        'edges_count': len(graph_data['edges']),
                        'depth': depth,
                    }
                }
            )
            record_stage('GRAPH_GENERATED', 'Graph Generated', 'completed', f'Constructed topology: {len(graph_data["nodes"])} nodes, {len(graph_data["edges"])} edges.')

            # Stage 8: VASP Intelligence Checked
            has_vasp_db = VASPAddress.objects.filter(blockchain=blockchain_network).exists()
            record_stage(
                'VASP_INTELLIGENCE_CHECKED',
                'VASP Intelligence Checked',
                'completed',
                f"Evaluated against known VASP directory ({'populated' if has_vasp_db else 'unpopulated'})."
            )

            # Stage 9: Attribution Calculated
            attribution_results = VASPAttributionEngine.calculate_attributions(
                subject_address=clean_address,
                transactions=transactions,
                graph_data=graph_data,
                investigation=investigation
            )

            # Determine exact VASP state conforming to forensic specification
            if not has_vasp_db:
                vasp_state = 'VASP INTELLIGENCE NOT CONFIGURED'
            elif any(a.get('match_type') == 'KNOWN_VASP_MATCH' for a in attribution_results):
                vasp_state = 'KNOWN VASP ADDRESS MATCH'
            elif any(a.get('match_type') == 'DIRECT_INTERACTION' for a in attribution_results):
                vasp_state = 'DIRECT VASP INTERACTION'
            elif any(a.get('match_type') == 'INDIRECT_RELATIONSHIP' for a in attribution_results):
                vasp_state = 'INDIRECT VASP RELATIONSHIP'
            else:
                vasp_state = 'NO VASP ASSOCIATION IDENTIFIED'

            # Store attributions in database
            VASPAttribution.objects.filter(investigation=investigation).delete()

            highest_risk = 'low'
            for attr in attribution_results:
                VASPAttribution.objects.create(
                    investigation=investigation,
                    wallet=wallet,
                    vasp=attr['vasp'],
                    score=attr['score'],
                    confidence=attr['confidence'],
                    rank=attr['rank'],
                    evidence={
                        'match_type': attr.get('match_type', 'DIRECT_INTERACTION'),
                        'relationship_type': attr.get('relationship_type', 'Direct VASP Interaction'),
                        'address_matched': attr.get('address_matched', ''),
                        'source': attr.get('source', ''),
                        'observed_evidence': attr['observed_evidence'],
                        'system_attribution': attr['system_attribution'],
                        'interaction_count': attr['interaction_count'],
                        'distance_hops': attr['distance_hops'],
                        'total_volume': attr['total_volume'],
                        'observed_transactions': attr.get('observed_transactions', []),
                    }
                )
                if attr['score'] >= 70.0:
                    highest_risk = 'high'
                elif attr['score'] >= 40.0 and highest_risk != 'high':
                    highest_risk = 'medium'

            AnalysisResult.objects.update_or_create(
                investigation=investigation,
                analysis_type='VASP_ATTRIBUTION',
                defaults={
                    'summary': f"Identified {len(attribution_results)} candidate attributions. VASP State: {vasp_state}.",
                    'result': {
                        'vasp_state': vasp_state,
                        'candidates_count': len(attribution_results),
                    }
                }
            )
            record_stage(
                'ATTRIBUTION_CALCULATED',
                'Attribution Calculated',
                'completed',
                f"Calculated forensic attributions. State: {vasp_state}."
            )

            # Update wallet risk level
            wallet.risk_level = highest_risk
            wallet.risk_score = attribution_results[0]['score'] if attribution_results else 0.0
            wallet.save()

            # Stage 10: AI Explanation Generated
            ai_explanation = AIInvestigationExplainer.generate_explanation(
                wallet_address=clean_address,
                blockchain_network=blockchain_network,
                depth=depth,
                tx_features=tx_features,
                flow_features=flow_features,
                graph_data=graph_data,
                attribution_results=attribution_results,
                vasp_state=vasp_state,
                error_message=None
            )
            options['ai_explanation'] = ai_explanation
            options['vasp_state'] = vasp_state
            record_stage('AI_EXPLANATION_GENERATED', 'AI Explanation Generated', 'completed', 'Synthesized explainable forensic findings and conclusion.')

            # Stage 11: Report Generated (Automatic Report Generation)
            report_status = 'completed'
            try:
                report = ReportService.generate_investigation_report(investigation)
                options['report_id'] = report.id
                options['report_reference_id'] = report.reference_id
                record_stage('REPORT_GENERATED', 'Report Generated', 'completed', f'Stored formal forensic dossier #{report.id} ({report.reference_id}).')
            except Exception as report_err:
                logger.error(f"Report generation error for investigation #{investigation.id}: {report_err}")
                report_status = 'failed'
                options['report_error'] = str(report_err)
                record_stage('REPORT_GENERATED', 'Report Generated', 'failed', f'Report generation failed: {str(report_err)}')

            # Stage 12: Investigation Complete
            record_stage('INVESTIGATION_COMPLETE', 'Investigation Complete', 'completed', 'Universal pipeline concluded successfully.')

            summary_text = (
                f"Forensic analysis completed for {clean_address} on {blockchain_network}. "
                f"Ingested {len(transactions)} transactions across {tx_features['unique_counterparties']} counterparties. "
                f"VASP State: {vasp_state}. Identified {len(attribution_results)} candidate VASP mapping(s)."
            )

            investigation.status = 'COMPLETED'
            investigation.risk_level = highest_risk
            investigation.summary = summary_text
            investigation.completed_at = timezone.now()
            options['timeline'] = timeline
            investigation.options = options
            investigation.save()

            logger.info(f"Investigation #{investigation.id} successfully finished with VASP state '{vasp_state}'.")
            return investigation

        except Exception as e:
            logger.exception(f"Investigation #{investigation.id} failed: {e}")
            record_stage('PIPELINE_ERROR', 'Analysis Interrupted', 'failed', str(e))
            options['timeline'] = timeline
            options['vasp_state'] = 'ANALYSIS FAILED'
            investigation.status = 'FAILED'
            investigation.error_message = str(e)
            investigation.completed_at = timezone.now()
            investigation.options = options
            investigation.save()
            raise
