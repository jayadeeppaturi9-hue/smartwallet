import logging
from django.conf import settings
from .base import BlockchainProvider
from .alchemy import AlchemyProvider
from .etherscan import EtherscanProvider

logger = logging.getLogger('blockchain')


def get_blockchain_provider() -> BlockchainProvider:
    """
    Factory function returning the active BlockchainProvider instance based on Django settings.
    Defaults to Alchemy as requested. Detects missing configuration cleanly without exposing secrets.
    """
    provider_name = getattr(settings, 'BLOCKCHAIN_PROVIDER', 'alchemy').lower()

    if provider_name == 'alchemy':
        alchemy_key = getattr(settings, 'ALCHEMY_API_KEY', '').strip()
        alchemy_network = getattr(settings, 'ALCHEMY_NETWORK', 'eth-mainnet').strip()

        if not alchemy_key:
            logger.warning("ALCHEMY_API_KEY is not configured in environment settings.")
            raise ValueError("ALCHEMY_API_KEY is not configured.")

        # Log instantiation safely without exposing the API key
        masked_key = f"{alchemy_key[:4]}...{alchemy_key[-4:]}" if len(alchemy_key) > 8 else "***"
        logger.info(f"Instantiating AlchemyProvider (Network: {alchemy_network}, Key: {masked_key})")
        return AlchemyProvider(api_key=alchemy_key, network=alchemy_network)

    if provider_name == 'etherscan':
        etherscan_key = getattr(settings, 'BLOCKCHAIN_API_KEY', '').strip()
        etherscan_url = getattr(settings, 'BLOCKCHAIN_API_URL', 'https://api.etherscan.io/api')
        logger.info(f"Instantiating EtherscanProvider ({etherscan_url})")
        return EtherscanProvider(api_key=etherscan_key, api_url=etherscan_url)

    raise ValueError(f"Unsupported blockchain provider '{provider_name}'. Supported providers: alchemy, etherscan")
