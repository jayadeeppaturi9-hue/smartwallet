import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  KeyRound,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Globe,
  HelpCircle,
  Database,
} from 'lucide-react';
import { getApiBaseUrl, updateApiBaseUrl } from '../api/client';
import systemApi from '../api/system';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SettingsPage = () => {
  const { token, setManualToken, user, logout } = useAuth();
  const { showToast } = useToast();

  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [authTokenInput, setAuthTokenInput] = useState(token || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);

  useEffect(() => {
    const fetchNets = async () => {
      try {
        const res = await systemApi.getSupportedNetworks();
        setNetworks(res);
      } catch {
        // Fallback
      } finally {
        setLoadingNetworks(false);
      }
    };
    fetchNets();
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await systemApi.checkHealth();
      setConnectionResult(res);
      if (res.online) {
        showToast({
          type: 'success',
          title: 'Backend Online',
          message: `Connected to Django REST API (Latency: ${res.latencyMs}ms)`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Backend Unreachable',
          message: res.error || 'Connection failed.',
        });
      }
    } catch (err) {
      setConnectionResult({ online: false, error: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveApiUrl = (e) => {
    e.preventDefault();
    const updated = updateApiBaseUrl(apiUrl);
    setApiUrl(updated);
    showToast({
      type: 'success',
      title: 'API Endpoint Updated',
      message: `Active base URL set to: ${updated}`,
    });
    handleTestConnection();
  };

  const handleSaveToken = (e) => {
    e.preventDefault();
    setManualToken(authTokenInput.trim());
  };

  const handleResetToDefault = () => {
    const def = updateApiBaseUrl(null);
    setApiUrl(def);
    showToast({
      type: 'info',
      title: 'Endpoint Reset',
      message: `Reset to default: ${def}`,
    });
    handleTestConnection();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-800/60">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-cyan-400" />
          <span>Platform Settings & API Integration</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure Django REST API endpoints, token authentication, and blockchain node configurations.
        </p>
      </div>

      {/* API Endpoint Configuration */}
      <Card>
        <CardHeader>
          <CardTitle icon={Server}>Django REST API Endpoint</CardTitle>
          <p className="text-xs text-slate-400">
            Base URL where the Django REST Framework server is hosted (configured via VITE_API_BASE_URL)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSaveApiUrl} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                API Base URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000/api"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="text-xs text-slate-400"
              >
                Reset to Default (.env)
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Activity}
                  loading={testingConnection}
                  onClick={handleTestConnection}
                >
                  Test Connection
                </Button>
                <Button type="submit" variant="cyan" size="sm" icon={Save}>
                  Save Endpoint
                </Button>
              </div>
            </div>
          </form>

          {/* Test Result Feedback */}
          {connectionResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                connectionResult.online
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {connectionResult.online ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  {connectionResult.online
                    ? `Successfully connected to Django backend. Latency: ${connectionResult.latencyMs}ms.`
                    : `Unable to reach ${apiUrl}. Ensure your Django development server is running on this port.`}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authentication & DRF Tokens */}
      <Card>
        <CardHeader>
          <CardTitle icon={KeyRound}>Django Authentication Credentials</CardTitle>
          <p className="text-xs text-slate-400">
            DRF Token authorization header (Token &lt;key&gt; or Bearer &lt;jwt&gt;)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSaveToken} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                Active Authorization Token
              </label>
              <input
                type="text"
                value={authTokenInput}
                onChange={(e) => setAuthTokenInput(e.target.value)}
                placeholder="e.g. 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                Status:{' '}
                {token ? (
                  <span className="text-emerald-400 font-semibold font-mono">Configured</span>
                ) : (
                  <span className="text-amber-400 font-mono">Unauthenticated (Guest Mode)</span>
                )}
              </div>

              <div className="flex gap-2">
                {token && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuthTokenInput('');
                      logout();
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs"
                  >
                    Clear Token
                  </Button>
                )}
                <Button type="submit" variant="primary" size="sm" icon={Save}>
                  Update Token
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Configured Blockchain Networks */}
      <Card>
        <CardHeader>
          <CardTitle icon={Globe}>Supported Blockchain Networks</CardTitle>
          <p className="text-xs text-slate-400">
            Chains registered in backend RPC connectors and supported by VASP heuristic analyzers
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {networks.map((net) => (
              <div
                key={net.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-200">{net.name}</div>
                  <div className="text-[11px] font-mono text-slate-500 uppercase">{net.id}</div>
                </div>
                <Badge variant="mono">{net.symbol}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
