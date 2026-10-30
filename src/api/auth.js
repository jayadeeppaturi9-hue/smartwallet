import apiClient, { setAuthToken } from './client';

export const authApi = {
  // Django DRF login (standard token or session)
  login: async (credentials) => {
    // Standard DRF endpoint: /api/auth/token/ or /api/auth/login/
    const response = await apiClient.post('/auth/login/', credentials);
    const token = response.data?.token || response.data?.access || response.data?.key;
    if (token) {
      setAuthToken(token);
    }
    return response.data;
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout/');
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
    }
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/user/');
    return response.data;
  },

  verifyToken: async () => {
    const response = await apiClient.get('/auth/verify/');
    return response.data;
  },
};

export default authApi;
