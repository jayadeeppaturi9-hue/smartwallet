import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthToken, setAuthToken, formatApiError } from '../api/client';
import authApi from '../api/auth';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(getAuthToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { showToast } = useToast();

  const fetchProfile = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await authApi.getProfile();
      setUser(data);
    } catch {
      // If profile endpoint fails, keep token but clear user
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    // Listen for 401 unauthorized events from Axios interceptor
    const handleUnauthorized = () => {
      showToast({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Your backend session has expired or requires authorization credentials.',
      });
      setIsAuthModalOpen(true);
    };

    const handleAuthChanged = (e) => {
      setTokenState(e.detail);
      fetchProfile();
    };

    window.addEventListener('vasp_unauthorized', handleUnauthorized);
    window.addEventListener('vasp_auth_changed', handleAuthChanged);

    return () => {
      window.removeEventListener('vasp_unauthorized', handleUnauthorized);
      window.removeEventListener('vasp_auth_changed', handleAuthChanged);
    };
  }, [fetchProfile, showToast]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const res = await authApi.login(credentials);
      showToast({
        type: 'success',
        title: 'Authentication Successful',
        message: 'Connected to Django REST API session.',
      });
      setIsAuthModalOpen(false);
      return res;
    } catch (err) {
      const msg = formatApiError(err);
      showToast({
        type: 'error',
        title: 'Authentication Failed',
        message: msg,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      setAuthToken(null);
      setUser(null);
      setTokenState(null);
      showToast({
        type: 'info',
        title: 'Session Ended',
        message: 'Auth token removed.',
      });
    }
  };

  const setManualToken = (manualToken) => {
    setAuthToken(manualToken);
    setTokenState(manualToken);
    if (manualToken) {
      showToast({
        type: 'success',
        title: 'API Token Saved',
        message: 'API token configured for subsequent requests.',
      });
      fetchProfile();
    } else {
      setUser(null);
      showToast({
        type: 'info',
        title: 'API Token Cleared',
        message: 'Requests will now proceed unauthenticated (Guest mode).',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
        setManualToken,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
