import apiClient from './client';

export const systemApi = {
  // Test connection to Django backend and measure latency
  checkHealth: async () => {
    const startTime = performance.now();
    try {
      const response = await apiClient.get('/health/');
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        online: true,
        latencyMs,
        data: response.data,
      };
    } catch {
      // Fallback try root or status
      try {
        const fallback = await apiClient.get('/status/');
        const latencyMs = Math.round(performance.now() - startTime);
        return {
          online: true,
          latencyMs,
          data: fallback.data,
        };
      } catch (err) {
        return {
          online: false,
          latencyMs: null,
          error: err.message || 'Connection refused',
        };
      }
    }
  },

  // Retrieve supported blockchain networks configured in the backend
  getSupportedNetworks: async () => {
    try {
      const response = await apiClient.get('/config/networks/');
      return response.data;
    } catch {
      // Default standard networks if backend config endpoint is not yet mounted
      return [
        { id: 'ethereum', name: 'Ethereum Mainnet', symbol: 'ETH', chainId: 1 },
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
        { id: 'polygon', name: 'Polygon PoS', symbol: 'MATIC', chainId: 137 },
        { id: 'arbitrum', name: 'Arbitrum One', symbol: 'ARB', chainId: 42161 },
        { id: 'optimism', name: 'OP Mainnet', symbol: 'OP', chainId: 10 },
        { id: 'binance-smart-chain', name: 'BNB Smart Chain', symbol: 'BNB', chainId: 56 },
        { id: 'avalanche', name: 'Avalanche C-Chain', symbol: 'AVAX', chainId: 43114 },
        { id: 'base', name: 'Base', symbol: 'ETH', chainId: 8453 },
        { id: 'solana', name: 'Solana', symbol: 'SOL' },
        { id: 'tron', name: 'Tron', symbol: 'TRX' },
      ];
    }
  },

  // Retrieve general system configuration
  getConfig: async () => {
    try {
      const response = await apiClient.get('/config/');
      return response.data;
    } catch {
      return null;
    }
  },
};

export default systemApi;
