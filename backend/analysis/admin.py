from django.contrib import admin
from .models import AnalysisResult


@admin.register(AnalysisResult)
class AnalysisResultAdmin(admin.ModelAdmin):
    list_display = ('id', 'investigation', 'analysis_type', 'summary_preview', 'created_at')
    list_filter = ('analysis_type', 'created_at')
    search_fields = ('investigation__name', 'investigation__wallet__address', 'summary')
    readonly_fields = ('created_at', 'updated_at')

    def summary_preview(self, obj):
        return (obj.summary[:75] + '...') if len(obj.summary) > 75 else obj.summary
