from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Wallet, WalletRelationship
from .serializers import WalletSerializer, WalletRelationshipSerializer
from transactions.models import Transaction
from transactions.serializers import TransactionSerializer
from vasps.models import VASPAttribution
from vasps.serializers import VASPAttributionSerializer
from analysis.fund_flow_analyzer import FundFlowAnalyzer


class WalletViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/wallets/
    GET /api/wallets/<address_or_id>/
    Query wallet entities stored in the local intelligence database.
    """
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = (permissions.AllowAny,)

    def get_object(self):
        lookup = self.kwargs.get('pk')
        if lookup.isdigit():
            return get_object_or_404(Wallet, id=lookup)
        return get_object_or_404(Wallet, address__iexact=lookup.strip().lower())


class WalletCounterpartiesView(APIView):
    """
    GET /api/wallets/<address>/counterparties/
    Retrieve direct counterparties for a subject address.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, address):
        clean_addr = address.strip().lower()
        wallet = get_object_or_404(Wallet, address__iexact=clean_addr)

        txs = Transaction.objects.filter(
            blockchain=wallet.blockchain
        ).filter(
            sender__iexact=clean_addr
        ) | Transaction.objects.filter(
            blockchain=wallet.blockchain
        ).filter(
            receiver__iexact=clean_addr
        )

        flow_data = FundFlowAnalyzer.analyze_flows(txs, clean_addr, blockchain=wallet.blockchain)
        return Response(flow_data.get('top_counterparties', []))


class WalletInflowOutflowView(APIView):
    """
    GET /api/wallets/<address>/inflow-outflow/
    Retrieve balance and directional flow breakdown.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, address):
        clean_addr = address.strip().lower()
        wallet = get_object_or_404(Wallet, address__iexact=clean_addr)

        return Response({
            'address': wallet.address,
            'blockchain': wallet.blockchain,
            'current_balance': float(wallet.balance) if wallet.balance is not None else 0.0,
            'total_inflow': float(wallet.total_inflow),
            'total_outflow': float(wallet.total_outflow),
            'transaction_count': wallet.transaction_count,
            'inflow_count': wallet.inflow_count,
            'outflow_count': wallet.outflow_count,
            'risk_level': wallet.risk_level,
            'first_seen': wallet.first_seen,
            'last_seen': wallet.last_seen,
        })


class WalletVaspInteractionsView(APIView):
    """
    GET /api/wallets/<address>/vasp-interactions/
    Retrieve candidate VASP attributions and direct VASP interactions.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, address):
        clean_addr = address.strip().lower()
        wallet = get_object_or_404(Wallet, address__iexact=clean_addr)

        attributions = VASPAttribution.objects.filter(wallet=wallet).select_related('vasp')
        serializer = VASPAttributionSerializer(attributions, many=True)
        return Response(serializer.data)


class WalletTransactionsView(APIView):
    """
    GET /api/wallets/<address>/transactions/
    Retrieve transactions involving this wallet.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, address):
        clean_addr = address.strip().lower()
        wallet = get_object_or_404(Wallet, address__iexact=clean_addr)

        txs = Transaction.objects.filter(
            blockchain=wallet.blockchain
        ).filter(
            sender__iexact=clean_addr
        ) | Transaction.objects.filter(
            blockchain=wallet.blockchain
        ).filter(
            receiver__iexact=clean_addr
        )

        txs = txs.order_by('-timestamp')
        page = self.paginate_queryset(txs)
        if page is not None:
            serializer = TransactionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TransactionSerializer(txs, many=True)
        return Response(serializer.data)

    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            from common.pagination import StandardResultsSetPagination
            self._paginator = StandardResultsSetPagination()
        return self._paginator

    def paginate_queryset(self, queryset):
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)
