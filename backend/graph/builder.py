import logging
from typing import Dict, Any, List
import networkx as nx
from vasps.models import VASPAddress

logger = logging.getLogger('analysis')


class GraphBuilder:
    """
    Builds a NetworkX directed graph from actual transactions and exports Cytoscape.js elements.
    Ensures clear hierarchical role classification:
    1. Target Wallet
    2. Direct Counterparties (1 Hop)
    3. Intermediary Wallets (2+ Hops)
    4. Known VASP Addresses
    """

    @classmethod
    def build_networkx_graph(
        cls,
        subject_address: str,
        transactions,
        max_depth: int = 2,
        blockchain: str = 'ethereum'
    ) -> nx.DiGraph:
        G = nx.DiGraph()
        clean_target = subject_address.lower().strip()

        # Query known VASP addresses for node classification
        known_vasps = {}
        for va in VASPAddress.objects.filter(blockchain=blockchain).select_related('vasp'):
            known_vasps[va.address.lower()] = {
                'vasp_name': va.vasp.name,
                'address_type': va.address_type,
            }

        # Add target subject node (Tier 1)
        G.add_node(
            clean_target,
            label=f"Target: {clean_target[:6]}...{clean_target[-4:]}",
            short_address=f"{clean_target[:6]}...{clean_target[-4:]}",
            type='target',
            role='target',
            tier=1,
            is_vasp=False,
            vasp_name=None,
            hops=0,
            address=clean_target,
            total_in=0.0,
            total_out=0.0,
            tx_count=0,
        )

        # Build graph from transactions
        for tx in transactions:
            sender = (tx.sender or '').lower()
            receiver = (tx.receiver or '').lower()
            amount = float(tx.amount or 0)
            asset = tx.asset or 'ETH'

            if not sender or not receiver:
                continue

            # Classify sender node
            if sender not in G:
                is_v = sender in known_vasps
                short = f"{sender[:6]}...{sender[-4:]}"
                G.add_node(
                    sender,
                    label=known_vasps[sender]['vasp_name'] if is_v else short,
                    short_address=short,
                    type='vasp' if is_v else 'wallet',
                    role='vasp' if is_v else 'wallet',
                    tier=4 if is_v else 2,
                    is_vasp=is_v,
                    vasp_name=known_vasps[sender]['vasp_name'] if is_v else None,
                    hops=1 if receiver == clean_target else 2,
                    address=sender,
                    total_in=0.0,
                    total_out=0.0,
                    tx_count=0,
                )

            # Classify receiver node
            if receiver not in G:
                is_v = receiver in known_vasps
                short = f"{receiver[:6]}...{receiver[-4:]}"
                G.add_node(
                    receiver,
                    label=known_vasps[receiver]['vasp_name'] if is_v else short,
                    short_address=short,
                    type='vasp' if is_v else 'wallet',
                    role='vasp' if is_v else 'wallet',
                    tier=4 if is_v else 2,
                    is_vasp=is_v,
                    vasp_name=known_vasps[receiver]['vasp_name'] if is_v else None,
                    hops=1 if sender == clean_target else 2,
                    address=receiver,
                    total_in=0.0,
                    total_out=0.0,
                    tx_count=0,
                )

            # Accumulate node flow stats
            G.nodes[sender]['total_out'] += amount
            G.nodes[sender]['tx_count'] += 1
            G.nodes[receiver]['total_in'] += amount
            G.nodes[receiver]['tx_count'] += 1

            # Add or update edge
            if G.has_edge(sender, receiver):
                edge_data = G[sender][receiver]
                edge_data['count'] += 1
                edge_data['amount'] += amount
            else:
                is_direct = (sender == clean_target or receiver == clean_target)
                G.add_edge(
                    sender,
                    receiver,
                    count=1,
                    amount=amount,
                    asset=asset,
                    is_direct=is_direct,
                    label=f"{amount:.4f} {asset}".strip() if amount > 0 else '',
                )

        # Update shortest path hops and hierarchical tiers relative to target subject
        for node in G.nodes():
            if node == clean_target:
                continue
            try:
                u_dist = nx.shortest_path_length(G.to_undirected(), source=clean_target, target=node)
                G.nodes[node]['hops'] = u_dist
            except nx.NetworkXNoPath:
                G.nodes[node]['hops'] = 3

            # Update tier and role
            is_v = G.nodes[node].get('is_vasp', False)
            hops = G.nodes[node].get('hops', 2)
            if is_v:
                G.nodes[node]['role'] = 'vasp'
                G.nodes[node]['tier'] = 4
            elif hops == 1:
                G.nodes[node]['role'] = 'direct_counterparty'
                G.nodes[node]['tier'] = 2
            else:
                G.nodes[node]['role'] = 'intermediary'
                G.nodes[node]['tier'] = 3

        return G

    @classmethod
    def export_cytoscape_elements(cls, G: nx.DiGraph, max_depth: int = 3) -> Dict[str, List[Dict[str, Any]]]:
        """
        Converts the NetworkX DiGraph into Cytoscape.js compatible { "nodes": [], "edges": [] }.
        """
        nodes = []
        edges = []

        for node_id, data in G.nodes(data=True):
            hops = data.get('hops', 0)
            if hops > max_depth:
                continue

            nodes.append({
                'id': node_id,
                'address': data.get('address', node_id),
                'short_address': data.get('short_address', f"{node_id[:6]}...{node_id[-4:]}"),
                'label': data.get('label', node_id[:8]),
                'type': data.get('type', 'wallet'),
                'role': data.get('role', 'wallet'),
                'tier': data.get('tier', 2),
                'is_vasp': data.get('is_vasp', False),
                'vasp_name': data.get('vasp_name'),
                'hops': hops,
                'tx_count': data.get('tx_count', 0),
                'total_in': round(data.get('total_in', 0.0), 6),
                'total_out': round(data.get('total_out', 0.0), 6),
                'risk_level': 'high' if data.get('is_vasp') else ('critical' if data.get('tier') == 1 else 'low'),
            })

        for u, v, data in G.edges(data=True):
            if G.nodes[u].get('hops', 0) <= max_depth and G.nodes[v].get('hops', 0) <= max_depth:
                edges.append({
                    'id': f"edge-{u[:8]}-{v[:8]}",
                    'source': u,
                    'target': v,
                    'amount': round(data.get('amount', 0), 6),
                    'asset': data.get('asset', 'ETH'),
                    'count': data.get('count', 1),
                    'label': data.get('label', ''),
                    'is_direct': data.get('is_direct', False),
                })

        target_node = next((n['address'] for n in nodes if n.get('role') == 'target'), None)
        summary = {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'target_wallet': target_node,
            'direct_counterparties': sum(1 for n in nodes if n.get('hops') == 1),
            'intermediary_wallets': sum(1 for n in nodes if n.get('hops', 0) > 1 and not n.get('is_vasp')),
            'vasp_linked_nodes': sum(1 for n in nodes if n.get('is_vasp')),
            'traversal_depth': max_depth,
        }

        return {
            'nodes': nodes,
            'edges': edges,
            'summary': summary,
        }
