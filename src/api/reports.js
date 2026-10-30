import apiClient, { getApiBaseUrl } from './client';

export const reportsApi = {
  // List generated forensic reports
  listReports: async (params = {}) => {
    const response = await apiClient.get('/reports/', { params });
    return response.data;
  },

  // Retrieve single report details
  getReport: async (id) => {
    const response = await apiClient.get(`/reports/${id}/`);
    return response.data;
  },

  // Trigger backend report generation for an investigation or wallet
  generateReport: async (payload) => {
    const response = await apiClient.post('/reports/', payload);
    return response.data;
  },

  // Export report in specified format (json, pdf, html)
  exportReport: async (id, format = 'json') => {
    const response = await apiClient.get(`/reports/${id}/export/`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Get direct browser URL for printable HTML/PDF download
  getDownloadUrl: (id, format = 'html') => {
    const base = getApiBaseUrl();
    return `${base}/reports/${id}/download/?format=${format}`;
  },
};

export default reportsApi;
