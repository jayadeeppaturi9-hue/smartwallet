import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShieldPlus,
  Wallet,
  ArrowLeftRight,
  Building2,
  GitFork,
  FileText,
  Settings,
  ShieldAlert,
  Server,
  Activity,
  X,
  History,
} from 'lucide-react';
import systemApi from '../../api/system';
import { getApiBaseUrl } from '../../api/client';
import { useInvestigation } from '../../context/InvestigationContext';
import { truncateAddress } from '../../utils/formatters';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-investigation', label: 'New Investigation', icon: ShieldPlus, highlight: true },
  { id: 'wallet', label: 'Wallet Investigation', icon: Wallet },
  { id: 'history', label: 'Investigation History', icon: History },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'vasps', label: 'VASP Intelligence', icon: Building2 },
  { id: 'graph', label: 'Blockchain Graph', icon: GitFork },
  { id: 'reports', label: 'Investigation Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar = ({ activeTab, onSelectTab, isOpen, onClose }) => {
  const [backendHealth, setBackendHealth] = useState({ online: false, checking: true, latency: null });
  const { activeWallet, activeInvestigationId } = useInvestigation();

  const checkConnection = async () => {
    setBackendHealth((prev) => ({ ...prev, checking: true }));
    const status = await systemApi.checkHealth();
    setBackendHealth({
      online: status.online,
      checking: false,
      latency: status.latencyMs,
    });
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Branding */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-md shadow-cyan-500/10">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">VASP</span>
                <span className="font-bold tracking-tight text-cyan-400 text-base">Map</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 font-mono">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                Forensic Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-200"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Investigation Context Tag */}
        {(activeWallet || activeInvestigationId) && (
          <div className="mx-3 mt-3 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50">
            <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono uppercase tracking-wider mb-1">
              <span>Active Target</span>
              {activeInvestigationId && <span>#{activeInvestigationId}</span>}
            </div>
            {activeWallet && (
              <div className="text-xs font-mono text-slate-200 truncate">
                {truncateAddress(activeWallet, 8, 6)}
              </div>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose?.();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Backend Connection Health Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Django REST API</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendHealth.checking
                      ? 'bg-amber-400 animate-ping'
                      : backendHealth.online
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-400">
                  {backendHealth.checking
                    ? 'Checking'
                    : backendHealth.online
                    ? `${backendHealth.latency ?? 0}ms`
                    : 'Offline'}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate" title={getApiBaseUrl()}>
              {getApiBaseUrl()}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
