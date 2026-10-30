import React, { useState } from 'react';
import { Menu, Search, Key, ShieldCheck, X, ArrowRight } from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useInvestigation } from '../../context/InvestigationContext';
import { truncateAddress } from '../../utils/formatters';

export const Header = ({ onOpenMobileSidebar, onNavigateTab }) => {
  const { isAuthenticated, user, setIsAuthModalOpen } = useAuth();
  const { activeWallet, activeInvestigationId, selectWallet, clearActive } = useInvestigation();
  const [quickSearch, setQuickSearch] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    selectWallet(quickSearch.trim());
    onNavigateTab('wallet');
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-surface/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Wallet Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-72 lg:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Search wallet (0x..., bc1..., etc.)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
          {quickSearch && (
            <button
              type="submit"
              className="absolute right-2 top-2 p-1 text-slate-400 hover:text-cyan-400"
              title="Search Wallet"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      <div className="flex items-center gap-3">
        {/* Active Investigation Context Tag in Header */}
        {activeWallet && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs">
            <span className="text-[10px] uppercase font-mono text-slate-500">Active:</span>
            <span className="font-mono text-cyan-300 font-medium">
              {truncateAddress(activeWallet, 6, 4)}
            </span>
            <button
              onClick={clearActive}
              className="text-slate-500 hover:text-slate-300 ml-1"
              title="Clear Active Context"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Auth / DRF Status Button */}
        <Button
          variant={isAuthenticated ? 'outline' : 'secondary'}
          size="sm"
          onClick={() => setIsAuthModalOpen(true)}
          icon={isAuthenticated ? ShieldCheck : Key}
          className="text-xs"
        >
          {isAuthenticated ? (user?.username ? `@${user.username}` : 'Authenticated') : 'Connect Auth'}
        </Button>
      </div>
    </header>
  );
};

export default Header;
