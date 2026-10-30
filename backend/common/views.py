from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.conf import settings
from blockchain.providers.factory import get_blockchain_provider


class HealthCheckView(APIView):
    """
    GET /api/health/ or /api/status/
    Performs system health check and verifies active blockchain provider connectivity.
    Never exposes API keys or sensitive credentials in response payloads.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        try:
            provider = get_blockchain_provider()
            provider_status = provider.test_connection()
        except Exception as e:
            provider_status = {
                'provider': getattr(settings, 'BLOCKCHAIN_PROVIDER', 'alchemy'),
                'online': False,
                'error': str(e),
                'status': 'unconfigured',
            }

        return Response({
            'status': 'healthy',
            'database': 'sqlite3',
            'provider': provider_status,
            'cors_origins': settings.CORS_ALLOWED_ORIGINS,
            'debug': settings.DEBUG,
        })


class SupportedNetworksView(APIView):
    """
    GET /api/config/networks/
    Returns supported blockchain networks configured in the backend.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        networks = [
            {'id': 'ethereum', 'name': 'Ethereum Mainnet', 'symbol': 'ETH', 'chainId': 1},
            {'id': 'bitcoin', 'name': 'Bitcoin', 'symbol': 'BTC'},
            {'id': 'polygon', 'name': 'Polygon PoS', 'symbol': 'MATIC', 'chainId': 137},
            {'id': 'arbitrum', 'name': 'Arbitrum One', 'symbol': 'ARB', 'chainId': 42161},
            {'id': 'optimism', 'name': 'OP Mainnet', 'symbol': 'OP', 'chainId': 10},
            {'id': 'binance-smart-chain', 'name': 'BNB Smart Chain', 'symbol': 'BNB', 'chainId': 56},
            {'id': 'avalanche', 'name': 'Avalanche C-Chain', 'symbol': 'AVAX', 'chainId': 43114},
            {'id': 'base', 'name': 'Base', 'symbol': 'ETH', 'chainId': 8453},
            {'id': 'solana', 'name': 'Solana', 'symbol': 'SOL'},
            {'id': 'tron', 'name': 'Tron', 'symbol': 'TRX'},
        ]
        return Response(networks)
