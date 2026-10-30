import apiClient from './client';

export const investigationsApi = {
  // Fetch dashboard summary KPIs and dynamic analytics
  getDashboardStats: async () => {
    const response = await apiClient.get('/dashboard/stats/');
    return response.data;
  },

  // List investigations with optional filters, search, ordering
  listInvestigations: async (params = {}) => {
    const response = await apiClient.get('/investigations/', { params });
    return response.data;
  },

  // Retrieve single investigation details
  getInvestigation: async (id) => {
    const response = await apiClient.get(`/investigations/${id}/`);
    return response.data;
  },

  // Create and trigger a new blockchain wallet investigation
  createInvestigation: async (payload) => {
    const response = await apiClient.post('/investigations/', payload);
    return response.data;
  },

  // Generate or re-generate official forensic report for an investigation
  generateReport: async (id) => {
    const response = await apiClient.post(`/investigations/${id}/generate_report/`);
    return response.data;
  },

  // Retrieve existing or generated report for an investigation
  getReport: async (id) => {
    const response = await apiClient.get(`/investigations/${id}/report/`);
    return response.data;
  },

  // Delete an investigation
  deleteInvestigation: async (id) => {
    const response = await apiClient.delete(`/investigations/${id}/`);
    return response.data;
  },
};

export default investigationsApi;
