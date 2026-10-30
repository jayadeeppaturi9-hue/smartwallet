from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Q
from django.shortcuts import get_object_or_404

from wallets.models import Wallet
from transactions.models import Transaction
from investigations.models import Investigation
from .builder import GraphBuilder


class GraphView(APIView):
    """
    GET /api/graph/
    GET /api/investigations/<id>/graph/
    Dynamically generates the NetworkX relationship graph and exports Cytoscape.js { nodes: [], edges: [] }.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, investigation_id=None):
        inv_id = investigation_id or request.query_params.get('investigation_id')
        wallet_param = request.query_params.get('wallet_address') or request.query_params.get('wallet')
        depth = min(3, max(1, int(request.query_params.get('depth', 2))))

        target_address = None
        blockchain = 'ethereum'

        if inv_id and str(inv_id).isdigit():
            investigation = get_object_or_404(Investigation, id=int(inv_id))
            target_address = investigation.wallet.address
            blockchain = investigation.wallet.blockchain
        elif wallet_param:
            target_address = wallet_param.strip().lower()
            w = Wallet.objects.filter(address__iexact=target_address).first()
            if w:
                blockchain = w.blockchain

        if not target_address:
            return Response({'nodes': [], 'edges': [], 'summary': {}})

        # Query all on-chain transactions related to this cluster
        txs = Transaction.objects.filter(blockchain=blockchain).filter(
            Q(sender__iexact=target_address) | Q(receiver__iexact=target_address)
        )

        # If counterparties exist, also pull their mutual transactions
        counterparties = set()
        for t in txs[:50]:
            if t.sender:
                counterparties.add(t.sender.lower())
            if t.receiver:
                counterparties.add(t.receiver.lower())

        if counterparties and depth > 1:
            all_txs = Transaction.objects.filter(blockchain=blockchain).filter(
                Q(sender__in=counterparties) | Q(receiver__in=counterparties)
            )[:150]
        else:
            all_txs = txs

        # Build NetworkX graph
        G = GraphBuilder.build_networkx_graph(
            subject_address=target_address,
            transactions=all_txs,
            max_depth=depth,
            blockchain=blockchain
        )

        elements = GraphBuilder.export_cytoscape_elements(G, max_depth=depth)
        return Response(elements)
