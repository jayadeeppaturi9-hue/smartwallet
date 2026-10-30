import apiClient from './client';

export const walletsApi = {
  // Fetch detailed forensic information for a wallet address
  getWalletDetails: async (address, params = {}) => {
    const response = await apiClient.get(`/wallets/${encodeURIComponent(address)}/`, { params });
    return response.data;
  },

  // Fetch direct counterparties for this wallet
  getWalletCounterparties: async (address, params = {}) => {
    const response = await apiClient.get(`/wallets/${encodeURIComponent(address)}/counterparties/`, { params });
    return response.data;
  },

  // Fetch inflow vs outflow breakdown & timeline
  getWalletInflowOutflow: async (address, params = {}) => {
    const response = await apiClient.get(`/wallets/${encodeURIComponent(address)}/inflow-outflow/`, { params });
    return response.data;
  },

  // Fetch known VASP interactions for this wallet
  getWalletVaspInteractions: async (address, params = {}) => {
    const response = await apiClient.get(`/wallets/${encodeURIComponent(address)}/vasp-interactions/`, { params });
    return response.data;
  },
};

export default walletsApi;
