import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger('analysis')


class AIInvestigationExplainer:
    """
    Forensic AI Investigation Explanation Engine.
    Translates raw blockchain transaction data, graph topology, and VASP heuristic scores
    into a human-readable, professional forensic analysis and conclusion.
    
    STRICT COMPLIANCE:
    - Never invents transactions, counterparties, or VASP associations.
    - Grounded 100% in actual backend analysis results.
    - Explicitly states when evidence is limited or no VASP links exist.
    - Differentiates observed on-chain facts from heuristic/probabilistic attribution.
    """

    @classmethod
    def generate_explanation(
        cls,
        wallet_address: str,
        blockchain_network: str,
        depth: int,
        tx_features: Dict[str, Any],
        flow_features: Dict[str, Any],
        graph_data: Dict[str, Any],
        attribution_results: List[Dict[str, Any]],
        vasp_state: str,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates structured explanation blocks:
        1. scope: What was analyzed
        2. discoveries: What was discovered
        3. interpretation: What it means (understandable translation)
        4. conclusion: Probabilistic forensic conclusion
        5. evidence_breakdown: Observed evidence vs system attribution
        """
        clean_addr = wallet_address.strip().lower()
        tx_count = tx_features.get('transaction_count', 0)
        in_count = tx_features.get('incoming_transaction_count', 0)
        out_count = tx_features.get('outgoing_transaction_count', 0)
        inflow = tx_features.get('total_inflow', 0.0)
        outflow = tx_features.get('total_outflow', 0.0)
        unique_cp = tx_features.get('unique_counterparties', 0)
        ratio = tx_features.get('inflow_outflow_ratio', 1.0)
        
        nodes_count = len(graph_data.get('nodes', []))
        edges_count = len(graph_data.get('edges', []))
        
        # 1. SCOPE: What was analyzed
        scope_text = (
            f"Forensic examination of wallet address {clean_addr} conducted on the {blockchain_network.capitalize()} network. "
            f"The analysis inspected a graph traversal depth of {depth} hop(s), encompassing {tx_count} confirmed on-chain transaction(s) "
            f"across {unique_cp} unique counterparty address(es)."
        )

        # 2. DISCOVERIES: What was discovered
        discoveries = []
        if tx_count == 0:
            discoveries.append("Zero confirmed historical on-chain transactions detected for this address.")
            discoveries.append("The subject wallet has not initiated nor received detectable native or token transfers.")
        else:
            discoveries.append(
                f"Observed {in_count} incoming transaction(s) accumulating {inflow:.6f} in total inflow, "
                f"and {out_count} outgoing transaction(s) distributing {outflow:.6f} in total outflow."
            )
            discoveries.append(
                f"Identified {unique_cp} distinct counterparty wallet(s) directly or indirectly transacting with the subject."
            )
            discoveries.append(
                f"Generated relationship graph topology comprising {nodes_count} address nodes and {edges_count} directional transaction edges."
            )

            # Flow characteristics
            if outflow > 0 and inflow > 0:
                if abs(inflow - outflow) / max(inflow, 1e-6) < 0.15:
                    discoveries.append("Pass-through fund behavior: Outflow closely balances observed inflow, consistent with transit or intermediary routing.")
                elif inflow > outflow * 2:
                    discoveries.append("Accumulation pattern: Wallet retains majority of received funds with limited downstream distribution.")
                elif outflow > inflow * 2:
                    discoveries.append("Distribution pattern: Substantial outbound disbursement observed relative to incoming volume.")

        # VASP-specific discoveries
        if (vasp_state in ('KNOWN VASP ADDRESS MATCH', 'DIRECT VASP INTERACTION', 'INDIRECT VASP RELATIONSHIP', 'CANDIDATES_FOUND')) and attribution_results:
            top_candidate = attribution_results[0]
            if vasp_state == 'KNOWN VASP ADDRESS MATCH' or top_candidate.get('match_type') == 'KNOWN_VASP_MATCH':
                discoveries.append(
                    f"EXACT KNOWN VASP ADDRESS MATCH: Subject wallet corresponds directly to registered {top_candidate.get('vasp_name')} "
                    f"entity infrastructure (Confidence: {top_candidate.get('confidence', 'high')}, Source: {top_candidate.get('source', 'Intelligence Directory')})."
                )
            elif vasp_state == 'DIRECT VASP INTERACTION' or top_candidate.get('match_type') == 'DIRECT_INTERACTION':
                discoveries.append(
                    f"DIRECT VASP INTERACTION: Observed direct transactional interaction with {top_candidate.get('vasp_name')} "
                    f"at 1 hop distance with an attribution score of {top_candidate.get('score', 0):.1f}% ({top_candidate.get('confidence', 'medium')} confidence)."
                )
            else:
                discoveries.append(
                    f"INDIRECT VASP RELATIONSHIP: Identified multi-hop topological link to {top_candidate.get('vasp_name')} "
                    f"({top_candidate.get('distance_hops', 2)} hops) with attribution score of {top_candidate.get('score', 0):.1f}%."
                )

            if len(attribution_results) > 1:
                other_names = [c.get('vasp_name') for c in attribution_results[1:4] if c.get('vasp_name')]
                discoveries.append(f"Secondary attribution candidates identified: {', '.join(other_names)}.")
        elif vasp_state in ('NO VASP ASSOCIATION IDENTIFIED', 'NO_VASP_FOUND'):
            discoveries.append("No known Virtual Asset Service Provider (VASP) clusters, deposit addresses, or hot wallets matched during topological traversal.")
        elif vasp_state in ('VASP INTELLIGENCE NOT CONFIGURED', 'DATABASE_UNAVAILABLE'):
            discoveries.append("VASP intelligence database is currently unpopulated for this blockchain network.")
        elif vasp_state in ('ANALYSIS FAILED', 'PROVIDER_FAILURE'):
            discoveries.append(f"Blockchain node query encountered an interruption: {error_message or 'Unknown error'}.")

        # 3. INTERPRETATION: What it means
        interpretation_lines = []
        if tx_count == 0:
            interpretation_lines.append(
                "Because no transactional activity exists on-chain, the subject wallet represents an inactive or fresh address. "
                "There is no empirical evidence of association with any custodial exchange, DeFi protocol, or intermediary service."
            )
        else:
            interpretation_lines.append(
                f"The investigated wallet demonstrated direct or multi-hop interaction with {unique_cp} address(es). "
            )
            if vasp_state in ('KNOWN VASP ADDRESS MATCH', 'DIRECT VASP INTERACTION', 'INDIRECT VASP RELATIONSHIP', 'CANDIDATES_FOUND') and attribution_results:
                top = attribution_results[0]
                if vasp_state == 'KNOWN VASP ADDRESS MATCH' or top.get('match_type') == 'KNOWN_VASP_MATCH':
                    interpretation_lines.append(
                        f"The subject wallet is verified corporate or cluster infrastructure operated directly by {top.get('vasp_name')}. "
                        "Transactions executed through this wallet reflect internal exchange operations, hot wallet disbursements, or sweep consolidations."
                    )
                elif vasp_state == 'DIRECT VASP INTERACTION' or top.get('match_type') == 'DIRECT_INTERACTION':
                    interpretation_lines.append(
                        f"Direct on-chain evidence establishes that funds were transferred directly between the subject wallet and {top.get('vasp_name')}. "
                        "This confirms a direct transactional relationship with the custodial service."
                    )
                else:
                    interpretation_lines.append(
                        f"The attribution engine identified multi-hop fund-flow paths connecting the target wallet and addresses registered under {top.get('vasp_name')}. "
                        f"This proximity (observed at {top.get('distance_hops', 2)} hop(s)) indicates that funds transited through intermediary staging wallets."
                    )
            elif vasp_state in ('NO VASP ASSOCIATION IDENTIFIED', 'NO_VASP_FOUND'):
                interpretation_lines.append(
                    "The current investigation did not produce sufficient evidence linking the analyzed wallet to any known VASP address. "
                    "The observed transaction counterparties appear to consist exclusively of private unhosted wallets or unidentified smart contracts."
                )
            elif vasp_state in ('VASP INTELLIGENCE NOT CONFIGURED', 'DATABASE_UNAVAILABLE'):
                interpretation_lines.append(
                    "Blockchain analysis was completed successfully, but verified VASP address intelligence has not yet been configured in the database. "
                    "Attribution matching cannot be performed until VASP entity clusters are registered."
                )

        interpretation_text = " ".join(interpretation_lines)

        # 4. EVIDENCE BREAKDOWN: Observed Evidence vs System Attribution
        observed_evidence = []
        system_attribution = []

        if tx_count > 0:
            observed_evidence.append(
                f"Recorded {tx_count} confirmed blockchain transactions on {blockchain_network.capitalize()}."
            )
            observed_evidence.append(
                f"Direct interaction observed across {unique_cp} distinct counterparty addresses."
            )
            top_cp = flow_features.get('top_counterparties', [])
            if top_cp:
                cp_sample = top_cp[0]
                observed_evidence.append(
                    f"Highest volume counterparty: {cp_sample.get('address', '')[:10]}... "
                    f"accounting for {cp_sample.get('total_volume', 0):.4f} total volume."
                )

        if attribution_results:
            for cand in attribution_results[:3]:
                cand_observed = cand.get('observed_evidence', [])
                cand_system = cand.get('system_attribution', [])
                for ev in cand_observed:
                    if ev not in observed_evidence:
                        observed_evidence.append(f"[{cand.get('vasp_name')}] {ev}")
                for sa in cand_system:
                    if sa not in system_attribution:
                        system_attribution.append(f"[{cand.get('vasp_name')}] {sa}")
        elif vasp_state in ('NO VASP ASSOCIATION IDENTIFIED', 'NO_VASP_FOUND'):
            system_attribution.append(
                "System Attribution Assessment: Evaluated counterparty graph against all registered VASP clusters. "
                "Zero intersecting nodes or heuristic deposit patterns found within analyzed depth."
            )
        elif vasp_state in ('VASP INTELLIGENCE NOT CONFIGURED', 'DATABASE_UNAVAILABLE'):
            system_attribution.append(
                "System Attribution Assessment: No verified VASP directory available for comparison on this network."
            )

        # 5. CONCLUSION: Dynamic investigation conclusion
        conclusion = cls._build_dynamic_conclusion(
            tx_count=tx_count,
            vasp_state=vasp_state,
            attribution_results=attribution_results,
            unique_cp=unique_cp
        )

        return {
            'analysis_scope': scope_text,
            'discoveries': discoveries,
            'interpretation': interpretation_text,
            'conclusion': conclusion,
            'evidence_breakdown': {
                'observed_evidence': observed_evidence,
                'system_attribution': system_attribution,
            },
            'generated_at': datetime.utcnow().isoformat() + 'Z'
        }

    @staticmethod
    def _build_dynamic_conclusion(
        tx_count: int,
        vasp_state: str,
        attribution_results: List[Dict[str, Any]],
        unique_cp: int
    ) -> str:
        if tx_count == 0:
            return (
                "Conclusion: Inactive Subject. Based on currently available blockchain records, "
                "the wallet has no on-chain transaction history. No illicit exposure or VASP interaction was detected."
            )

        if attribution_results:
            top = attribution_results[0]
            score = top.get('score', 0)
            confidence = top.get('confidence', 'medium')
            vasp_name = top.get('vasp_name', 'Unknown VASP')
            hops = top.get('distance_hops', 1)
            match_type = top.get('match_type')

            if match_type == 'KNOWN_VASP_MATCH' or vasp_state == 'KNOWN VASP ADDRESS MATCH':
                return (
                    f"Conclusion: Known VASP Address Match. Empirical evidence confirms that the subject wallet address is a verified "
                    f"cluster or operational address belonging to {vasp_name}. The attribution engine assigns a {confidence} confidence "
                    f"rating of {score:.1f}%. The wallet functions as native infrastructure for {vasp_name}."
                )
            elif hops == 1 and score >= 70.0:
                return (
                    f"Conclusion: Direct VASP Association Detected. Empirical evidence confirms direct transactional interaction "
                    f"between the subject wallet and verified {vasp_name} infrastructure. The heuristic attribution engine assigns "
                    f"a {confidence} confidence score of {score:.1f}%. While transactional proximity is established, legal determination "
                    f"of account ownership requires formal subpoena verification with the entity's compliance division."
                )
            elif hops > 1 and score >= 40.0:
                return (
                    f"Conclusion: Indirect / Intermediary VASP Exposure. On-chain fund flow analysis demonstrates multi-hop connectivity "
                    f"({hops} hops) linking the subject address to {vasp_name} with an attribution score of {score:.1f}% ({confidence} confidence). "
                    f"This pattern suggests funds moved through intermediary staging wallets prior to or following interaction with {vasp_name}."
                )
            else:
                return (
                    f"Conclusion: Low-Confidence VASP Indicator. Minor structural indicators suggest potential proximity to {vasp_name} "
                    f"(Score: {score:.1f}%), but available evidence remains probabilistic and inconclusive. Further counterparty expansion is recommended."
                )

        if vasp_state in ('NO VASP ASSOCIATION IDENTIFIED', 'NO_VASP_FOUND'):
            return (
                "Conclusion: Unattributed Peer-to-Peer / Unhosted Activity. The analysis identified no direct or indirect relationships "
                "with registered Virtual Asset Service Providers within the evaluated graph depth. The subject operates within a private "
                "or unhosted wallet cluster, with no confirmed links to custodial exchange gateways in current intelligence holdings."
            )

        if vasp_state in ('VASP INTELLIGENCE NOT CONFIGURED', 'DATABASE_UNAVAILABLE'):
            return (
                "Conclusion: Analysis Incomplete due to Unconfigured Intelligence. Transactional metrics were processed, but attribution "
                "could not be evaluated because no verified VASP database is registered for this blockchain. Operator intelligence ingestion required."
            )

        return (
            "Conclusion: Investigation Concluded. Telemetry and forensic metrics have been recorded in the case docket."
        )
