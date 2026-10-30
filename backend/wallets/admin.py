from django.contrib import admin
from .models import Wallet, WalletRelationship


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('address', 'blockchain', 'balance', 'total_inflow', 'total_outflow', 'transaction_count', 'risk_level', 'first_seen')
    list_filter = ('blockchain', 'risk_level', 'created_at')
    search_fields = ('address', 'label')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(WalletRelationship)
class WalletRelationshipAdmin(admin.ModelAdmin):
    list_display = ('source_wallet', 'target_wallet', 'relationship_type', 'transaction_count', 'total_volume', 'hop_distance')
    list_filter = ('relationship_type', 'hop_distance')
    search_fields = ('source_wallet__address', 'target_wallet__address')
