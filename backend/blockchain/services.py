import logging
from decimal import Decimal
from typing import List, Dict, Any, Tuple
from django.utils import timezone

from wallets.models import Wallet, WalletRelationship
from transactions.models import Transaction
from vasps.models import VASPAddress
from .providers.factory import get_blockchain_provider
from .validators import validate_blockchain_address

logger = logging.getLogger('blockchain')


class BlockchainDataService:
    """
    Orchestrates real on-chain data ingestion, validation, and database normalization.
    """

    def __init__(self, provider=None):
        self.provider = provider or get_blockchain_provider()

    def ingest_wallet_data(
        self,
        address: str,
        blockchain: str = 'ethereum',
        depth: int = 1,
        include_tokens: bool = True
    ) -> Tuple[Wallet, List[Transaction], Dict[str, Any]]:
        """
        Validates address, retrieves real transactions from the blockchain provider,
        stores them into SQLite with deduplication, and returns (wallet, transactions, telemetry).
        """
        clean_address = address.strip().lower()

        # 1. Validation
        is_valid, err_msg = validate_blockchain_address(clean_address, blockchain)
        if not is_valid:
            logger.error(f"Validation failed for address {clean_address}: {err_msg}")
            raise ValueError(err_msg)

        # 2. Get or create Wallet entity
        wallet, _ = Wallet.objects.get_or_create(
            address=clean_address,
            blockchain=blockchain,
            defaults={'label': f"Subject {clean_address[:8]}"}
        )

        telemetry = {
            'address': clean_address,
            'blockchain': blockchain,
            'transactions_retrieved': 0,
            'new_transactions_saved': 0,
            'counterparties_found': 0,
            'errors': []
        }

        # 3. Retrieve balance from provider
        try:
            balance_val = self.provider.get_wallet_balance(clean_address)
            if balance_val is not None:
                wallet.balance = Decimal(str(balance_val))
        except Exception as e:
            logger.warning(f"Failed to fetch balance for {clean_address}: {e}")
            telemetry['errors'].append(f"Balance fetch notice: {str(e)}")

        # 4. Retrieve normal transactions from provider
        raw_txs = []
        try:
            raw_txs = self.provider.get_wallet_transactions(clean_address, page=1, limit=50)
            telemetry['transactions_retrieved'] += len(raw_txs)
        except Exception as e:
            logger.error(f"Provider error retrieving transactions for {clean_address}: {e}")
            telemetry['errors'].append(f"Transaction query notice: {str(e)}")

        # 5. Optionally retrieve token transfers
        if include_tokens:
            try:
                token_txs = self.provider.get_token_transfers(clean_address, page=1, limit=30)
                raw_txs.extend(token_txs)
                telemetry['transactions_retrieved'] += len(token_txs)
            except Exception as e:
                logger.warning(f"Could not retrieve token transfers for {clean_address}: {e}")

        # 6. Normalize and save transactions with deduplication
        saved_txs = []
        unique_counterparties = set()
        first_timestamp = None
        last_timestamp = None

        total_inflow = Decimal('0')
        total_outflow = Decimal('0')
        inflow_count = 0
        outflow_count = 0

        for tx_data in raw_txs:
            tx_hash = tx_data.get('tx_hash')
            if not tx_hash:
                continue

            sender = (tx_data.get('sender') or '').lower()
            receiver = (tx_data.get('receiver') or '').lower()
            amount_dec = Decimal(str(tx_data.get('amount', 0) or 0))
            ts = tx_data.get('timestamp') or timezone.now()

            if sender == clean_address and receiver:
                unique_counterparties.add(receiver)
                total_outflow += amount_dec
                outflow_count += 1
            elif receiver == clean_address and sender:
                unique_counterparties.add(sender)
                total_inflow += amount_dec
                inflow_count += 1

            if first_timestamp is None or ts < first_timestamp:
                first_timestamp = ts
            if last_timestamp is None or ts > last_timestamp:
                last_timestamp = ts

            tx_obj, created = Transaction.objects.get_or_create(
                tx_hash=tx_hash,
                blockchain=blockchain,
                defaults={
                    'sender': sender,
                    'receiver': receiver,
                    'asset': tx_data.get('asset', 'ETH'),
                    'amount': amount_dec,
                    'timestamp': ts,
                    'block_number': tx_data.get('block_number'),
                    'status': tx_data.get('status', 'confirmed'),
                    'gas_used': tx_data.get('gas_used'),
                    'gas_price': tx_data.get('gas_price'),
                    'fee': Decimal(str(tx_data.get('fee'))) if tx_data.get('fee') else None,
                    'raw_data': tx_data.get('raw_data', {}),
                }
            )
            if created:
                telemetry['new_transactions_saved'] += 1
            saved_txs.append(tx_obj)

        # 7. Update Wallet aggregations
        wallet.total_inflow = total_inflow
        wallet.total_outflow = total_outflow
        wallet.transaction_count = len(saved_txs)
        wallet.inflow_count = inflow_count
        wallet.outflow_count = outflow_count
        if first_timestamp:
            wallet.first_seen = first_timestamp
        if last_timestamp:
            wallet.last_seen = last_timestamp
        wallet.save()

        # 8. Record real directional fund-flow relationships from transaction evidence
        known_vasp_addrs = set(
            VASPAddress.objects.filter(blockchain=blockchain).values_list('address', flat=True)
        )
        known_vasp_addrs = {a.lower() for a in known_vasp_addrs}

        from collections import defaultdict
        pair_aggregates = defaultdict(lambda: {'count': 0, 'volume': Decimal('0'), 'first_seen': None, 'last_seen': None})

        for tx in saved_txs:
            s = (tx.sender or '').lower()
            r = (tx.receiver or '').lower()
            if not s or not r:
                continue
            amt = Decimal(str(tx.amount or 0))
            agg = pair_aggregates[(s, r)]
            agg['count'] += 1
            agg['volume'] += amt
            if tx.timestamp:
                if agg['first_seen'] is None or tx.timestamp < agg['first_seen']:
                    agg['first_seen'] = tx.timestamp
                if agg['last_seen'] is None or tx.timestamp > agg['last_seen']:
                    agg['last_seen'] = tx.timestamp

        for (s_addr, r_addr), agg in pair_aggregates.items():
            s_wallet, _ = Wallet.objects.get_or_create(
                address=s_addr,
                blockchain=blockchain,
                defaults={'label': f"Wallet {s_addr[:8]}"}
            )
            r_wallet, _ = Wallet.objects.get_or_create(
                address=r_addr,
                blockchain=blockchain,
                defaults={'label': f"Wallet {r_addr[:8]}"}
            )

            is_vasp_rel = s_addr in known_vasp_addrs or r_addr in known_vasp_addrs
            rel_type = 'VASP_INTERACTION' if is_vasp_rel else 'DIRECT_TRANSFER'
            hop_dist = 1 if (s_addr == clean_address or r_addr == clean_address) else 2

            WalletRelationship.objects.update_or_create(
                source_wallet=s_wallet,
                target_wallet=r_wallet,
                relationship_type=rel_type,
                defaults={
                    'transaction_count': agg['count'],
                    'total_volume': agg['volume'],
                    'hop_distance': hop_dist,
                    'first_seen': agg['first_seen'],
                    'last_seen': agg['last_seen'],
                }
            )

        telemetry['counterparties_found'] = len(unique_counterparties)

        # 9. If depth > 1, optionally traverse top counterparties (hop 2)
        if depth > 1 and unique_counterparties:
            top_counterparties = list(unique_counterparties)[:3]  # Limit to top 3 to respect rate limits
            for next_addr in top_counterparties:
                try:
                    hop_txs = self.provider.get_wallet_transactions(next_addr, page=1, limit=15)
                    for h_tx in hop_txs:
                        h_hash = h_tx.get('tx_hash')
                        if not h_hash:
                            continue
                        h_sender = (h_tx.get('sender') or '').lower()
                        h_receiver = (h_tx.get('receiver') or '').lower()
                        h_amt = Decimal(str(h_tx.get('amount', 0) or 0))
                        h_ts = h_tx.get('timestamp') or timezone.now()

                        h_tx_obj, _ = Transaction.objects.get_or_create(
                            tx_hash=h_hash,
                            blockchain=blockchain,
                            defaults={
                                'sender': h_sender,
                                'receiver': h_receiver,
                                'asset': h_tx.get('asset', 'ETH'),
                                'amount': h_amt,
                                'timestamp': h_ts,
                                'block_number': h_tx.get('block_number'),
                                'status': h_tx.get('status', 'confirmed'),
                                'raw_data': h_tx.get('raw_data', {}),
                            }
                        )

                        if h_sender and h_receiver:
                            hs_wallet, _ = Wallet.objects.get_or_create(
                                address=h_sender,
                                blockchain=blockchain,
                                defaults={'label': f"Wallet {h_sender[:8]}"}
                            )
                            hr_wallet, _ = Wallet.objects.get_or_create(
                                address=h_receiver,
                                blockchain=blockchain,
                                defaults={'label': f"Wallet {h_receiver[:8]}"}
                            )
                            is_h_vasp = h_sender in known_vasp_addrs or h_receiver in known_vasp_addrs
                            h_rel_type = 'VASP_INTERACTION' if is_h_vasp else 'INDIRECT_HOP'

                            WalletRelationship.objects.update_or_create(
                                source_wallet=hs_wallet,
                                target_wallet=hr_wallet,
                                relationship_type=h_rel_type,
                                defaults={
                                    'transaction_count': 1,
                                    'total_volume': h_amt,
                                    'hop_distance': 2,
                                    'first_seen': h_ts,
                                    'last_seen': h_ts,
                                }
                            )
                except Exception as hop_err:
                    logger.warning(f"Error traversing hop for {next_addr}: {hop_err}")

        return wallet, saved_txs, telemetry
