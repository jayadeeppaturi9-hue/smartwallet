import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { InvestigationProvider } from './context/InvestigationContext';
import AppLayout from './components/layout/AppLayout';

import DashboardPage from './pages/DashboardPage';
import NewInvestigationPage from './pages/NewInvestigationPage';
import WalletInvestigationPage from './pages/WalletInvestigationPage';
import InvestigationHistoryPage from './pages/InvestigationHistoryPage';
import TransactionsPage from './pages/TransactionsPage';
import VASPIntelligencePage from './pages/VASPIntelligencePage';
import BlockchainGraphPage from './pages/BlockchainGraphPage';
import InvestigationReportsPage from './pages/InvestigationReportsPage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigateTab={setActiveTab} />;
      case 'new-investigation':
        return <NewInvestigationPage onNavigateTab={setActiveTab} />;
      case 'wallet':
        return <WalletInvestigationPage onNavigateTab={setActiveTab} />;
      case 'history':
        return <InvestigationHistoryPage onNavigateTab={setActiveTab} />;
      case 'transactions':
        return <TransactionsPage onNavigateTab={setActiveTab} />;
      case 'vasps':
        return <VASPIntelligencePage onNavigateTab={setActiveTab} />;
      case 'graph':
        return <BlockchainGraphPage onNavigateTab={setActiveTab} />;
      case 'reports':
        return <InvestigationReportsPage onNavigateTab={setActiveTab} />;
      case 'settings':
        return <SettingsPage onNavigateTab={setActiveTab} />;
      default:
        return <DashboardPage onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onSelectTab={setActiveTab}>
      {renderActivePage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <InvestigationProvider>
          <AppContent />
        </InvestigationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
