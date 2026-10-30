from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'reference_id', 'wallet_address', 'status', 'risk_level', 'created_at')
    list_filter = ('status', 'risk_level', 'created_at')
    search_fields = ('title', 'reference_id', 'wallet_address')
    readonly_fields = ('created_at', 'updated_at')
