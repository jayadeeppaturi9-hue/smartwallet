import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Filter,
  FolderOpen,
  GitFork,
  Building2,
  FileText,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ExternalLink,
  Wallet,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import investigationsApi from '../api/investigations';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import AddressBadge from '../components/common/AddressBadge';
import CopyButton from '../components/common/CopyButton';
import { formatDateTime, getRiskBadge, truncateAddress } from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';

export const InvestigationHistoryPage = ({ onNavigateTab }) => {
  const { selectInvestigation, selectWallet } = useInvestigation();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vaspStateFilter, setVaspStateFilter] = useState('all');

  const fetchInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await investigationsApi.listInvestigations();
      const list = Array.isArray(data) ? data : data?.results || [];
      setInvestigations(list);
    } catch (err) {
      const formatted = formatApiError(err);
      setError({
        message: formatted,
        response: err.response,
        status: err.response?.status,
      });
      setInvestigations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestigations();
  }, [fetchInvestigations]);

  // Action Dispatchers: sets active context and navigates
  const handleAction = (inv, targetTab) => {
    if (inv?.id) {
      selectInvestigation(inv.id);
    } else if (inv?.wallet_address) {
      selectWallet(inv.wallet_address);
    }
    if (onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  // Helper to render VASP status badge with precise colors for 7 forensic states
  const renderVaspStatusBadge = (vaspState) => {
    switch (vaspState) {
      case 'KNOWN VASP ADDRESS MATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Known VASP Match
          </span>
        );
      case 'DIRECT VASP INTERACTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/80">
            <Building2 className="w-3 h-3 text-cyan-400" />
            Direct Interaction
          </span>
        );
      case 'INDIRECT VASP RELATIONSHIP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/80">
            <Layers className="w-3 h-3 text-purple-400" />
            Indirect Hop Path
          </span>
        );
      case 'NO VASP ASSOCIATION IDENTIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
            No VASP Identified
          </span>
        );
      case 'VASP INTELLIGENCE NOT CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Not Configured
          </span>
        );
      case 'VASP ANALYSIS IN PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800 animate-pulse">
            <Clock className="w-3 h-3 text-cyan-400 animate-spin" />
            In Progress
          </span>
        );
      case 'ANALYSIS FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Analysis Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800">
            {vaspState || 'Pending'}
          </span>
        );
    }
  };

  // Filter investigations
  const filteredInvestigations = investigations.filter((inv) => {
    const matchSearch =
      searchTerm === '' ||
      (inv.name && inv.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.reference_id && inv.reference_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.wallet_address && inv.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus =
      statusFilter === 'all' ||
      inv.status?.toUpperCase() === statusFilter.toUpperCase();

    const matchVaspState =
      vaspStateFilter === 'all' ||
      inv.vasp_state === vaspStateFilter;

    return matchSearch && matchStatus && matchVaspState;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-cyan-400" />
            <span>Investigation History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete persistent case register of every wallet forensic investigation in SQLite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchInvestigations}
            loading={loading}
          >
            Refresh Register
          </Button>
          <Button
            variant="cyan"
            size="sm"
            onClick={() => onNavigateTab && onNavigateTab('new-investigation')}
          >
            New Investigation
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorAlert
          title="Failed to Load Investigation Register"
          error={error}
          onRetry={fetchInvestigations}
        />
      ) : (
        <>
          {/* Search & Filter Bar */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by case name, reference ID, or wallet address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
              <span className="text-[10px] text-slate-500 font-mono">STATUS:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono"
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="RUNNING">Running</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
              <span className="text-[10px] text-slate-500 font-mono">VASP STATE:</span>
              <select
                value={vaspStateFilter}
                onChange={(e) => setVaspStateFilter(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono"
              >
                <option value="all">All VASP States</option>
                <option value="KNOWN VASP ADDRESS MATCH">Known Match</option>
                <option value="DIRECT VASP INTERACTION">Direct Interaction</option>
                <option value="INDIRECT VASP RELATIONSHIP">Indirect Hop</option>
                <option value="NO VASP ASSOCIATION IDENTIFIED">No Association</option>
                <option value="VASP INTELLIGENCE NOT CONFIGURED">Not Configured</option>
                <option value="ANALYSIS FAILED">Failed</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Register Table */}
      <Card>
        <CardHeader>
          <CardTitle icon={FolderOpen}>
            Investigated Cases ({filteredInvestigations.length})
          </CardTitle>
          <p className="text-xs text-slate-400">
            Every case record provides direct access to dossier results, graph visualization, VASP intelligence, and official reports.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Case / Name</th>
                  <th className="py-3 px-4">Investigated Wallet</th>
                  <th className="py-3 px-4">Network</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Updated Date</th>
                  <th className="py-3 px-4">VASP Status</th>
                  <th className="py-3 px-4">Report Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-4 px-4">
                        <div className="h-4 bg-slate-800/50 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredInvestigations.length > 0 ? (
                  filteredInvestigations.map((inv) => {
                    const statusBadge =
                      inv.status === 'COMPLETED'
                        ? 'emerald'
                        : inv.status === 'RUNNING'
                        ? 'cyan'
                        : inv.status === 'FAILED'
                        ? 'rose'
                        : 'default';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Case Name & Ref */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200 font-sans group-hover:text-cyan-300 transition-colors">
                            {inv.name || `Investigation #${inv.id}`}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{inv.reference_id || `INV-${inv.id}`}</span>
                            <span>•</span>
                            <span className="text-slate-400">ID #{inv.id}</span>
                          </div>
                        </td>

                        {/* Wallet Address */}
                        <td className="py-3 px-4">
                          <AddressBadge address={inv.wallet_address} />
                        </td>

                        {/* Blockchain Network */}
                        <td className="py-3 px-4 uppercase text-slate-300 text-[11px]">
                          {inv.blockchain_network || 'Ethereum'}
                        </td>

                        {/* Pipeline Status */}
                        <td className="py-3 px-4">
                          <Badge variant={statusBadge}>
                            {inv.status || 'PENDING'}
                          </Badge>
                        </td>

                        {/* Created Date */}
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {formatDateTime(inv.created_at)}
                        </td>

                        {/* Updated Date */}
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {formatDateTime(inv.updated_at || inv.completed_at || inv.created_at)}
                        </td>

                        {/* VASP Status */}
                        <td className="py-3 px-4">
                          {renderVaspStatusBadge(inv.vasp_state)}
                        </td>

                        {/* Report Status */}
                        <td className="py-3 px-4">
                          {inv.has_report ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                              <CheckCircle2 className="w-3 h-3" />
                              Generated
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-500 border border-slate-800">
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Actions: open, results, graph, VASP intelligence, report */}
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="secondary"
                              size="xs"
                              icon={FolderOpen}
                              onClick={() => handleAction(inv, 'wallet')}
                              title="Open Case Dossier & Results"
                            >
                              Results
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={GitFork}
                              onClick={() => handleAction(inv, 'graph')}
                              title="Visualize Relationship Graph"
                            >
                              Graph
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Building2}
                              onClick={() => handleAction(inv, 'vasps')}
                              title="Open VASP Intelligence"
                            >
                              VASP
                            </Button>
                            <Button
                              variant={inv.has_report ? 'cyan' : 'outline'}
                              size="xs"
                              icon={FileText}
                              onClick={() => handleAction(inv, 'reports')}
                              title="View / Generate Official Report"
                            >
                              Report
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12">
                      <EmptyState
                        icon={History}
                        title={
                          investigations.length === 0
                            ? 'No investigations found'
                            : 'No matching investigations found'
                        }
                        description={
                          investigations.length === 0
                            ? 'No investigations have been started yet. Create your first investigation.'
                            : 'Adjust search keywords or filters to display archived investigations.'
                        }
                        actionLabel={
                          investigations.length === 0
                            ? 'Create Investigation'
                            : 'Clear Filters'
                        }
                        onAction={() => {
                          if (investigations.length === 0) {
                            if (onNavigateTab) onNavigateTab('new-investigation');
                          } else {
                            setSearchTerm('');
                            setStatusFilter('all');
                            setVaspStateFilter('all');
                          }
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )}
    </div>
  );
};

export default InvestigationHistoryPage;
