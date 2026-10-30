from rest_framework import serializers
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id',
            'tx_hash',
            'blockchain',
            'sender',
            'receiver',
            'asset',
            'amount',
            'timestamp',
            'block_number',
            'status',
            'gas_used',
            'gas_price',
            'fee',
            'direction',
            'raw_data',
            'created_at',
        ]
        read_only_fields = fields

    def get_direction(self, obj):
        request = self.context.get('request')
        if not request:
            return 'INTERNAL'
        wallet = request.query_params.get('wallet_address') or request.query_params.get('wallet')
        if not wallet:
            return 'INTERNAL'
        clean = wallet.strip().lower()
        if (obj.sender or '').lower() == clean:
            return 'OUT'
        if (obj.receiver or '').lower() == clean:
            return 'IN'
        return 'INTERNAL'
