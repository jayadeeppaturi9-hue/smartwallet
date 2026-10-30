from django.contrib import admin
from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('tx_hash', 'blockchain', 'sender', 'receiver', 'amount', 'asset', 'status', 'timestamp')
    list_filter = ('blockchain', 'status', 'asset', 'timestamp')
    search_fields = ('tx_hash', 'sender', 'receiver')
    readonly_fields = ('created_at',)
