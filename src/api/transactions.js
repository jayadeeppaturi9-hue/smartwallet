import apiClient from './client';

export const transactionsApi = {
  // Query transactions with filtering, search, sorting, and pagination
  listTransactions: async (params = {}) => {
    const response = await apiClient.get('/transactions/', { params });
    return response.data;
  },

  // Retrieve full details of a specific transaction hash
  getTransaction: async (txHash) => {
    const response = await apiClient.get(`/transactions/${encodeURIComponent(txHash)}/`);
    return response.data;
  },
};

export default transactionsApi;
