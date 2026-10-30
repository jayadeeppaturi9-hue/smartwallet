from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WalletViewSet,
    WalletCounterpartiesView,
    WalletInflowOutflowView,
    WalletVaspInteractionsView,
    WalletTransactionsView,
)

router = DefaultRouter()
router.register(r'', WalletViewSet, basename='wallet')

urlpatterns = [
    path('<str:address>/counterparties/', WalletCounterpartiesView.as_view(), name='wallet_counterparties'),
    path('<str:address>/inflow-outflow/', WalletInflowOutflowView.as_view(), name='wallet_inflow_outflow'),
    path('<str:address>/vasp-interactions/', WalletVaspInteractionsView.as_view(), name='wallet_vasp_interactions'),
    path('<str:address>/transactions/', WalletTransactionsView.as_view(), name='wallet_transactions'),
    path('', include(router.urls)),
]
