import axios from 'axios';

// Get base URL from localStorage override or Vite env variable
export const getApiBaseUrl = () => {
  const customUrl = localStorage.getItem('vasp_api_base_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
};

// Create Axios client instance
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Update client base URL dynamically
export const updateApiBaseUrl = (newUrl) => {
  if (newUrl) {
    const formatted = newUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('vasp_api_base_url', formatted);
    apiClient.defaults.baseURL = formatted;
    window.dispatchEvent(new CustomEvent('vasp_api_url_changed', { detail: formatted }));
    return formatted;
  } else {
    localStorage.removeItem('vasp_api_base_url');
    const defaultUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
    apiClient.defaults.baseURL = defaultUrl;
    window.dispatchEvent(new CustomEvent('vasp_api_url_changed', { detail: defaultUrl }));
    return defaultUrl;
  }
};

// Auth token helper functions
export const getAuthToken = () => localStorage.getItem('vasp_auth_token');
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('vasp_auth_token', token);
  } else {
    localStorage.removeItem('vasp_auth_token');
  }
  window.dispatchEvent(new CustomEvent('vasp_auth_changed', { detail: token }));
};

// Request Interceptor: Attach DRF token or JWT
apiClient.interceptors.request.use(
  (config) => {
    // Keep baseURL synchronized with current preference
    config.baseURL = getApiBaseUrl();

    const token = getAuthToken();
    if (token) {
      // Support standard DRF 'Token <key>' or JWT 'Bearer <key>'
      const authHeader = token.startsWith('Bearer ') || token.startsWith('Token ')
        ? token
        : `Token ${token}`;
      config.headers.Authorization = authHeader;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Format Django REST Framework error responses into user-readable strings
export const formatApiError = (error) => {
  if (!error) return 'An unknown error occurred.';

  // If error has a response from Django
  if (error.response) {
    const { status, data } = error.response;

    if (status === 401) {
      return data?.detail || 'Authentication required or session expired. Please log in.';
    }

    if (status === 403) {
      return data?.detail || 'Permission denied. You do not have authorization for this resource.';
    }

    if (status === 404) {
      return data?.detail || 'The requested resource or endpoint was not found on the backend (404).';
    }

    if (status >= 500) {
      return data?.detail || `Internal server error (${status}) in Django backend. Check Django logs.`;
    }

    // Handle DRF validation errors dictionary
    if (typeof data === 'object' && data !== null) {
      if (data.detail) return data.detail;
      if (data.message) return data.message;
      if (data.error) return data.error;
      if (data.non_field_errors) {
        return Array.isArray(data.non_field_errors)
          ? data.non_field_errors.join(' ')
          : String(data.non_field_errors);
      }

      // Concatenate field-level errors (e.g., { "address": ["Invalid wallet address format."] })
      const fieldErrors = Object.entries(data)
        .map(([field, errs]) => {
          const errText = Array.isArray(errs) ? errs.join(', ') : String(errs);
          return `${field}: ${errText}`;
        })
        .join(' | ');

      if (fieldErrors) return fieldErrors;
    }

    return `API Request Failed with status ${status}.`;
  }

  // Handle Network / Connection refused
  if (error.code === 'ECONNABORTED') {
    return 'Analysis request timed out. The blockchain node may be responding slowly.';
  }

  if (error.request) {
    const currentBase = getApiBaseUrl();
    return `Unable to connect to Django API at ${currentBase}. Ensure your backend server is running and CORS is configured.`;
  }

  return error.message || 'An unexpected client error occurred.';
};

// Response Interceptor: Handle 401 session expiration & format errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('vasp_unauthorized', { detail: error.response }));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
