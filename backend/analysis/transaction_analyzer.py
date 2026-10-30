import logging
from typing import Dict, Any, List
import pandas as pd
import numpy as np

logger = logging.getLogger('analysis')


class TransactionAnalyzer:
    """
    Analyzes normalized transactions using Pandas and NumPy to extract mathematical features.
    """

    @staticmethod
    def analyze_wallet_transactions(transactions, subject_address: str) -> Dict[str, Any]:
        clean_address = subject_address.lower().strip()

        if not transactions:
            return {
                'transaction_count': 0,
                'incoming_transaction_count': 0,
                'outgoing_transaction_count': 0,
                'total_inflow': 0.0,
                'total_outflow': 0.0,
                'net_flow': 0.0,
                'unique_counterparties': 0,
                'avg_transaction_value': 0.0,
                'median_transaction_value': 0.0,
                'std_transaction_value': 0.0,
                'frequency_hours': None,
                'inflow_outflow_ratio': 0.0,
            }

        # Convert to Pandas DataFrame
        records = []
        for tx in transactions:
            sender = (tx.sender or '').lower()
            receiver = (tx.receiver or '').lower()
            amount = float(tx.amount or 0)
            records.append({
                'tx_hash': tx.tx_hash,
                'sender': sender,
                'receiver': receiver,
                'amount': amount,
                'timestamp': tx.timestamp,
                'is_incoming': receiver == clean_address,
                'is_outgoing': sender == clean_address,
            })

        df = pd.DataFrame(records)

        # Basic calculations
        total_tx = len(df)
        incoming_df = df[df['is_incoming']]
        outgoing_df = df[df['is_outgoing']]

        incoming_count = len(incoming_df)
        outgoing_count = len(outgoing_df)

        total_inflow = float(incoming_df['amount'].sum()) if incoming_count > 0 else 0.0
        total_outflow = float(outgoing_df['amount'].sum()) if outgoing_count > 0 else 0.0
        net_flow = total_inflow - total_outflow

        # Counterparties
        counterparties = set()
        for _, row in df.iterrows():
            if row['is_incoming'] and row['sender']:
                counterparties.add(row['sender'])
            elif row['is_outgoing'] and row['receiver']:
                counterparties.add(row['receiver'])

        # Statistical analysis with NumPy
        amounts = df['amount'].to_numpy()
        avg_val = float(np.mean(amounts)) if len(amounts) > 0 else 0.0
        median_val = float(np.median(amounts)) if len(amounts) > 0 else 0.0
        std_val = float(np.std(amounts)) if len(amounts) > 0 else 0.0

        # Frequency analysis
        freq_hours = None
        if len(df) >= 2 and 'timestamp' in df:
            sorted_times = df['timestamp'].sort_values()
            diffs = sorted_times.diff().dropna()
            if len(diffs) > 0:
                mean_sec = diffs.dt.total_seconds().mean()
                freq_hours = round(mean_sec / 3600.0, 2)

        ratio = (total_inflow / total_outflow) if total_outflow > 0 else (total_inflow if total_inflow > 0 else 1.0)

        return {
            'transaction_count': total_tx,
            'incoming_transaction_count': incoming_count,
            'outgoing_transaction_count': outgoing_count,
            'total_inflow': round(total_inflow, 6),
            'total_outflow': round(total_outflow, 6),
            'net_flow': round(net_flow, 6),
            'unique_counterparties': len(counterparties),
            'avg_transaction_value': round(avg_val, 6),
            'median_transaction_value': round(median_val, 6),
            'std_transaction_value': round(std_val, 6),
            'frequency_hours': freq_hours,
            'inflow_outflow_ratio': round(ratio, 4),
        }
