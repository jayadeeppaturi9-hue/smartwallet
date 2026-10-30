import apiClient from './client';

export const vaspsApi = {
  // Query VASP intelligence registry
  listVasps: async (params = {}) => {
    const response = await apiClient.get('/vasps/', { params });
    return response.data;
  },

  // Query VASP attribution results for a given wallet or investigation
  getVaspAttributions: async (params = {}) => {
    const response = await apiClient.get('/vasps/attributions/', { params });
    return response.data;
  },

  // Retrieve intelligence profile for a specific VASP
  getVaspDetails: async (vaspId) => {
    const response = await apiClient.get(`/vasps/${encodeURIComponent(vaspId)}/`);
    return response.data;
  },
};

export default vaspsApi;
