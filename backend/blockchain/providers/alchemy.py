import logging
import requests
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional
from .base import BlockchainProvider

logger = logging.getLogger('blockchain')


class AlchemyProvider(BlockchainProvider):
    """
    Dedicated Alchemy JSON-RPC & Enhanced API provider for Ethereum and EVM chains.
    Strictly sanitizes URLs and error payloads so API keys are never exposed in logs or errors.
    """

    SUPPORTED_NETWORKS = {
        'eth-mainnet': 'https://eth-mainnet.g.alchemy.com/v2/',
        'eth-sepolia': 'https://eth-sepolia.g.alchemy.com/v2/',
        'polygon-mainnet': 'https://polygon-mainnet.g.alchemy.com/v2/',
        'arb-mainnet': 'https://arb-mainnet.g.alchemy.com/v2/',
        'opt-mainnet': 'https://opt-mainnet.g.alchemy.com/v2/',
        'base-mainnet': 'https://base-mainnet.g.alchemy.com/v2/',
    }

    def __init__(self, api_key: str = '', network: str = 'eth-mainnet', api_url: str = ''):
        clean_key = (api_key or '').strip()
        clean_network = (network or 'eth-mainnet').strip().lower()

        # Configuration validation
        if not clean_key:
            logger.error("AlchemyProvider initialization failed: ALCHEMY_API_KEY is not configured.")
            raise ValueError("ALCHEMY_API_KEY is not configured.")

        self.api_key = clean_key
        self.network = clean_network

        if api_url:
            self.endpoint_url = api_url.rstrip('/')
        else:
            base_prefix = self.SUPPORTED_NETWORKS.get(clean_network, 'https://eth-mainnet.g.alchemy.com/v2/')
            self.endpoint_url = f"{base_prefix}{self.api_key}"

        super().__init__(api_key=self.api_key, api_url=self.endpoint_url)
        self.timeout = 20

    def _sanitize_message(self, message: str) -> str:
        """Removes the raw API key from any error message or string."""
        if self.api_key and self.api_key in message:
            return message.replace(self.api_key, '[REDACTED_API_KEY]')
        return message

    def _rpc_call(self, method: str, params: list) -> Any:
        """
        Executes a JSON-RPC request against Alchemy with error handling and rate-limit traps.
        """
        payload = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': method,
            'params': params,
        }

        try:
            response = requests.post(
                self.endpoint_url,
                json=payload,
                headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                timeout=self.timeout
            )

            # Check HTTP 429 Too Many Requests
            if response.status_code == 429:
                logger.warning("Alchemy rate limit reached (HTTP 429).")
                raise RuntimeError("Alchemy API rate limit reached. Please retry in a few moments.")

            if response.status_code == 401 or response.status_code == 403:
                logger.error("Alchemy authentication rejected.")
                raise PermissionError("Alchemy authentication failed. Verify ALCHEMY_API_KEY configuration.")

            response.raise_for_status()
            data = response.json()

            # Handle JSON-RPC application error object
            if 'error' in data:
                err_obj = data['error']
                err_code = err_obj.get('code')
                err_msg = self._sanitize_message(str(err_obj.get('message', 'Alchemy RPC Error')))

                if err_code == -32000 or 'rate limit' in err_msg.lower() or 'throughput' in err_msg.lower():
                    logger.warning(f"Alchemy rate limit: {err_msg}")
                    raise RuntimeError("Alchemy throughput limit exceeded. Please back off request frequency.")

                logger.warning(f"Alchemy RPC returned error ({err_code}): {err_msg}")
                raise RuntimeError(f"Alchemy RPC Error: {err_msg}")

            return data.get('result')

        except requests.exceptions.Timeout:
            logger.error("Alchemy API request timed out.")
            raise TimeoutError("Blockchain provider timed out while querying node.")
        except requests.exceptions.RequestException as e:
            sanitized_err = self._sanitize_message(str(e))
            logger.error(f"Network error querying Alchemy: {sanitized_err}")
            raise ConnectionError(f"Unable to connect to Alchemy blockchain provider: {sanitized_err}")

    def get_wallet_transactions(
        self,
        address: str,
        page: int = 1,
        limit: int = 50,
        start_block: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Retrieves real incoming and outgoing transactions for a wallet using alchemy_getAssetTransfers.
        """
        clean_addr = address.strip().lower()

        from_block_hex = hex(start_block) if start_block else '0x0'
        max_count_hex = hex(min(100, max(10, limit)))

        # 1. Fetch incoming transfers (toAddress)
        incoming_params = [{
            'fromBlock': from_block_hex,
            'toBlock': 'latest',
            'toAddress': clean_addr,
            'category': ['external', 'erc20', 'internal'],
            'maxCount': max_count_hex,
            'order': 'desc',
            'withMetadata': True,
        }]

        # 2. Fetch outgoing transfers (fromAddress)
        outgoing_params = [{
            'fromBlock': from_block_hex,
            'toBlock': 'latest',
            'fromAddress': clean_addr,
            'category': ['external', 'erc20', 'internal'],
            'maxCount': max_count_hex,
            'order': 'desc',
            'withMetadata': True,
        }]

        incoming_res = self._rpc_call('alchemy_getAssetTransfers', incoming_params) or {}
        outgoing_res = self._rpc_call('alchemy_getAssetTransfers', outgoing_params) or {}

        raw_in = incoming_res.get('transfers', []) or []
        raw_out = outgoing_res.get('transfers', []) or []

        all_transfers = raw_in + raw_out

        normalized = []
        seen_hashes = set()

        for t in all_transfers:
            h = t.get('hash')
            if not h or h in seen_hashes:
                continue
            seen_hashes.add(h)

            # Value & asset
            val = float(t.get('value', 0) or 0)
            asset = t.get('asset') or 'ETH'

            # Block number
            block_hex = t.get('blockNum', '0x0')
            block_num = int(block_hex, 16) if block_hex and str(block_hex).startswith('0x') else None

            # Metadata timestamp
            meta = t.get('metadata', {})
            dt = None
            if meta and meta.get('blockTimestamp'):
                try:
                    dt = datetime.fromisoformat(meta['blockTimestamp'].replace('Z', '+00:00'))
                except Exception:
                    dt = None
            if not dt:
                dt = datetime.now(timezone.utc)

            sender = (t.get('from') or '').lower()
            receiver = (t.get('to') or '').lower()

            normalized.append({
                'tx_hash': h,
                'blockchain': 'ethereum',
                'sender': sender,
                'receiver': receiver,
                'asset': asset,
                'amount': val,
                'timestamp': dt,
                'block_number': block_num,
                'status': 'confirmed',
                'raw_data': t,
            })

        # Sort descending by timestamp / block
        normalized.sort(key=lambda x: x['timestamp'], reverse=True)
        return normalized

    def get_wallet_balance(self, address: str) -> Optional[float]:
        """
        Retrieves real-time native ETH balance using eth_getBalance.
        """
        clean_addr = address.strip().lower()
        res = self._rpc_call('eth_getBalance', [clean_addr, 'latest'])
        if res and isinstance(res, str) and res.startswith('0x'):
            wei = int(res, 16)
            return wei / (10 ** 18)
        return None

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves full transaction object and execution receipt for gas and status verification.
        """
        clean_hash = tx_hash.strip()
        tx = self._rpc_call('eth_getTransactionByHash', [clean_hash])
        if not tx or not isinstance(tx, dict):
            return None

        # Fetch receipt for confirmation status and gas used
        receipt = self._rpc_call('eth_getTransactionReceipt', [clean_hash]) or {}

        val_hex = tx.get('value', '0x0')
        val_wei = int(val_hex, 16) if str(val_hex).startswith('0x') else int(val_hex or 0)

        gas_price_hex = tx.get('gasPrice', '0x0')
        gas_price = int(gas_price_hex, 16) if str(gas_price_hex).startswith('0x') else 0

        gas_used_hex = receipt.get('gasUsed', '0x0')
        gas_used = int(gas_used_hex, 16) if str(gas_used_hex).startswith('0x') else 0

        fee_eth = (gas_used * gas_price) / (10 ** 18) if gas_used and gas_price else None

        receipt_status_hex = receipt.get('status')
        status = 'confirmed'
        if receipt_status_hex == '0x0':
            status = 'failed'

        block_num_hex = tx.get('blockNumber', '0x0')
        block_num = int(block_num_hex, 16) if str(block_num_hex).startswith('0x') else None

        return {
            'tx_hash': tx.get('hash'),
            'blockchain': 'ethereum',
            'sender': (tx.get('from') or '').lower(),
            'receiver': (tx.get('to') or '').lower() if tx.get('to') else '',
            'asset': 'ETH',
            'amount': val_wei / (10 ** 18),
            'timestamp': datetime.now(timezone.utc),
            'block_number': block_num,
            'status': status,
            'gas_used': gas_used,
            'gas_price': gas_price,
            'fee': fee_eth,
            'raw_data': {'transaction': tx, 'receipt': receipt},
        }

    def get_token_transfers(
        self,
        address: str,
        page: int = 1,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Retrieves ERC-20 token transfers for a wallet.
        """
        clean_addr = address.strip().lower()
        max_count_hex = hex(min(100, max(10, limit)))

        params = [{
            'fromBlock': '0x0',
            'toBlock': 'latest',
            'toAddress': clean_addr,
            'category': ['erc20'],
            'maxCount': max_count_hex,
            'order': 'desc',
            'withMetadata': True,
        }]

        res = self._rpc_call('alchemy_getAssetTransfers', params) or {}
        transfers = res.get('transfers', []) or []

        normalized = []
        for t in transfers:
            h = t.get('hash')
            if not h:
                continue

            meta = t.get('metadata', {})
            dt = None
            if meta and meta.get('blockTimestamp'):
                try:
                    dt = datetime.fromisoformat(meta['blockTimestamp'].replace('Z', '+00:00'))
                except Exception:
                    dt = None
            if not dt:
                dt = datetime.now(timezone.utc)

            block_hex = t.get('blockNum', '0x0')
            block_num = int(block_hex, 16) if block_hex and str(block_hex).startswith('0x') else None

            normalized.append({
                'tx_hash': h,
                'blockchain': 'ethereum',
                'sender': (t.get('from') or '').lower(),
                'receiver': (t.get('to') or '').lower(),
                'asset': t.get('asset') or 'TOKEN',
                'amount': float(t.get('value', 0) or 0),
                'timestamp': dt,
                'block_number': block_num,
                'status': 'confirmed',
                'raw_data': t,
            })

        return normalized

    def get_block_information(self, block_number: int) -> Optional[Dict[str, Any]]:
        """
        Retrieves block information for given block number.
        """
        hex_block = hex(block_number)
        res = self._rpc_call('eth_getBlockByNumber', [hex_block, False])
        return res if isinstance(res, dict) else None

    def test_connection(self) -> Dict[str, Any]:
        """
        Tests connection to Alchemy without exposing the private key in return values.
        """
        try:
            res = self._rpc_call('eth_blockNumber', [])
            block_num = int(res, 16) if res and isinstance(res, str) and res.startswith('0x') else None
            return {
                'provider': 'alchemy',
                'network': self.network,
                'online': True,
                'current_block': block_num,
                'status': 'connected',
            }
        except Exception as e:
            return {
                'provider': 'alchemy',
                'network': self.network,
                'online': False,
                'error': self._sanitize_message(str(e)),
                'status': 'disconnected',
            }
