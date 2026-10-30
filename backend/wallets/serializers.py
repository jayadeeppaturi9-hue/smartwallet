from rest_framework import serializers
from .models import Wallet, WalletRelationship


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = [
            'id',
            'address',
            'blockchain',
            'label',
            'balance',
            'total_inflow',
            'total_outflow',
            'transaction_count',
            'inflow_count',
            'outflow_count',
            'risk_score',
            'risk_level',
            'first_seen',
            'last_seen',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class WalletRelationshipSerializer(serializers.ModelSerializer):
    source_address = serializers.CharField(source='source_wallet.address', read_only=True)
    target_address = serializers.CharField(source='target_wallet.address', read_only=True)

    class Meta:
        model = WalletRelationship
        fields = [
            'id',
            'source_address',
            'target_address',
            'relationship_type',
            'transaction_count',
            'total_volume',
            'hop_distance',
            'created_at',
        ]
