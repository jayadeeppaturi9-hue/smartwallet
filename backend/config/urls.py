from django.contrib import admin
from django.urls import path, include
from common.views import HealthCheckView, SupportedNetworksView
from investigations.views import DashboardStatsView
from graph.views import GraphView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Health & System Diagnostics
    path('api/health/', HealthCheckView.as_view(), name='api_health'),
    path('api/status/', HealthCheckView.as_view(), name='api_status'),
    path('api/config/networks/', SupportedNetworksView.as_view(), name='api_networks'),

    # Dashboard Statistics
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('api/dashboard/', DashboardStatsView.as_view(), name='dashboard_stats_alt'),

    # Authentication & User Management
    path('api/auth/', include('accounts.urls')),

    # Core Forensic Domains
    path('api/investigations/', include('investigations.urls')),
    path('api/investigations/<int:investigation_id>/graph/', GraphView.as_view(), name='investigation_graph'),
    path('api/wallets/', include('wallets.urls')),
    path('api/transactions/', include('transactions.urls')),
    path('api/vasps/', include('vasps.urls')),
    path('api/graph/', include('graph.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/blockchain/', include('blockchain.urls')),
]
