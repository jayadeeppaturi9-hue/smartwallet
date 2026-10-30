import logging
from typing import Dict, Any, List
from collections import defaultdict
from vasps.models import VASPAddress

logger = logging.getLogger('analysis')


class FundFlowAnalyzer:
    """
    Analyzes directional fund movement, counterparty aggregations, and VASP interactions.
    """

    @staticmethod
    def analyze_flows(transactions, subject_address: str, blockchain: str = 'ethereum') -> Dict[str, Any]:
        clean_address = subject_address.lower().strip()

        counterparty_volume = defaultdict(float)
        counterparty_count = defaultdict(int)
        counterparty_direction = defaultdict(lambda: {'in': 0, 'out': 0})

        inflow_timeline = []
        outflow_timeline = []

        # Check against known VASP addresses in database
        known_vasp_map = {}
        for va in VASPAddress.objects.filter(blockchain=blockchain).select_related('vasp'):
            known_vasp_map[va.address.lower()] = {
                'vasp_id': va.vasp.id,
                'vasp_name': va.vasp.name,
                'address_type': va.address_type,
                'confidence': va.confidence,
            }

        vasp_interactions = []
        seen_vasp_tx = set()

        for tx in transactions:
            sender = (tx.sender or '').lower()
            receiver = (tx.receiver or '').lower()
            amount = float(tx.amount or 0)
            date_str = tx.timestamp.strftime('%Y-%m-%d') if tx.timestamp else ''

            if receiver == clean_address:
                # Inflow
                cp = sender
                if cp:
                    counterparty_volume[cp] += amount
                    counterparty_count[cp] += 1
                    counterparty_direction[cp]['in'] += 1
                inflow_timeline.append({'date': date_str, 'amount': amount})

                # Check if sender is a known VASP
                if sender in known_vasp_map and tx.tx_hash not in seen_vasp_tx:
                    seen_vasp_tx.add(tx.tx_hash)
                    v_info = known_vasp_map[sender]
                    vasp_interactions.append({
                        'tx_hash': tx.tx_hash,
                        'vasp_id': v_info['vasp_id'],
                        'vasp_name': v_info['vasp_name'],
                        'direction': 'INCOMING_FROM_VASP',
                        'address_type': v_info['address_type'],
                        'amount': amount,
                        'timestamp': tx.timestamp.isoformat() if tx.timestamp else None,
                    })

            elif sender == clean_address:
                # Outflow
                cp = receiver
                if cp:
                    counterparty_volume[cp] += amount
                    counterparty_count[cp] += 1
                    counterparty_direction[cp]['out'] += 1
                outflow_timeline.append({'date': date_str, 'amount': amount})

                # Check if receiver is a known VASP
                if receiver in known_vasp_map and tx.tx_hash not in seen_vasp_tx:
                    seen_vasp_tx.add(tx.tx_hash)
                    v_info = known_vasp_map[receiver]
                    vasp_interactions.append({
                        'tx_hash': tx.tx_hash,
                        'vasp_id': v_info['vasp_id'],
                        'vasp_name': v_info['vasp_name'],
                        'direction': 'OUTGOING_TO_VASP',
                        'address_type': v_info['address_type'],
                        'amount': amount,
                        'timestamp': tx.timestamp.isoformat() if tx.timestamp else None,
                    })

        # Sort top counterparties
        sorted_cp = sorted(counterparty_volume.items(), key=lambda x: x[1], reverse=True)
        top_counterparties = []
        for cp_addr, vol in sorted_cp[:15]:
            is_vasp = cp_addr in known_vasp_map
            vasp_name = known_vasp_map[cp_addr]['vasp_name'] if is_vasp else None
            top_counterparties.append({
                'address': cp_addr,
                'total_volume': round(vol, 6),
                'transaction_count': counterparty_count[cp_addr],
                'directions': counterparty_direction[cp_addr],
                'is_known_vasp': is_vasp,
                'vasp_name': vasp_name,
            })

        return {
            'top_counterparties': top_counterparties,
            'direct_vasp_interactions': vasp_interactions,
            'total_vasp_interactions_count': len(vasp_interactions),
            'unique_counterparties_count': len(counterparty_volume),
        }
