import sys
from django.core.management.base import BaseCommand
from blockchain.providers.factory import get_blockchain_provider
from blockchain.validators import validate_blockchain_address


class Command(BaseCommand):
    help = "Verifies live Alchemy blockchain provider connectivity and retrieves real transactions for a supplied wallet address."

    def add_arguments(self, parser):
        parser.add_argument(
            'address',
            nargs='?',
            type=str,
            default='',
            help='Cryptocurrency wallet address to query (e.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)'
        )

    def handle(self, *args, **options):
        address = (options.get('address') or '').strip()

        self.stdout.write(self.style.MIGRATE_HEADING("=== ALCHEMY BLOCKCHAIN INTEGRATION VERIFICATION ==="))

        # 1. Initialize provider
        try:
            provider = get_blockchain_provider()
            self.stdout.write(f"Active Provider: {provider.__class__.__name__}")
            self.stdout.write(f"Target Network:  {provider.network}")
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Provider initialization failed: {e}"))
            sys.exit(1)

        # 2. Test live node connection
        status_info = provider.test_connection()
        if status_info.get('online'):
            self.stdout.write(self.style.SUCCESS(
                f"[OK] Node Connection Online! Current Block Height: {status_info.get('current_block'):,}"
            ))
        else:
            self.stderr.write(self.style.ERROR(
                f"[FAIL] Node Connection Offline: {status_info.get('error')}"
            ))
            sys.exit(1)

        # 3. If no address provided, exit after health confirmation
        if not address:
            self.stdout.write(self.style.WARNING(
                "\nProvide a wallet address to query transactions: python manage.py verify_alchemy <0xAddress>"
            ))
            return

        # 4. Validate supplied address
        is_valid, err_msg = validate_blockchain_address(address, 'ethereum')
        if not is_valid:
            self.stderr.write(self.style.ERROR(f"[INVALID ADDRESS] {err_msg}"))
            sys.exit(1)

        clean_addr = address.lower()
        self.stdout.write(f"\nAnalyzing supplied wallet: {clean_addr}")

        # 5. Fetch live ETH balance
        try:
            balance = provider.get_wallet_balance(clean_addr)
            if balance is not None:
                self.stdout.write(self.style.SUCCESS(f"Native Balance: {balance:.6f} ETH"))
            else:
                self.stdout.write("Native Balance: (Not Available)")
        except Exception as e:
            self.stderr.write(self.style.WARNING(f"Could not retrieve balance: {e}"))

        # 6. Fetch asset transfers
        try:
            self.stdout.write("Querying asset transfers via alchemy_getAssetTransfers...")
            txs = provider.get_wallet_transactions(clean_addr, page=1, limit=10)
            self.stdout.write(self.style.SUCCESS(f"Retrieved {len(txs)} transaction(s) from Alchemy:"))

            for i, tx in enumerate(txs[:5], start=1):
                direction = "OUT" if (tx.get('sender') or '').lower() == clean_addr else "IN"
                self.stdout.write(
                    f"  {i}. [{direction}] {tx.get('asset')} {tx.get('amount')} | "
                    f"Hash: {tx.get('tx_hash')[:16]}... | "
                    f"Block: {tx.get('block_number')}"
                )

            if len(txs) > 5:
                self.stdout.write(f"  ... and {len(txs) - 5} more transactions.")

            if not txs:
                self.stdout.write("  (No on-chain transfers found for this address. Legitimate empty result.)")

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error querying wallet transactions: {e}"))
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Alchemy integration fully functional!"))
