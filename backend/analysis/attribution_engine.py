import logging
from typing import List, Dict, Any
from vasps.models import VASP, VASPAddress, VASPAttribution

logger = logging.getLogger('analysis')


class VASPAttributionEngine:
    """
    Explainable, rule-based attribution scoring engine.
    Calculates candidate VASP associations strictly from observed blockchain transaction evidence
    and graph proximity.
    """

    @classmethod
    def calculate_attributions(
        cls,
        subject_address: str,
        transactions,
        graph_data: Dict[str, Any],
        investigation=None
    ) -> List[Dict[str, Any]]:
        clean_address = subject_address.lower().strip()
        blockchain = getattr(investigation.wallet, 'blockchain', 'ethereum') if investigation else 'ethereum'

        # Query all registered known VASP addresses for this blockchain
        known_addresses = VASPAddress.objects.filter(
            blockchain=blockchain
        ).select_related('vasp')

        if not known_addresses.exists():
            logger.info("No known VASP addresses registered in the database for attribution matching.")
            return []

        # Index known addresses by address string
        vasp_address_map = {}
        for va in known_addresses:
            vasp_address_map[va.address.lower()] = va

        # Candidate accumulator: vasp_id -> evidence dict
        candidate_scores = {}

        # 0. Check if the investigated wallet itself is a known VASP address (Exact Match)
        if clean_address in vasp_address_map:
            va = vasp_address_map[clean_address]
            cls._accumulate_known_match(
                candidate_scores,
                va=va,
                address_matched=clean_address
            )

        # 1. Inspect direct transactions (Hop 1)
        for tx in transactions:
            sender = (tx.sender or '').lower()
            receiver = (tx.receiver or '').lower()
            amount = float(tx.amount or 0)
            tx_time = tx.timestamp.isoformat() if tx.timestamp else None

            # Check if sender is a known VASP (and not the subject itself)
            if sender in vasp_address_map and sender != clean_address:
                va = vasp_address_map[sender]
                cls._accumulate_signal(
                    candidate_scores,
                    va=va,
                    hop=1,
                    direction='INCOMING_FROM_VASP',
                    tx_hash=tx.tx_hash,
                    amount=amount,
                    is_direct=True,
                    address_matched=sender,
                    timestamp=tx_time
                )

            # Check if receiver is a known VASP (and not the subject itself)
            if receiver in vasp_address_map and receiver != clean_address:
                va = vasp_address_map[receiver]
                cls._accumulate_signal(
                    candidate_scores,
                    va=va,
                    hop=1,
                    direction='OUTGOING_TO_VASP',
                    tx_hash=tx.tx_hash,
                    amount=amount,
                    is_direct=True,
                    address_matched=receiver,
                    timestamp=tx_time
                )

        # 2. Inspect graph nodes (Hop 2 and multi-hop paths)
        graph_nodes = graph_data.get('nodes', [])
        for node in graph_nodes:
            node_addr = (node.get('address') or '').lower()
            if node_addr and node_addr in vasp_address_map and node_addr != clean_address:
                va = vasp_address_map[node_addr]
                hops = node.get('hops', 2)
                if hops > 1:
                    cls._accumulate_signal(
                        candidate_scores,
                        va=va,
                        hop=hops,
                        direction='GRAPH_PROXIMITY',
                        tx_hash=None,
                        amount=0,
                        is_direct=False,
                        address_matched=node_addr,
                        timestamp=None
                    )

        # 3. Compute normalized scores, confidence, and ranks
        results = []
        for vasp_id, entry in candidate_scores.items():
            vasp = entry['vasp']
            is_exact = entry.get('is_exact_match', False)
            direct_count = entry['direct_interactions']
            indirect_count = entry['indirect_interactions']
            total_vol = entry['total_volume']
            min_hops = entry['min_hops']
            addr_types = list(entry['address_types'])
            addr_matched = entry['address_matched']
            source = entry.get('source') or vasp.source or 'Manual Intelligence'

            if is_exact:
                match_type = 'KNOWN_VASP_MATCH'
                rel_type = 'Known VASP Address Match'
                final_score = 98.0
                confidence = 'high'
            elif min_hops == 1:
                match_type = 'DIRECT_INTERACTION'
                rel_type = 'Direct VASP Interaction'
                score = 45.0 + min(25.0, direct_count * 5.0)
                if 'deposit_address' in addr_types:
                    score += 20.0
                elif 'hot_wallet' in addr_types:
                    score += 15.0
                else:
                    score += 10.0
                if total_vol > 0:
                    score += min(10.0, 5.0 + min(5.0, total_vol))
                final_score = min(95.0, max(25.0, round(score, 1)))
                confidence = 'high' if final_score >= 70.0 else ('medium' if final_score >= 40.0 else 'low')
            else:
                match_type = 'INDIRECT_RELATIONSHIP'
                rel_type = 'Indirect VASP Relationship'
                if min_hops == 2:
                    score = 25.0 + min(15.0, indirect_count * 3.0)
                else:
                    score = 10.0 + min(10.0, indirect_count * 2.0)
                final_score = min(60.0, max(10.0, round(score, 1)))
                confidence = 'medium' if final_score >= 40.0 else 'low'

            # Build explainable evidence breakdown (Strict separation between Observed Evidence & System Attribution)
            observed_evidence = []
            system_attribution = []

            if is_exact:
                observed_evidence.append(
                    f"Known VASP Address Match: Subject wallet {clean_address} is a verified on-chain {entry.get('address_type', 'hot wallet').replace('_', ' ')} of {vasp.name}."
                )
                observed_evidence.append(f"Intelligence Source: {source}.")
                system_attribution.append(
                    f"Direct cryptographic entity identification: High-confidence attribution linking the wallet to {vasp.name} corporate infrastructure."
                )
            else:
                for ev in entry['evidence_log']:
                    if ev['is_direct']:
                        tx_info = f" (Tx: {ev['tx_hash'][:10]}...)" if ev['tx_hash'] and ev['tx_hash'] != 'N/A' else ''
                        amt_info = f" [{ev['amount']:.4f} ETH]" if ev.get('amount') else ''
                        observed_evidence.append(
                            f"Direct on-chain transfer observed with known {ev['address_type'].replace('_', ' ')} of {vasp.name}: "
                            f"{ev['address_matched'][:10]}...{tx_info}{amt_info}"
                        )
                    else:
                        system_attribution.append(
                            f"Topological fund-flow connection detected at {ev['hop']} hops distance "
                            f"connecting to {vasp.name} cluster address {ev['address_matched'][:10]}..."
                        )

                if direct_count > 1:
                    observed_evidence.append(f"Repeated transactional interaction pattern observed ({direct_count} direct transfers).")

                system_attribution.append(
                    f"Probabilistic heuristic attribution score calculated at {final_score:.1f}% "
                    f"based on counterparty cluster density, proximity ({min_hops} hop{'s' if min_hops > 1 else ''}), and volume."
                )

            results.append({
                'vasp': vasp,
                'vasp_id': vasp.id,
                'vasp_name': vasp.name,
                'jurisdiction': vasp.jurisdiction,
                'match_type': match_type,
                'relationship_type': rel_type,
                'address_matched': addr_matched,
                'source': source,
                'score': final_score,
                'confidence': confidence,
                'interaction_count': direct_count + indirect_count,
                'distance_hops': min_hops,
                'observed_evidence': observed_evidence,
                'system_attribution': system_attribution,
                'observed_transactions': entry.get('observed_transactions', []),
                'total_volume': round(total_vol, 6),
            })

        # Sort by score descending and assign rank
        results.sort(key=lambda x: x['score'], reverse=True)
        for i, item in enumerate(results, start=1):
            item['rank'] = i

        return results

    @classmethod
    def _accumulate_known_match(cls, accumulator, va, address_matched):
        vasp_id = va.vasp.id
        accumulator[vasp_id] = {
            'vasp': va.vasp,
            'is_exact_match': True,
            'match_type': 'KNOWN_VASP_MATCH',
            'relationship_type': 'Known VASP Address Match',
            'address_matched': address_matched,
            'source': va.source or va.vasp.source,
            'address_type': va.address_type,
            'direct_interactions': 0,
            'indirect_interactions': 0,
            'total_volume': 0.0,
            'min_hops': 0,
            'address_types': {va.address_type},
            'evidence_log': [{
                'hop': 0,
                'direction': 'EXACT_IDENTITY_MATCH',
                'tx_hash': None,
                'amount': 0,
                'is_direct': True,
                'address_type': va.address_type,
                'address_matched': address_matched,
            }],
            'observed_transactions': [],
        }

    @staticmethod
    def _accumulate_signal(accumulator, va, hop, direction, tx_hash, amount, is_direct, address_matched, timestamp=None):
        vasp_id = va.vasp.id
        if vasp_id not in accumulator:
            accumulator[vasp_id] = {
                'vasp': va.vasp,
                'is_exact_match': False,
                'match_type': 'DIRECT_INTERACTION' if is_direct else 'INDIRECT_RELATIONSHIP',
                'relationship_type': 'Direct VASP Interaction' if is_direct else 'Indirect VASP Relationship',
                'address_matched': address_matched,
                'source': va.source or va.vasp.source,
                'direct_interactions': 0,
                'indirect_interactions': 0,
                'total_volume': 0.0,
                'min_hops': hop,
                'address_types': set(),
                'evidence_log': [],
                'observed_transactions': [],
            }

        acc = accumulator[vasp_id]
        if is_direct:
            acc['direct_interactions'] += 1
        else:
            acc['indirect_interactions'] += 1

        acc['total_volume'] += amount
        acc['min_hops'] = min(acc['min_hops'], hop)
        acc['address_types'].add(va.address_type)

        ev_entry = {
            'hop': hop,
            'direction': direction,
            'tx_hash': tx_hash or 'N/A',
            'amount': amount,
            'is_direct': is_direct,
            'address_type': va.address_type,
            'address_matched': address_matched,
            'timestamp': timestamp,
        }
        acc['evidence_log'].append(ev_entry)
        if tx_hash and tx_hash != 'N/A':
            acc['observed_transactions'].append({
                'tx_hash': tx_hash,
                'direction': direction,
                'amount': amount,
                'timestamp': timestamp,
                'address': address_matched,
            })
