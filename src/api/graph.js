import apiClient from './client';

export const graphApi = {
  // Fetch blockchain node and edge relationship graph
  getGraphData: async (params = {}) => {
    const response = await apiClient.get('/graph/', { params });
    return response.data;
  },
};

export default graphApi;
