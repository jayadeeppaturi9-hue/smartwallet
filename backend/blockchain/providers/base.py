from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BlockchainProvider(ABC):
    """
    Abstract interface for blockchain data providers (Etherscan, Alchemy, Infura, etc.).
    """

    def __init__(self, api_key: str = '', api_url: str = ''):
        self.api_key = api_key
        self.api_url = api_url

    @abstractmethod
    def get_wallet_transactions(
        self,
        address: str,
        page: int = 1,
        limit: int = 50,
        start_block: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Retrieve normal on-chain transactions for an address.
        """
        pass

    @abstractmethod
    def get_wallet_balance(self, address: str) -> Optional[float]:
        """
        Retrieve native balance for an address.
        """
        pass

    @abstractmethod
    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve full details of a specific transaction hash.
        """
        pass

    @abstractmethod
    def get_token_transfers(
        self,
        address: str,
        page: int = 1,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Retrieve token/contract transfer events.
        """
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test provider connectivity and return status.
        """
        pass
