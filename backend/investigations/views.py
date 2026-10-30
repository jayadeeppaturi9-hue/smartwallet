import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate

from .models import Investigation
from .serializers import InvestigationSerializer, CreateInvestigationSerializer
from .services import InvestigationService
from wallets.models import Wallet
from transactions.models import Transaction
from vasps.models import VASPAttribution
from reports.models import Report
from reports.serializers import ReportSerializer
from reports.services import ReportService

logger = logging.getLogger('investigations')


class InvestigationViewSet(viewsets.ModelViewSet):
    """
    GET /api/investigations/
    POST /api/investigations/
    GET /api/investigations/<id>/
    DELETE /api/investigations/<id>/
    Manage forensic investigation cases.
    """
    permission_classes = (permissions.AllowAny,)
    serializer_class = InvestigationSerializer

    def get_queryset(self):
        qs = Investigation.objects.all().select_related('wallet').prefetch_related('attributions__vasp', 'reports')
        wallet_param = self.request.query_params.get('wallet_address') or self.request.query_params.get('wallet')
        if wallet_param:
            qs = qs.filter(wallet__address__iexact=wallet_param.strip().lower())
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = CreateInvestigationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            investigation = InvestigationService.execute_investigation(
                wallet_address=data['wallet_address'],
                blockchain_network=data.get('blockchain_network', 'ethereum'),
                name=data.get('name'),
                reference_id=data.get('reference_id'),
                depth=data.get('depth', 2),
                options=data.get('options', {}),
                user=request.user
            )
            response_serializer = InvestigationSerializer(investigation)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as val_err:
            return Response(
                {'detail': str(val_err), 'wallet_address': [str(val_err)]},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.exception(f"Error creating investigation: {e}")
            return Response(
                {'detail': f"Investigation execution failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """GET /api/investigations/<id>/status/"""
        inv = self.get_object()
        serializer = InvestigationSerializer(inv)
        return Response({
            'id': inv.id,
            'status': inv.status,
            'timeline': serializer.data.get('timeline', []),
            'vasp_state': serializer.data.get('vasp_state'),
            'started_at': inv.started_at,
            'completed_at': inv.completed_at,
            'error_message': inv.error_message,
        })

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """GET /api/investigations/<id>/results/"""
        inv = self.get_object()
        serializer = InvestigationSerializer(inv)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def generate_report(self, request, pk=None):
        """
        POST /api/investigations/<id>/generate_report/
        Allows generating or re-generating the official forensic report for an investigation.
        """
        inv = self.get_object()
        try:
            report = ReportService.generate_investigation_report(inv, user=request.user)
            serializer = ReportSerializer(report)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Failed to generate report for investigation #{inv.id}: {e}")
            return Response(
                {'detail': f"Report generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """
        GET /api/investigations/<id>/report/
        Returns the existing forensic report for this investigation or generates it if missing.
        """
        inv = self.get_object()
        report = inv.reports.first()
        if not report:
            try:
                report = ReportService.generate_investigation_report(inv, user=request.user)
            except Exception as e:
                return Response(
                    {'detail': f"Report not found and generation failed: {str(e)}"},
                    status=status.HTTP_404_NOT_FOUND
                )
        serializer = ReportSerializer(report)
        return Response(serializer.data)


class DashboardStatsView(APIView):
    """
    GET /api/dashboard/stats/ or /api/dashboard/
    Calculates aggregated KPIs and chart distribution data directly from database records.
    When the database has zero records, returns genuine zero counts.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        total_inv = Investigation.objects.count()
        completed_inv = Investigation.objects.filter(status='COMPLETED').count()
        failed_inv = Investigation.objects.filter(status='FAILED').count()
        total_wallets = Wallet.objects.count()
        total_tx = Transaction.objects.count()
        total_vasp = VASPAttribution.objects.count()
        total_reports = Report.objects.count()

        # Dynamic confidence distribution from stored attributions
        conf_counts = (
            VASPAttribution.objects.values('confidence')
            .annotate(count=Count('id'))
            .order_by('confidence')
        )
        conf_distribution = [
            {'category': item['confidence'].capitalize(), 'count': item['count']}
            for item in conf_counts
        ]

        # Dynamic transaction volume trend over time from stored transactions
        daily_vol = (
            Transaction.objects.annotate(date=TruncDate('timestamp'))
            .values('date')
            .annotate(volume=Sum('amount'))
            .order_by('date')[:14]
        )
        volume_trends = [
            {
                'date': item['date'].strftime('%b %d') if item['date'] else '',
                'volume': round(float(item['volume'] or 0), 4)
            }
            for item in daily_vol
        ]

        return Response({
            'total_investigations': total_inv,
            'completed_investigations': completed_inv,
            'failed_investigations': failed_inv,
            'wallets_analyzed': total_wallets,
            'transactions_analyzed': total_tx,
            'vasp_candidates': total_vasp,
            'reports_generated': total_reports,
            # Legacy keys compatibility
            'investigations': total_inv,
            'total_wallets_analyzed': total_wallets,
            'total_transactions_analyzed': total_tx,
            'total_vasp_matches': total_vasp,
            'vasp_matches': total_vasp,
            'confidence_distribution': conf_distribution,
            'volume_trends': volume_trends,
        })
