import React, { createContext, useContext, useState } from 'react';

const InvestigationContext = createContext(null);

export const InvestigationProvider = ({ children }) => {
  const [activeInvestigationId, setActiveInvestigationId] = useState(null);
  const [activeInvestigation, setActiveInvestigation] = useState(null);
  const [activeWallet, setActiveWallet] = useState('');
  const [activeNetwork, setActiveNetwork] = useState('ethereum');

  const selectInvestigation = (investigation) => {
    if (!investigation) {
      setActiveInvestigationId(null);
      setActiveInvestigation(null);
      return;
    }
    const id = typeof investigation === 'object' ? (investigation.id || investigation.investigation_id) : investigation;
    setActiveInvestigationId(id);
    if (typeof investigation === 'object') {
      setActiveInvestigation(investigation);
      if (investigation.wallet_address) {
        setActiveWallet(investigation.wallet_address);
      }
      if (investigation.blockchain_network || investigation.network) {
        setActiveNetwork(investigation.blockchain_network || investigation.network);
      }
    }
  };

  const selectWallet = (walletAddress, network = 'ethereum') => {
    setActiveWallet(walletAddress || '');
    if (network) setActiveNetwork(network);
  };

  const clearActive = () => {
    setActiveInvestigationId(null);
    setActiveInvestigation(null);
    setActiveWallet('');
  };

  return (
    <InvestigationContext.Provider
      value={{
        activeInvestigationId,
        activeInvestigation,
        activeWallet,
        activeNetwork,
        setActiveNetwork,
        selectInvestigation,
        selectWallet,
        clearActive,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
};

export const useInvestigation = () => {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within an InvestigationProvider');
  }
  return context;
};
