import logging
import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from .base import BlockchainProvider

logger = logging.getLogger('blockchain')


class EtherscanProvider(BlockchainProvider):
    """
    Etherscan API provider implementation for EVM chains.
    """

    def __init__(self, api_key: str = '', api_url: str = 'https://api.etherscan.io/api'):
        super().__init__(api_key=api_key, api_url=api_url or 'https://api.etherscan.io/api')
        self.timeout = 15

    def _make_request(self, params: Dict[str, Any]) -> Any:
        full_params = params.copy()
        if self.api_key:
            full_params['apikey'] = self.api_key

        try:
            response = requests.get(self.api_url, params=full_params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()

            # Handle Etherscan rate limits or API notices
            status = str(data.get('status', ''))
            message = str(data.get('message', ''))

            if status == '0' and message != 'No transactions found':
                error_msg = data.get('result', message)
                logger.warning(f"Etherscan notice/error: {error_msg}")
                # Rate limit hit or invalid key
                if 'rate limit' in str(error_msg).lower():
                    raise RuntimeError(f"Etherscan rate limit reached: {error_msg}")
                if 'invalid api key' in str(error_msg).lower():
                    raise RuntimeError("Etherscan reported invalid API key.")

            return data
        except requests.exceptions.Timeout:
            logger.error("Timeout connecting to Etherscan API provider.")
            raise TimeoutError("Blockchain provider timed out while querying node.")
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error querying Etherscan: {e}")
            raise ConnectionError(f"Network error connecting to blockchain provider: {str(e)}")

    def get_wallet_transactions(
        self,
        address: str,
        page: int = 1,
        limit: int = 50,
        start_block: int = 0
    ) -> List[Dict[str, Any]]:
        params = {
            'module': 'account',
            'action': 'txlist',
            'address': address,
            'startblock': start_block,
            'endblock': 99999999,
            'page': page,
            'offset': limit,
            'sort': 'desc'
        }

        data = self._make_request(params)
        raw_txs = data.get('result', [])
        if not isinstance(raw_txs, list):
            return []

        normalized = []
        for tx in raw_txs:
            try:
                # Convert timestamp from unix epoch
                ts = int(tx.get('timeStamp', 0))
                dt = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)

                # Convert wei to ETH
                val_wei = int(tx.get('value', 0))
                val_eth = val_wei / (10 ** 18)

                gas_used = int(tx.get('gasUsed', 0))
                gas_price = int(tx.get('gasPrice', 0))
                fee_eth = (gas_used * gas_price) / (10 ** 18) if gas_used and gas_price else None

                is_error = tx.get('isError') == '1' or tx.get('txreceipt_status') == '0'

                normalized.append({
                    'tx_hash': tx.get('hash'),
                    'blockchain': 'ethereum',
                    'sender': tx.get('from', '').lower(),
                    'receiver': tx.get('to', '').lower() if tx.get('to') else '',
                    'asset': 'ETH',
                    'amount': val_eth,
                    'timestamp': dt,
                    'block_number': int(tx.get('blockNumber', 0)) if tx.get('blockNumber') else None,
                    'status': 'failed' if is_error else 'confirmed',
                    'gas_used': gas_used,
                    'gas_price': gas_price,
                    'fee': fee_eth,
                    'raw_data': tx,
                })
            except Exception as parse_err:
                logger.warning(f"Error parsing Etherscan transaction: {parse_err}")
                continue

        return normalized

    def get_wallet_balance(self, address: str) -> Optional[float]:
        params = {
            'module': 'account',
            'action': 'balance',
            'address': address,
            'tag': 'latest'
        }
        try:
            data = self._make_request(params)
            raw_balance = data.get('result')
            if raw_balance and str(raw_balance).isdigit():
                return int(raw_balance) / (10 ** 18)
            return None
        except Exception as e:
            logger.warning(f"Could not retrieve balance for {address}: {e}")
            return None

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        params = {
            'module': 'proxy',
            'action': 'eth_getTransactionByHash',
            'txhash': tx_hash
        }
        try:
            data = self._make_request(params)
            raw = data.get('result')
            if not raw or not isinstance(raw, dict):
                return None

            val_hex = raw.get('value', '0x0')
            val_wei = int(val_hex, 16) if val_hex.startswith('0x') else int(val_hex)
            val_eth = val_wei / (10 ** 18)

            return {
                'tx_hash': raw.get('hash'),
                'blockchain': 'ethereum',
                'sender': raw.get('from', '').lower(),
                'receiver': raw.get('to', '').lower() if raw.get('to') else '',
                'amount': val_eth,
                'asset': 'ETH',
                'block_number': int(raw.get('blockNumber', '0x0'), 16) if raw.get('blockNumber') else None,
                'raw_data': raw,
            }
        except Exception as e:
            logger.warning(f"Could not retrieve transaction {tx_hash}: {e}")
            return None

    def get_token_transfers(
        self,
        address: str,
        page: int = 1,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        params = {
            'module': 'account',
            'action': 'tokentx',
            'address': address,
            'page': page,
            'offset': limit,
            'sort': 'desc'
        }
        try:
            data = self._make_request(params)
            raw_transfers = data.get('result', [])
            if not isinstance(raw_transfers, list):
                return []

            normalized = []
            for tx in raw_transfers:
                decimals = int(tx.get('tokenDecimal', 18) or 18)
                val_raw = int(tx.get('value', 0) or 0)
                amount = val_raw / (10 ** decimals)
                ts = int(tx.get('timeStamp', 0))
                dt = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)

                normalized.append({
                    'tx_hash': tx.get('hash'),
                    'blockchain': 'ethereum',
                    'sender': tx.get('from', '').lower(),
                    'receiver': tx.get('to', '').lower() if tx.get('to') else '',
                    'asset': tx.get('tokenSymbol', 'TOKEN'),
                    'amount': amount,
                    'timestamp': dt,
                    'block_number': int(tx.get('blockNumber', 0)) if tx.get('blockNumber') else None,
                    'status': 'confirmed',
                    'raw_data': tx,
                })
            return normalized
        except Exception as e:
            logger.warning(f"Error fetching token transfers for {address}: {e}")
            return []

    def test_connection(self) -> Dict[str, Any]:
        try:
            # Query latest block number proxy
            data = self._make_request({'module': 'proxy', 'action': 'eth_blockNumber'})
            block_hex = data.get('result')
            block_num = int(block_hex, 16) if block_hex and str(block_hex).startswith('0x') else None
            return {
                'provider': 'etherscan',
                'online': True,
                'current_block': block_num,
                'api_url': self.api_url,
            }
        except Exception as e:
            return {
                'provider': 'etherscan',
                'online': False,
                'error': str(e),
                'api_url': self.api_url,
            }
