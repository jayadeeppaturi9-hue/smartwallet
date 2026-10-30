from rest_framework import viewsets, permissions
from django.db.models import Q
from django.shortcuts import get_object_or_404

from .models import Transaction
from .serializers import TransactionSerializer


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/transactions/
    GET /api/transactions/<id_or_hash>/
    Query paginated blockchain transactions with flexible filtering.
    """
    serializer_class = TransactionSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        qs = Transaction.objects.all()

        inv_id = self.request.query_params.get('investigation_id') or self.request.query_params.get('investigation')
        if inv_id:
            try:
                from investigations.models import Investigation
                inv = Investigation.objects.filter(id=inv_id).select_related('wallet').first()
                if inv and inv.wallet:
                    clean = inv.wallet.address.strip().lower()
                    qs = qs.filter(Q(sender__iexact=clean) | Q(receiver__iexact=clean))
            except Exception:
                pass

        wallet = self.request.query_params.get('wallet_address') or self.request.query_params.get('wallet')
        if wallet:
            clean = wallet.strip().lower()
            qs = qs.filter(Q(sender__iexact=clean) | Q(receiver__iexact=clean))

        direction = self.request.query_params.get('direction')
        if direction and wallet:
            clean = wallet.strip().lower()
            d = direction.upper()
            if d in ('IN', 'INFLOW'):
                qs = qs.filter(receiver__iexact=clean)
            elif d in ('OUT', 'OUTFLOW'):
                qs = qs.filter(sender__iexact=clean)

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)

        asset = self.request.query_params.get('asset')
        if asset:
            qs = qs.filter(asset__iexact=asset)

        search = self.request.query_params.get('search')
        if search:
            s = search.strip()
            qs = qs.filter(
                Q(tx_hash__icontains=s) |
                Q(sender__icontains=s) |
                Q(receiver__icontains=s)
            )

        return qs.order_by('-timestamp')

    def get_object(self):
        lookup = self.kwargs.get('pk')
        if lookup.isdigit():
            return get_object_or_404(Transaction, id=lookup)
        return get_object_or_404(Transaction, tx_hash__iexact=lookup.strip())
