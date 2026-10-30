import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  GitBranch,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Wallet,
  Clock,
  ArrowLeftRight,
  FileText,
  Activity,
  Check,
} from 'lucide-react';
import vaspsApi from '../api/vasps';
import investigationsApi from '../api/investigations';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import AddressBadge from '../components/common/AddressBadge';
import CopyButton from '../components/common/CopyButton';
import { formatPercent, getConfidenceBadge, formatCryptoAmount, truncateAddress, formatDateTime } from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';

export const VASPIntelligencePage = ({ onNavigateTab }) => {
  const { activeWallet, activeInvestigationId, selectInvestigation } = useInvestigation();
  const [investigationsList, setInvestigationsList] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Load all historical investigations for the case switcher
  const fetchInvestigations = useCallback(async () => {
    try {
      const data = await investigationsApi.listInvestigations();
      const list = Array.isArray(data) ? data : data?.results || [];
      setInvestigationsList(list);
      return list;
    } catch (err) {
      console.error('Failed to load investigations list:', err);
      return [];
    }
  }, []);

  // Fetch VASP intelligence and investigation dossier for active case
  const fetchVaspIntelligence = useCallback(async (targetInvId, targetWalletAddr) => {
    setLoading(true);
    setError(null);
    try {
      let caseData = null;
      const invId = targetInvId || activeInvestigationId;
      const walletAddr = targetWalletAddr || activeWallet;

      if (invId) {
        caseData = await investigationsApi.getInvestigation(invId);
      } else if (walletAddr) {
        const list = await investigationsApi.listInvestigations({ wallet_address: walletAddr });
        const results = Array.isArray(list) ? list : list?.results || [];
        if (results.length > 0) {
          caseData = await investigationsApi.getInvestigation(results[0].id);
        }
      }

      setSelectedCase(caseData);

      // Query candidate attributions
      const params = {};
      if (caseData?.id) {
        params.investigation_id = caseData.id;
      } else if (invId) {
        params.investigation_id = invId;
      }
      if (caseData?.wallet_address) {
        params.wallet_address = caseData.wallet_address;
      } else if (walletAddr) {
        params.wallet_address = walletAddr;
      }

      const data = await vaspsApi.getVaspAttributions(params);
      const results = Array.isArray(data) ? data : data?.results || [];

      // If backend investigation has attributions embedded, merge them
      const embeddedAttributions = caseData?.attributions || [];
      const finalCandidates = results.length > 0 ? results : embeddedAttributions;
      setCandidates(finalCandidates);
    } catch (err) {
      setError(formatApiError(err));
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [activeInvestigationId, activeWallet]);

  useEffect(() => {
    const init = async () => {
      const list = await fetchInvestigations();
      if (!activeInvestigationId && !activeWallet && list.length > 0) {
        // Default to most recent investigation if none active
        selectInvestigation(list[0]);
        fetchVaspIntelligence(list[0].id, list[0].wallet_address);
      } else {
        fetchVaspIntelligence(activeInvestigationId, activeWallet);
      }
    };
    init();
  }, [fetchInvestigations, fetchVaspIntelligence, activeInvestigationId, activeWallet, selectInvestigation]);

  const handleCaseChange = async (e) => {
    const invId = e.target.value;
    if (!invId) return;
    const found = investigationsList.find((i) => String(i.id) === String(invId));
    if (found) {
      selectInvestigation(found);
      fetchVaspIntelligence(found.id, found.wallet_address);
    }
  };

  // Determine active VASP forensic state from backend
  const vaspState = selectedCase?.vasp_state || (
    candidates.some((c) => c.match_type === 'KNOWN_VASP_MATCH')
      ? 'KNOWN VASP ADDRESS MATCH'
      : candidates.some((c) => c.match_type === 'DIRECT_INTERACTION' || c.distance_hops === 1)
      ? 'DIRECT VASP INTERACTION'
      : candidates.length > 0
      ? 'INDIRECT VASP RELATIONSHIP'
      : selectedCase?.status === 'FAILED'
      ? 'ANALYSIS FAILED'
      : selectedCase?.status === 'RUNNING'
      ? 'VASP ANALYSIS IN PROGRESS'
      : 'NO VASP ASSOCIATION IDENTIFIED'
  );

  const exactMatchCandidate = candidates.find(
    (c) => c.match_type === 'KNOWN_VASP_MATCH' || String(c.relationship_type).toLowerCase().includes('known vasp')
  );

  const filteredCandidates = candidates.filter((item) => {
    const vaspName = (item.vasp_name || item.name || '').toLowerCase();
    const matchesSearch = !searchFilter.trim() || vaspName.includes(searchFilter.toLowerCase().trim());
    const matchesConfidence =
      confidenceFilter === 'all' ||
      String(item.confidence || '').toLowerCase() === confidenceFilter.toLowerCase();
    const matchesType =
      typeFilter === 'all' ||
      String(item.match_type || item.relationship_type || '').toLowerCase().includes(typeFilter.toLowerCase());
    return matchesSearch && matchesConfidence && matchesType;
  });

  const summary = selectedCase?.investigation_summary || {};

  return (
    <div className="space-y-6">
      {/* Top Header & Investigation Case Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-cyan-400" />
            <span>VASP Attribution Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Automated Virtual Asset Service Provider mapping derived from on-chain transaction evidence and graph topology.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Case Switcher */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <Wallet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 font-medium">Case:</span>
            <select
              value={selectedCase?.id || activeInvestigationId || ''}
              onChange={handleCaseChange}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-mono"
            >
              {investigationsList.length === 0 && <option value="">No investigations available</option>}
              {investigationsList.map((inv) => (
                <option key={inv.id} value={inv.id} className="bg-slate-900 text-slate-200">
                  #{inv.id} - {truncateAddress(inv.wallet_address)} ({inv.name || 'Case'})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchVaspIntelligence(selectedCase?.id, selectedCase?.wallet_address)}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          title="Attribution Intelligence Notice"
          error={error}
          onRetry={() => fetchVaspIntelligence(selectedCase?.id, selectedCase?.wallet_address)}
        />
      )}

      {/* Case Overview & Dynamic Summary */}
      {selectedCase && (
        <Card className="p-4 border-slate-800/80 bg-slate-900/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Investigation ID</span>
              <span className="text-sm font-bold font-mono text-cyan-400">#{selectedCase.id}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Target Wallet</span>
              <span className="text-xs font-bold font-mono text-slate-200 truncate block">
                {truncateAddress(selectedCase.wallet_address, 6, 4)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Transactions</span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {summary.transactions_analyzed ?? selectedCase.options?.transactions_count ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Counterparties</span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {summary.unique_counterparties ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Graph Nodes</span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {summary.graph_nodes ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">VASP Candidates</span>
              <span className="text-sm font-bold font-mono text-purple-400">
                {candidates.length}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Prominent VASP Forensic State Banner */}
      <div
        className={`p-4 rounded-xl border backdrop-blur-sm flex items-start sm:items-center justify-between gap-4 ${
          vaspState === 'KNOWN VASP ADDRESS MATCH'
            ? 'border-purple-500/40 bg-purple-950/30'
            : vaspState === 'DIRECT VASP INTERACTION'
            ? 'border-cyan-500/40 bg-cyan-950/30'
            : vaspState === 'INDIRECT VASP RELATIONSHIP'
            ? 'border-blue-500/40 bg-blue-950/30'
            : vaspState === 'NO VASP ASSOCIATION IDENTIFIED'
            ? 'border-slate-700/60 bg-slate-900/60'
            : vaspState === 'VASP ANALYSIS IN PROGRESS'
            ? 'border-amber-500/40 bg-amber-950/30'
            : vaspState === 'VASP INTELLIGENCE NOT CONFIGURED'
            ? 'border-orange-500/40 bg-orange-950/30'
            : 'border-rose-500/40 bg-rose-950/30'
        }`}
      >
        <div className="flex items-start gap-3.5">
          {vaspState === 'KNOWN VASP ADDRESS MATCH' ? (
            <ShieldCheck className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
          ) : vaspState === 'DIRECT VASP INTERACTION' ? (
            <ArrowLeftRight className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          ) : vaspState === 'INDIRECT VASP RELATIONSHIP' ? (
            <GitBranch className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          ) : vaspState === 'NO VASP ASSOCIATION IDENTIFIED' ? (
            <ShieldAlert className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
          ) : vaspState === 'VASP ANALYSIS IN PROGRESS' ? (
            <Activity className="w-6 h-6 text-amber-400 animate-spin shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Forensic VASP State:</span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                  vaspState === 'KNOWN VASP ADDRESS MATCH'
                    ? 'bg-purple-900/60 text-purple-300 border border-purple-500/50'
                    : vaspState === 'DIRECT VASP INTERACTION'
                    ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/50'
                    : vaspState === 'INDIRECT VASP RELATIONSHIP'
                    ? 'bg-blue-900/60 text-blue-300 border border-blue-500/50'
                    : vaspState === 'NO VASP ASSOCIATION IDENTIFIED'
                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                    : vaspState === 'VASP ANALYSIS IN PROGRESS'
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-500/50'
                    : 'bg-rose-900/60 text-rose-300 border border-rose-500/50'
                }`}
              >
                {vaspState}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {selectedCase?.vasp_state_message ||
                (vaspState === 'KNOWN VASP ADDRESS MATCH'
                  ? 'Subject wallet corresponds directly to a registered VASP entity address.'
                  : vaspState === 'DIRECT VASP INTERACTION'
                  ? 'Observed verified on-chain transfers directly with registered VASP cluster addresses.'
                  : vaspState === 'INDIRECT VASP RELATIONSHIP'
                  ? 'Multi-hop graph analysis traced fund-flow paths connecting to known VASP addresses.'
                  : vaspState === 'NO VASP ASSOCIATION IDENTIFIED'
                  ? 'The current investigation did not produce sufficient evidence linking the analyzed wallet to a known VASP address.'
                  : vaspState === 'VASP ANALYSIS IN PROGRESS'
                  ? 'Analysis is currently processing on-chain transactions.'
                  : 'VASP intelligence is currently unavailable or unconfigured.')}
            </p>
          </div>
        </div>

        {selectedCase && (
          <Button
            variant="outline"
            size="xs"
            icon={FileText}
            onClick={() => onNavigateTab('reports')}
            className="shrink-0 hidden sm:flex"
          >
            View Dossier
          </Button>
        )}
      </div>

      {/* Forensic Disclaimer Notice */}
      <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-200">Strict Forensic Differentiation:</span> Observed Evidence reflects verified, immutable on-chain transactions with known clusters. System Attribution represents algorithmic heuristic probability based on graph proximity and volume. Heuristic attribution does not constitute legal proof.
        </p>
      </div>

      {/* Dedicated Section: Known VASP Address Match (If exact match exists) */}
      {exactMatchCandidate && (
        <Card className="border-purple-500/40 bg-gradient-to-br from-purple-950/20 via-slate-900/40 to-slate-950 p-5 shadow-lg shadow-purple-950/20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-purple-900/40">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="purple" size="xs">
                  Known VASP Address Match
                </Badge>
                {exactMatchCandidate.jurisdiction && (
                  <Badge variant="outline" size="xs">
                    {exactMatchCandidate.jurisdiction}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2">
                <span>{exactMatchCandidate.vasp_name}</span>
                <span className="text-xs text-purple-300 font-mono font-normal">
                  (Entity ID #{exactMatchCandidate.vasp_id})
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-2 font-mono text-xs text-slate-300">
                <span className="text-slate-500">Address:</span>
                <span className="text-purple-300 font-semibold break-all">
                  {exactMatchCandidate.address_matched || selectedCase?.wallet_address}
                </span>
                <CopyButton text={exactMatchCandidate.address_matched || selectedCase?.wallet_address || ''} />
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-end gap-2 text-right">
              <span className="px-3 py-1 rounded text-xs font-bold border bg-emerald-950/80 text-emerald-300 border-emerald-500/50">
                High Confidence Match
              </span>
              <span className="text-[11px] text-slate-400">
                Source: <span className="text-slate-200">{exactMatchCandidate.source || 'Intelligence Registry'}</span>
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Supporting Evidence (Observed On-Chain)</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {(exactMatchCandidate.observed_evidence || []).map((ev, i) => (
                  <li key={i} className="leading-relaxed">{ev}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>System Attribution Assessment</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {(exactMatchCandidate.system_attribution || []).map((sa, i) => (
                  <li key={i} className="leading-relaxed">{sa}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Filter Toolbar */}
      {candidates.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by VASP entity name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Relationship Types</option>
                <option value="known">Known VASP Matches</option>
                <option value="direct">Direct Interactions</option>
                <option value="indirect">Indirect Relationships</option>
              </select>

              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Confidence Levels</option>
                <option value="high">High Confidence</option>
                <option value="medium">Medium Confidence</option>
                <option value="low">Low Confidence</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Candidate Mappings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse" />
          <div className="h-64 bg-slate-900/60 rounded-xl border border-slate-800 animate-pulse" />
        </div>
      ) : filteredCandidates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCandidates.map((candidate, idx) => {
            const conf = getConfidenceBadge(candidate.confidence);
            const rawScore = candidate.score ?? candidate.attribution_score ?? 0;
            const scoreFormatted = formatPercent(rawScore, true);
            const observedEvidence = Array.isArray(candidate.observed_evidence)
              ? candidate.observed_evidence
              : [];
            const systemAttribution = Array.isArray(candidate.system_attribution)
              ? candidate.system_attribution
              : [];
            const isDirect = candidate.distance_hops === 1 || candidate.match_type === 'DIRECT_INTERACTION';
            const isExact = candidate.match_type === 'KNOWN_VASP_MATCH';

            return (
              <Card
                key={candidate.vasp_id || candidate.id || idx}
                className="border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            Rank #{candidate.rank || idx + 1}
                          </span>
                          <CardTitle icon={Building2}>
                            {candidate.vasp_name || 'Unregistered VASP Entity'}
                          </CardTitle>
                          {candidate.jurisdiction && (
                            <Badge variant="outline" size="xs">
                              {candidate.jurisdiction}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              isExact
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : isDirect
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-blue-950 text-blue-300 border border-blue-800'
                            }`}
                          >
                            {candidate.relationship_type || (isDirect ? 'Direct VASP Interaction' : 'Indirect VASP Relationship')}
                          </span>
                          {candidate.source && (
                            <span className="text-[10px] text-slate-400">
                              Source: <span className="text-slate-300">{candidate.source}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${conf.color}`}>
                        {conf.label}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Score and Metrics Bar */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Attribution Score</span>
                        <span className="text-base font-bold text-cyan-300">{scoreFormatted}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Graph Distance</span>
                        <span className="text-base font-bold text-slate-200">
                          {candidate.distance_hops ?? 1} hop{(candidate.distance_hops ?? 1) > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Interactions</span>
                        <span className="text-base font-bold text-slate-200">
                          {candidate.interaction_count ?? 1}
                        </span>
                      </div>
                    </div>

                    {/* Matched Address details if provided */}
                    {candidate.address_matched && (
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500">Matched Address:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-300">{truncateAddress(candidate.address_matched, 6, 4)}</span>
                          <CopyButton text={candidate.address_matched} />
                        </div>
                      </div>
                    )}

                    {/* Section A: Observed Evidence */}
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Observed Evidence (On-Chain Transactions)</span>
                      </div>
                      {observedEvidence.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                          {observedEvidence.map((ev, i) => (
                            <li key={i} className="leading-relaxed">{ev}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No direct transfers observed; relationship established topologically.
                        </p>
                      )}
                    </div>

                    {/* Section B: System Attribution Assessment */}
                    <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>System Attribution Assessment (Heuristics & Proximity)</span>
                      </div>
                      {systemAttribution.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                          {systemAttribution.map((attr, i) => (
                            <li key={i} className="leading-relaxed">{attr}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Statistical graph correlation against registered exchange cluster.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Explanatory Empty State conforming to No VASP Association Identified */
        <Card className="p-8 text-center border-slate-800 bg-slate-950/40">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center">
              <Building2 className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-white">No VASP Association Identified</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedCase?.wallet_address ? (
                <>
                  The investigation for{' '}
                  <span className="font-mono text-cyan-400">{truncateAddress(selectedCase.wallet_address)}</span> analyzed{' '}
                  <span className="text-white font-medium">{summary.transactions_analyzed ?? 0}</span> transactions across{' '}
                  <span className="text-white font-medium">{summary.unique_counterparties ?? 0}</span> counterparties.
                  None of the observed counterparties or multi-hop paths matched registered VASP directory clusters.
                </>
              ) : (
                'Select an investigation from the header dropdown above or start a new investigation to run blockchain analysis.'
              )}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="cyan"
                size="sm"
                onClick={() => onNavigateTab('new-investigation')}
              >
                Start New Investigation
              </Button>
              {selectedCase && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab('graph')}
                >
                  Inspect Graph
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default VASPIntelligencePage;
