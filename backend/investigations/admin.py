from django.contrib import admin
from .models import Investigation
from vasps.models import VASPAttribution
from reports.models import Report


class VASPAttributionInline(admin.TabularInline):
    model = VASPAttribution
    extra = 0
    fields = ('vasp', 'score', 'confidence', 'rank', 'created_at')
    readonly_fields = ('created_at',)
    can_delete = False


class ReportInline(admin.TabularInline):
    model = Report
    extra = 0
    fields = ('title', 'status', 'risk_level', 'created_at')
    readonly_fields = ('created_at',)
    can_delete = False


@admin.register(Investigation)
class InvestigationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'wallet_address', 'blockchain', 'status', 'risk_level', 'created_by', 'created_at', 'completed_at')
    list_filter = ('status', 'risk_level', 'wallet__blockchain', 'created_at')
    search_fields = ('name', 'reference_id', 'wallet__address', 'created_by__username')
    readonly_fields = ('created_at', 'updated_at', 'started_at', 'completed_at')
    inlines = [VASPAttributionInline, ReportInline]

    def wallet_address(self, obj):
        return obj.wallet.address

    def blockchain(self, obj):
        return obj.wallet.blockchain

