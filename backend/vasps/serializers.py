from rest_framework import serializers
from .models import VASP, VASPAddress, VASPAttribution


class VASPAddressSerializer(serializers.ModelSerializer):
    vasp_name = serializers.CharField(source='vasp.name', read_only=True)

    class Meta:
        model = VASPAddress
        fields = [
            'id',
            'vasp',
            'vasp_name',
            'address',
            'blockchain',
            'address_type',
            'label',
            'source',
            'confidence',
            'created_at',
            'updated_at',
        ]


class VASPSerializer(serializers.ModelSerializer):
    known_addresses_count = serializers.IntegerField(source='known_addresses.count', read_only=True)

    class Meta:
        model = VASP
        fields = [
            'id',
            'name',
            'description',
            'website',
            'jurisdiction',
            'status',
            'known_addresses_count',
            'created_at',
            'updated_at',
        ]


class VASPAttributionSerializer(serializers.ModelSerializer):
    vasp_id = serializers.IntegerField(source='vasp.id', read_only=True)
    vasp_name = serializers.CharField(source='vasp.name', read_only=True)
    jurisdiction = serializers.CharField(source='vasp.jurisdiction', read_only=True)
    wallet_address = serializers.CharField(source='wallet.address', read_only=True)

    # Flatten evidence details for frontend convenience
    match_type = serializers.SerializerMethodField()
    relationship_type = serializers.SerializerMethodField()
    address_matched = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    observed_evidence = serializers.SerializerMethodField()
    system_attribution = serializers.SerializerMethodField()
    interaction_count = serializers.SerializerMethodField()
    distance_hops = serializers.SerializerMethodField()
    observed_transactions = serializers.SerializerMethodField()
    attribution_score = serializers.FloatField(source='score', read_only=True)

    class Meta:
        model = VASPAttribution
        fields = [
            'id',
            'investigation',
            'wallet_address',
            'vasp_id',
            'vasp_name',
            'jurisdiction',
            'match_type',
            'relationship_type',
            'address_matched',
            'source',
            'score',
            'attribution_score',
            'confidence',
            'rank',
            'evidence',
            'observed_evidence',
            'system_attribution',
            'interaction_count',
            'distance_hops',
            'observed_transactions',
            'created_at',
        ]
        read_only_fields = fields

    def get_match_type(self, obj):
        return obj.evidence.get('match_type', 'DIRECT_INTERACTION')

    def get_relationship_type(self, obj):
        return obj.evidence.get('relationship_type', 'Direct VASP Interaction')

    def get_address_matched(self, obj):
        return obj.evidence.get('address_matched', '')

    def get_source(self, obj):
        return obj.evidence.get('source') or getattr(obj.vasp, 'source', 'Manual Intelligence')

    def get_observed_evidence(self, obj):
        return obj.evidence.get('observed_evidence', [])

    def get_system_attribution(self, obj):
        return obj.evidence.get('system_attribution', [])

    def get_interaction_count(self, obj):
        return obj.evidence.get('interaction_count', 0)

    def get_distance_hops(self, obj):
        return obj.evidence.get('distance_hops', 1)

    def get_observed_transactions(self, obj):
        return obj.evidence.get('observed_transactions', [])
