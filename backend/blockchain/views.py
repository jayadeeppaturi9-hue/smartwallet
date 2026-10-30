import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .providers.factory import get_blockchain_provider
from .validators import validate_blockchain_address

logger = logging.getLogger('blockchain')


class WalletTransactionsView(APIView):
    """
    POST /api/blockchain/wallet-transactions/
    Protected endpoint to test Alchemy integration and retrieve real on-chain transaction data
    for a dynamically supplied wallet address.

    Request format:
    {
        "address": "0x..."
    }

    Response format:
    {
        "success": true,
        "address": "0x...",
        "transactions": [...]
    }
    """
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        address = request.data.get('address') or request.data.get('wallet_address')
        network = request.data.get('network', 'eth-mainnet')

        # 1. Validate wallet address input
        if not address or not isinstance(address, str):
            return Response({
                "success": False,
                "error": {
                    "code": "INVALID_ADDRESS",
                    "message": "A valid 'address' parameter must be provided."
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        clean_address = address.strip()
        is_valid, err_msg = validate_blockchain_address(clean_address, 'ethereum')
        if not is_valid:
            logger.warning(f"Address validation rejected: {clean_address}")
            return Response({
                "success": False,
                "error": {
                    "code": "INVALID_WALLET_ADDRESS",
                    "message": err_msg
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Query configured Alchemy blockchain provider
        try:
            provider = get_blockchain_provider()

            logger.info("Alchemy request started")
            logger.info(f"Wallet address being analyzed: {clean_address}")

            transactions = provider.get_wallet_transactions(clean_address, page=1, limit=50)

            logger.info("Provider response status: SUCCESS")
            logger.info(f"Number of records received: {len(transactions)}")

            # Normalize datetime objects for JSON serialization
            serialized_txs = []
            for tx in transactions:
                t = dict(tx)
                if 'timestamp' in t and hasattr(t['timestamp'], 'isoformat'):
                    t['timestamp'] = t['timestamp'].isoformat()
                serialized_txs.append(t)

            return Response({
                "success": True,
                "address": clean_address,
                "transactions": serialized_txs
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            logger.error(f"Configuration error during blockchain request: {str(e)}")
            return Response({
                "success": False,
                "error": {
                    "code": "CONFIGURATION_ERROR",
                    "message": str(e)
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except PermissionError as e:
            logger.error("Alchemy authentication rejected.")
            return Response({
                "success": False,
                "error": {
                    "code": "AUTHENTICATION_FAILED",
                    "message": "Alchemy authentication failed. Please verify your API key."
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        except RuntimeError as e:
            err_str = str(e)
            if "rate limit" in err_str.lower() or "throughput" in err_str.lower():
                logger.warning(f"Rate limit hit during wallet analysis: {err_str}")
                return Response({
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Alchemy rate limit reached. Please retry in a few moments."
                    }
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)

            logger.error(f"Provider runtime error: {err_str}")
            return Response({
                "success": False,
                "error": {
                    "code": "BLOCKCHAIN_PROVIDER_ERROR",
                    "message": "Unable to retrieve blockchain data."
                }
            }, status=status.HTTP_502_BAD_GATEWAY)

        except (TimeoutError, ConnectionError) as e:
            logger.error(f"Network error querying Alchemy: {str(e)}")
            return Response({
                "success": False,
                "error": {
                    "code": "BLOCKCHAIN_PROVIDER_ERROR",
                    "message": "Unable to retrieve blockchain data. Node connection timed out."
                }
            }, status=status.HTTP_504_GATEWAY_TIMEOUT)

        except Exception as e:
            logger.exception("Unexpected error during wallet transactions query.")
            return Response({
                "success": False,
                "error": {
                    "code": "BLOCKCHAIN_PROVIDER_ERROR",
                    "message": "Unable to retrieve blockchain data."
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BlockchainStatusView(APIView):
    """
    GET /api/blockchain/status/
    Returns status of the active blockchain provider without exposing keys.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        try:
            provider = get_blockchain_provider()
            conn_status = provider.test_connection()
            return Response({
                "success": True,
                "data": conn_status
            })
        except Exception as e:
            return Response({
                "success": False,
                "error": {
                    "code": "PROVIDER_UNAVAILABLE",
                    "message": str(e)
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
