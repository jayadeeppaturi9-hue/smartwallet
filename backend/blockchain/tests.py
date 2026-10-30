from unittest.mock import patch, MagicMock
from django.test import TestCase

from blockchain.validators import (
    is_valid_evm_address,
    is_valid_btc_address,
    is_valid_sol_address,
    validate_blockchain_address,
)
from blockchain.providers.alchemy import AlchemyProvider
from blockchain.services import BlockchainDataService


class BlockchainValidationTestCase(TestCase):
    def test_evm_address_validation(self):
        valid_evm = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        invalid_evm = "0xnotanaddress123"
        short_evm = "0x1234"

        self.assertTrue(is_valid_evm_address(valid_evm))
        self.assertFalse(is_valid_evm_address(invalid_evm))
        self.assertFalse(is_valid_evm_address(short_evm))

        ok, _ = validate_blockchain_address(valid_evm, 'ethereum')
        self.assertTrue(ok)

        bad, msg = validate_blockchain_address(invalid_evm, 'ethereum')
        self.assertFalse(bad)
        self.assertIn("Invalid EVM address", msg)

    def test_bitcoin_address_validation(self):
        valid_btc_p2pkh = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
        valid_btc_segwit = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
        invalid_btc = "notabtcaddress"

        self.assertTrue(is_valid_btc_address(valid_btc_p2pkh))
        self.assertTrue(is_valid_btc_address(valid_btc_segwit))
        self.assertFalse(is_valid_btc_address(invalid_btc))

    def test_solana_address_validation(self):
        valid_sol = "CuieVDEDtLo7FypA9SbLM9saXFdb1dsshveFi79yhCKP"
        invalid_sol = "0xinvalid"

        self.assertTrue(is_valid_sol_address(valid_sol))
        self.assertFalse(is_valid_sol_address(invalid_sol))


class AlchemyProviderConfigTestCase(TestCase):
    """Verifies provider configuration, initialization, and missing key safeguards."""

    DUMMY_KEY = "test_alchemy_key_placeholder_98765"

    def test_missing_api_key_raises_error(self):
        with self.assertRaises(ValueError) as ctx:
            AlchemyProvider(api_key="")
        self.assertIn("ALCHEMY_API_KEY is not configured.", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            AlchemyProvider(api_key="   ")
        self.assertIn("ALCHEMY_API_KEY is not configured.", str(ctx2.exception))

        with self.assertRaises(ValueError) as ctx3:
            AlchemyProvider(api_key=None)
        self.assertIn("ALCHEMY_API_KEY is not configured.", str(ctx3.exception))

    def test_valid_provider_initialization_default_network(self):
        provider = AlchemyProvider(api_key=self.DUMMY_KEY)
        self.assertEqual(provider.network, "eth-mainnet")
        self.assertEqual(provider.api_key, self.DUMMY_KEY)
        self.assertEqual(
            provider.endpoint_url,
            f"https://eth-mainnet.g.alchemy.com/v2/{self.DUMMY_KEY}"
        )

    def test_custom_network_configuration(self):
        provider = AlchemyProvider(api_key=self.DUMMY_KEY, network="polygon-mainnet")
        self.assertEqual(provider.network, "polygon-mainnet")
        self.assertEqual(
            provider.endpoint_url,
            f"https://polygon-mainnet.g.alchemy.com/v2/{self.DUMMY_KEY}"
        )

    def test_key_sanitization_in_messages(self):
        provider = AlchemyProvider(api_key=self.DUMMY_KEY)
        leaked = f"Request to https://eth-mainnet.g.alchemy.com/v2/{self.DUMMY_KEY} failed"
        sanitized = provider._sanitize_message(leaked)
        self.assertNotIn(self.DUMMY_KEY, sanitized)
        self.assertIn("[REDACTED_API_KEY]", sanitized)


class AlchemyProviderRpcTestCase(TestCase):
    """Verifies RPC error handling, rate-limiting, and response parsing without live keys."""

    DUMMY_KEY = "test_alchemy_key_placeholder_98765"

    def setUp(self):
        self.provider = AlchemyProvider(api_key=self.DUMMY_KEY)

    @patch("requests.post")
    def test_rate_limit_handling_http_429(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_post.return_value = mock_resp

        with self.assertRaises(RuntimeError) as ctx:
            self.provider.get_wallet_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        self.assertIn("rate limit reached", str(ctx.exception).lower())

    @patch("requests.post")
    def test_rate_limit_handling_rpc_code(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "error": {
                "code": -32000,
                "message": f"Throughput rate limit exceeded for key {self.DUMMY_KEY}"
            }
        }
        mock_post.return_value = mock_resp

        with self.assertRaises(RuntimeError) as ctx:
            self.provider.get_wallet_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        # Ensure error is sanitized and key is never revealed
        err_msg = str(ctx.exception)
        self.assertNotIn(self.DUMMY_KEY, err_msg)
        self.assertIn("throughput limit exceeded", err_msg.lower())

    @patch("requests.post")
    def test_auth_error_handling_http_401(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_post.return_value = mock_resp

        with self.assertRaises(PermissionError) as ctx:
            self.provider.get_wallet_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        self.assertIn("authentication failed", str(ctx.exception).lower())
        self.assertNotIn(self.DUMMY_KEY, str(ctx.exception))

    @patch("requests.post")
    def test_successful_balance_parsing(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # 1 ETH in hex wei = 0xde0b6b3a7640000
        mock_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": "0xde0b6b3a7640000"
        }
        mock_post.return_value = mock_resp

        balance = self.provider.get_wallet_balance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
        self.assertIsNotNone(balance)
        self.assertEqual(balance, 1.0)

    @patch("requests.post")
    def test_successful_asset_transfers_parsing(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "transfers": [
                    {
                        "blockNum": "0x112233",
                        "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                        "from": "0x1111111111111111111111111111111111111111",
                        "to": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
                        "value": 2.5,
                        "asset": "ETH",
                        "category": "external",
                        "metadata": {
                            "blockTimestamp": "2026-03-01T12:00:00.000Z"
                        }
                    }
                ]
            }
        }
        mock_post.return_value = mock_resp

        txs = self.provider.get_wallet_transactions("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
        self.assertIsInstance(txs, list)
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0]["tx_hash"], "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
        self.assertEqual(txs[0]["amount"], 2.5)
        self.assertEqual(txs[0]["asset"], "ETH")
        self.assertEqual(txs[0]["block_number"], int("0x112233", 16))

    @patch("requests.post")
    def test_empty_asset_transfers_returns_legitimate_empty_list(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "transfers": []
            }
        }
        mock_post.return_value = mock_resp

        txs = self.provider.get_wallet_transactions("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
        self.assertEqual(txs, [])

    @patch("requests.post")
    def test_successful_transaction_details_parsing(self, mock_post):
        tx_resp = MagicMock()
        tx_resp.status_code = 200
        tx_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "hash": "0xabcdef",
                "from": "0x1111",
                "to": "0x2222",
                "value": "0xde0b6b3a7640000",  # 1 ETH
                "gasPrice": "0x4a817c800",     # 20 Gwei
                "blockNumber": "0x100"
            }
        }

        receipt_resp = MagicMock()
        receipt_resp.status_code = 200
        receipt_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "status": "0x1",
                "gasUsed": "0x5208"  # 21000
            }
        }

        mock_post.side_effect = [tx_resp, receipt_resp]

        tx_details = self.provider.get_transaction("0xabcdef")
        self.assertIsNotNone(tx_details)
        self.assertEqual(tx_details["tx_hash"], "0xabcdef")
        self.assertEqual(tx_details["amount"], 1.0)
        self.assertEqual(tx_details["status"], "confirmed")
        self.assertEqual(tx_details["gas_used"], 21000)

    @patch("requests.post")
    def test_test_connection_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": "0x1346000"
        }
        mock_post.return_value = mock_resp

        status = self.provider.test_connection()
        self.assertTrue(status["online"])
        self.assertEqual(status["status"], "connected")
        self.assertEqual(status["current_block"], int("0x1346000", 16))
        self.assertNotIn(self.DUMMY_KEY, str(status))


class BlockchainDataServiceIntegrationTestCase(TestCase):
    """Verifies service layer address validation and orchestration."""

    def test_invalid_wallet_address_raises_error(self):
        mock_provider = MagicMock()
        service = BlockchainDataService(provider=mock_provider)

        with self.assertRaises(ValueError) as ctx:
            service.ingest_wallet_data("not-a-valid-ethereum-address", blockchain="ethereum")
        self.assertIn("Invalid EVM address", str(ctx.exception))
        # Ensure provider was never called for invalid address
        mock_provider.get_wallet_transactions.assert_not_called()


class BlockchainApiEndpointsTestCase(TestCase):
    """Verifies REST endpoints for blockchain testing."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()

    def test_wallet_transactions_invalid_address(self):
        resp = self.client.post('/api/blockchain/wallet-transactions/', {'address': 'not_an_eth_address'}, format='json')
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_WALLET_ADDRESS')

    def test_wallet_transactions_missing_address(self):
        resp = self.client.post('/api/blockchain/wallet-transactions/', {}, format='json')
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_ADDRESS')

    @patch('blockchain.views.get_blockchain_provider')
    def test_wallet_transactions_success(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.get_wallet_transactions.return_value = [
            {
                'tx_hash': '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                'sender': '0x1111111111111111111111111111111111111111',
                'receiver': '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
                'asset': 'ETH',
                'amount': 1.5,
                'block_number': 19000000,
                'status': 'confirmed'
            }
        ]
        mock_get_provider.return_value = mock_provider

        valid_addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        resp = self.client.post('/api/blockchain/wallet-transactions/', {'address': valid_addr}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['transactions']), 1)
        self.assertEqual(data['transactions'][0]['asset'], 'ETH')

    @patch('blockchain.views.get_blockchain_provider')
    def test_wallet_transactions_rate_limit(self, mock_get_provider):
        mock_provider = MagicMock()
        mock_provider.get_wallet_transactions.side_effect = RuntimeError("Alchemy rate limit reached.")
        mock_get_provider.return_value = mock_provider

        valid_addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        resp = self.client.post('/api/blockchain/wallet-transactions/', {'address': valid_addr}, format='json')
        self.assertEqual(resp.status_code, 429)
        data = resp.json()
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'RATE_LIMIT_EXCEEDED')


