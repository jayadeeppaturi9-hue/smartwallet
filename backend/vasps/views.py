from rest_framework import viewsets, generics, permissions
from common.permissions import IsAdminOrReadOnly
from .models import VASP, VASPAddress, VASPAttribution
from .serializers import VASPSerializer, VASPAddressSerializer, VASPAttributionSerializer


class VASPViewSet(viewsets.ModelViewSet):
    """
    GET /api/vasps/
    POST /api/vasps/ (Admin)
    GET /api/vasps/<id>/
    Manage VASP entity intelligence registry.
    """
    queryset = VASP.objects.all().prefetch_related('known_addresses')
    serializer_class = VASPSerializer
    permission_classes = (IsAdminOrReadOnly,)


class VASPAddressViewSet(viewsets.ModelViewSet):
    """
    GET /api/vasps/<vasp_id>/addresses/
    POST /api/vasps/<vasp_id>/addresses/ (Admin)
    Manage known cluster and deposit addresses associated with a VASP.
    """
    serializer_class = VASPAddressSerializer
    permission_classes = (IsAdminOrReadOnly,)

    def get_queryset(self):
        vasp_id = self.kwargs.get('vasp_pk') or self.request.query_params.get('vasp_id')
        if vasp_id:
            return VASPAddress.objects.filter(vasp_id=vasp_id)
        return VASPAddress.objects.all()


class VASPAttributionListView(generics.ListAPIView):
    """
    GET /api/vasps/attributions/
    Retrieve attribution candidates with filtering by wallet_address or investigation_id.
    """
    serializer_class = VASPAttributionSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        qs = VASPAttribution.objects.all().select_related('vasp', 'wallet', 'investigation')

        wallet = self.request.query_params.get('wallet_address')
        if wallet:
            qs = qs.filter(wallet__address__iexact=wallet.strip().lower())

        inv_id = self.request.query_params.get('investigation_id')
        if inv_id and inv_id.isdigit():
            qs = qs.filter(investigation_id=int(inv_id))

        confidence = self.request.query_params.get('confidence')
        if confidence and confidence != 'all':
            qs = qs.filter(confidence__iexact=confidence)

        return qs.order_by('rank', '-score')
