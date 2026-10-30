from django.urls import path
from .views import WalletTransactionsView, BlockchainStatusView

urlpatterns = [
    path('wallet-transactions/', WalletTransactionsView.as_view(), name='blockchain_wallet_transactions'),
    path('status/', BlockchainStatusView.as_view(), name='blockchain_status'),
]
