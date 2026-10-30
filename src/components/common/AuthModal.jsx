import React, { useState } from 'react';
import { KeyRound, Shield, User, Lock, ArrowRight } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';

export const AuthModal = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, login, setManualToken, token, logout } = useAuth();
  const [tab, setTab] = useState('token'); // 'token' | 'credentials'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [directToken, setDirectToken] = useState(token || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    setError('');
    setManualToken(directToken.trim());
    setIsAuthModalOpen(false);
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      title="Django REST Authentication"
      description="Connect to your Django REST Framework backend with API tokens or credentials."
      maxWidth="max-w-md"
    >
      <div className="flex border-b border-slate-800 mb-5">
        <button
          type="button"
          onClick={() => { setTab('token'); setError(''); }}
          className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'token'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>DRF Token / Bearer</span>
        </button>
        <button
          type="button"
          onClick={() => { setTab('credentials'); setError(''); }}
          className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'credentials'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Username & Password</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300">
          {error}
        </div>
      )}

      {tab === 'token' ? (
        <form onSubmit={handleTokenSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              API Token / Bearer Key
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={directToken}
                onChange={(e) => setDirectToken(e.target.value)}
                placeholder="e.g. 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Leave blank to operate in unauthenticated/public mode, or paste your Django Token.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {token ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDirectToken('');
                  logout();
                  setIsAuthModalOpen(false);
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 text-xs"
              >
                Clear Token
              </Button>
            ) : <div />}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAuthModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="cyan" size="sm">
                Apply Token
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Django admin/analyst username"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAuthModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loading}
              icon={ArrowRight}
            >
              Log In
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AuthModal;
