from django.contrib import admin
from .models import VASP, VASPAddress, VASPAttribution


class VASPAddressInline(admin.TabularInline):
    model = VASPAddress
    extra = 1
    fields = ('address', 'blockchain', 'address_type', 'label', 'confidence', 'source')


@admin.register(VASP)
class VASPAdmin(admin.ModelAdmin):
    list_display = ('name', 'jurisdiction', 'status', 'source', 'known_addresses_count', 'created_at')
    list_filter = ('status', 'jurisdiction', 'created_at')
    search_fields = ('name', 'description', 'website', 'jurisdiction')
    inlines = [VASPAddressInline]

    def known_addresses_count(self, obj):
        return obj.known_addresses.count()


@admin.register(VASPAddress)
class VASPAddressAdmin(admin.ModelAdmin):
    list_display = ('address', 'vasp', 'blockchain', 'address_type', 'confidence', 'source', 'created_at')
    list_filter = ('blockchain', 'address_type', 'vasp', 'confidence')
    search_fields = ('address', 'label', 'vasp__name', 'source')
    autocomplete_fields = ['vasp']


@admin.register(VASPAttribution)
class VASPAttributionAdmin(admin.ModelAdmin):
    list_display = ('investigation', 'wallet', 'vasp', 'score', 'confidence', 'rank', 'created_at')
    list_filter = ('confidence', 'rank', 'vasp', 'created_at')
    search_fields = ('wallet__address', 'vasp__name', 'investigation__name')
    readonly_fields = ('created_at',)
    autocomplete_fields = ['vasp']

