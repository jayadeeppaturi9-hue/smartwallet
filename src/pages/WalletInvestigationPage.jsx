import React, { useState, useEffect, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';
import {
  ShieldAlert,
  Wallet,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Building2,
  GitFork,
  FileText,
  Activity,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  RefreshCw,
  Download,
  Eye,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Filter,
  Check,
  Cpu,
  Database,
  ExternalLink,
} from 'lucide-react';
import investigationsApi from '../api/investigations';
import reportsApi from '../api/reports';
import transactionsApi from '../api/transactions';
import graphApi from '../api/graph';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import AddressBadge from '../components/common/AddressBadge';
import Modal from '../components/common/Modal';
import CopyButton from '../components/common/CopyButton';
import {
  formatCryptoAmount,
  formatPercent,
  formatDateTime,
  truncateAddress,
  getRiskBadge,
  getConfidenceBadge,
} from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';
import { useToast } from '../context/ToastContext';

export const WalletInvestigationPage = ({ onNavigateTab }) => {
  const { activeWallet, activeInvestigationId, selectInvestigation, selectWallet } = useInvestigation();
  const { showToast } = useToast();

  // Investigation List & Selection State
  const [allInvestigations, setAllInvestigations] = useState([]);
  const [currentInvestigation, setCurrentInvestigation] = useState(null);
  const [loadingInv, setLoadingInv] = useState(false);
  const [error, setError] = useState(null);

  // Raw Transactions State
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Graph Canvas State
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [selectedGraphElement, setSelectedGraphElement] = useState(null);
  const [graphDepth, setGraphDepth] = useState('2');
  const [graphFilter, setGraphFilter] = useState('all'); // all, vasp_only, direct_only

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // 1. Fetch list of all historical investigations for the case switcher
  const fetchInvestigationsList = useCallback(async () => {
    try {
      const data = await investigationsApi.listInvestigations();
      const list = Array.isArray(data) ? data : data?.results || [];
      setAllInvestigations(list);
      return list;
    } catch (err) {
      console.error('Failed to list investigations:', err);
      return [];
    }
  }, []);

  // 2. Fetch full investigation details
  const loadInvestigation = useCallback(async (idOrAddress) => {
    setLoadingInv(true);
    setError(null);
    try {
      let inv = null;
      if (typeof idOrAddress === 'number' || (typeof idOrAddress === 'string' && /^\d+$/.test(idOrAddress))) {
        inv = await investigationsApi.getInvestigation(idOrAddress);
      } else if (typeof idOrAddress === 'string' && idOrAddress.trim()) {
        const clean = idOrAddress.trim().toLowerCase();
        const list = await investigationsApi.listInvestigations({ wallet_address: clean });
        const results = Array.isArray(list) ? list : list?.results || [];
        if (results.length > 0) {
          inv = await investigationsApi.getInvestigation(results[0].id);
        }
      }

      if (inv) {
        setCurrentInvestigation(inv);
        selectInvestigation(inv);

        // Concurrently fetch transactions and graph data for this investigation
        loadInvestigationTransactions(inv.wallet_address, inv.blockchain_network);
        loadInvestigationGraph(inv.id, inv.wallet_address, graphDepth);
      } else {
        setCurrentInvestigation(null);
      }
    } catch (err) {
      setError(formatApiError(err));
      setCurrentInvestigation(null);
    } finally {
      setLoadingInv(false);
    }
  }, [selectInvestigation, graphDepth]);

  // Load transactions
  const loadInvestigationTransactions = async (address, network) => {
    if (!address) return;
    setLoadingTx(true);
    try {
      const data = await transactionsApi.listTransactions({
        wallet: address,
        blockchain: network || 'ethereum',
        limit: 50,
      });
      const txList = Array.isArray(data) ? data : data?.results || [];
      setTransactions(txList);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  };

  // Load graph
  const loadInvestigationGraph = async (invId, address, depth) => {
    setLoadingGraph(true);
    setSelectedGraphElement(null);
    try {
      const params = { depth: parseInt(depth, 10) || 2 };
      if (invId) params.investigation_id = invId;
      else if (address) params.wallet_address = address;

      const data = await graphApi.getGraphData(params);
      setGraphData(data && Array.isArray(data.nodes) ? data : { nodes: [], edges: [] });
    } catch (err) {
      console.error('Failed to load graph:', err);
      setGraphData({ nodes: [], edges: [] });
    } finally {
      setLoadingGraph(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      const list = await fetchInvestigationsList();
      if (activeInvestigationId) {
        loadInvestigation(activeInvestigationId);
      } else if (activeWallet) {
        loadInvestigation(activeWallet);
      } else if (list.length > 0) {
        loadInvestigation(list[0].id);
      }
    };
    init();
  }, []);

  // Update on context change
  useEffect(() => {
    if (activeInvestigationId && (!currentInvestigation || currentInvestigation.id !== activeInvestigationId)) {
      loadInvestigation(activeInvestigationId);
    }
  }, [activeInvestigationId]);

  // Cytoscape initialization & updates
  useEffect(() => {
    if (!containerRef.current) return;

    const rawNodes = graphData?.nodes || [];
    const rawEdges = graphData?.edges || [];

    if (rawNodes.length === 0) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return;
    }

    const targetAddr = (currentInvestigation?.wallet_address || activeWallet || '').toLowerCase();

    // Filter nodes if requested
    let filteredNodes = rawNodes;
    if (graphFilter === 'vasp_only') {
      filteredNodes = rawNodes.filter((n) => n.is_vasp || n.address?.toLowerCase() === targetAddr);
    } else if (graphFilter === 'direct_only') {
      filteredNodes = rawNodes.filter((n) => n.hops <= 1);
    }

    const visibleNodeIds = new Set(filteredNodes.map((n) => String(n.id || n.address)));

    const knownVaspAddrs = new Set(filteredNodes.filter((n) => n.is_vasp).map((n) => String(n.id || n.address).toLowerCase()));

    const elements = [
      ...filteredNodes.map((n) => {
        const id = String(n.id || n.address);
        const isTarget = n.address?.toLowerCase() === targetAddr;
        const role = isTarget ? 'target' : (n.is_vasp ? 'vasp' : (n.hops === 1 ? 'direct_counterparty' : 'intermediary'));

        return {
          group: 'nodes',
          data: {
            id,
            address: n.address,
            short_address: n.short_address || truncateAddress(n.address, 4, 3),
            label: n.vasp_name || n.short_address || truncateAddress(n.address, 4, 3),
            role,
            tier: n.tier || (isTarget ? 1 : (n.hops === 1 ? 2 : 3)),
            is_vasp: n.is_vasp,
            vasp_name: n.vasp_name,
            hops: n.hops,
            tx_count: n.tx_count,
            total_in: n.total_in,
            total_out: n.total_out,
            risk_level: n.risk_level || 'low',
          },
        };
      }),
      ...rawEdges
        .filter((e) => visibleNodeIds.has(String(e.source)) && visibleNodeIds.has(String(e.target)))
        .map((e, idx) => {
          const src = String(e.source).toLowerCase();
          const tgt = String(e.target).toLowerCase();
          const isVasp = knownVaspAddrs.has(src) || knownVaspAddrs.has(tgt);
          const isDirect = Boolean(e.is_direct) || src === targetAddr || tgt === targetAddr;
          const edgeClass = isVasp ? 'vasp-edge' : (isDirect ? 'direct-edge' : 'intermediary-edge');

          return {
            group: 'edges',
            classes: edgeClass,
            data: {
              id: e.id || `e-${idx}`,
              source: String(e.source),
              target: String(e.target),
              amount: e.amount,
              asset: e.asset || 'ETH',
              count: e.count || 1,
              is_direct: isDirect,
              label: e.label || '',
            },
          };
        }),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#0c1220',
            'border-width': 2,
            'border-color': '#1d283e',
            label: 'data(label)',
            color: '#cbd5e1',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            width: 30,
            height: 30,
          },
        },
        // Target Wallet: glowing cyan, Tier 1
        {
          selector: 'node[role = "target"]',
          style: {
            'background-color': '#06b6d4',
            'border-color': '#22d3ee',
            'border-width': 3.5,
            color: '#67e8f9',
            'font-weight': 'bold',
            width: 44,
            height: 44,
            'shadow-blur': 14,
            'shadow-color': '#06b6d4',
            'shadow-opacity': 0.6,
          },
        },
        // Direct Counterparties: Tier 2 (hops 1) -> Emerald
        {
          selector: 'node[role = "direct_counterparty"]',
          style: {
            'background-color': '#059669',
            'border-color': '#10b981',
            'border-width': 2.5,
            color: '#a7f3d0',
            width: 32,
            height: 32,
            'shadow-blur': 8,
            'shadow-color': '#10b981',
            'shadow-opacity': 0.5,
          },
        },
        // Intermediary Wallets: Tier 3 (hops > 1) -> Violet
        {
          selector: 'node[role = "intermediary"]',
          style: {
            'background-color': '#7c3aed',
            'border-color': '#a78bfa',
            'border-width': 2,
            color: '#ede9fe',
            width: 26,
            height: 26,
            'shadow-blur': 8,
            'shadow-color': '#8b5cf6',
            'shadow-opacity': 0.4,
          },
        },
        // Known VASP: Tier 4 -> Amber (Round rectangle)
        {
          selector: 'node[is_vasp = true]',
          style: {
            'background-color': '#d97706',
            'border-color': '#fbbf24',
            'border-width': 3,
            color: '#fef3c7',
            shape: 'round-rectangle',
            width: 40,
            height: 40,
            'shadow-blur': 16,
            'shadow-color': '#f59e0b',
            'shadow-opacity': 0.75,
          },
        },
        // Selected node
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ffffff',
            'border-width': 4,
            'shadow-blur': 18,
            'shadow-color': '#06b6d4',
            'shadow-opacity': 0.9,
          },
        },
        // Base edge styling
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#1d283e',
            'target-arrow-color': '#41516c',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
          },
        },
        // Direct relationship edge -> Emerald
        {
          selector: 'edge.direct-edge, edge[is_direct = true]',
          style: {
            width: 2.2,
            'line-color': '#059669',
            'target-arrow-color': '#10b981',
          },
        },
        // Intermediary relationship edge -> Violet
        {
          selector: 'edge.intermediary-edge',
          style: {
            width: 1.8,
            'line-color': '#6d28d9',
            'target-arrow-color': '#8b5cf6',
          },
        },
        // VASP relationship edge -> Amber
        {
          selector: 'edge.vasp-edge',
          style: {
            width: 2.4,
            'line-color': '#d97706',
            'target-arrow-color': '#fbbf24',
          },
        },
        // Selected edge -> Cyan
        {
          selector: 'edge:selected',
          style: {
            width: 3.5,
            'line-color': '#22d3ee',
            'target-arrow-color': '#22d3ee',
            label: 'data(label)',
            color: '#67e8f9',
            'font-size': '10px',
            'font-family': 'monospace',
          },
        },
      ],
      layout: {
        name: 'breadthfirst',
        roots: targetAddr ? `node[address = "${targetAddr}"]` : undefined,
        directed: true,
        padding: 30,
        spacingFactor: 1.4,
        animate: true,
      },
    });

    cy.on('tap', 'node', (evt) => setSelectedGraphElement({ type: 'node', data: evt.target.data() }));
    cy.on('tap', 'edge', (evt) => setSelectedGraphElement({ type: 'edge', data: evt.target.data() }));
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedGraphElement(null);
    });

    cyRef.current = cy;

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData, graphFilter, currentInvestigation]);

  // Graph control buttons
  const handleZoomIn = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current && cyRef.current.fit(undefined, 30);
  const handleCenterTarget = () => {
    if (!cyRef.current || !currentInvestigation) return;
    const targetNode = cyRef.current.$(`node[address = "${currentInvestigation.wallet_address.toLowerCase()}"]`);
    if (targetNode.length) {
      cyRef.current.center(targetNode);
      cyRef.current.zoom(1.5);
    }
  };
  const handleResetGraph = () => {
    if (cyRef.current) {
      cyRef.current.layout({ name: 'breadthfirst', directed: true, padding: 30, spacingFactor: 1.4, animate: true }).run();
    }
  };

  // Report Actions
  const handleGenerateReport = async () => {
    if (!currentInvestigation) return;
    setGeneratingReport(true);
    try {
      const res = await investigationsApi.generateReport(currentInvestigation.id);
      showToast({
        type: 'success',
        title: 'Report Generated',
        message: `Forensic report #${res.id} (${res.reference_id}) created by Django.`,
      });
      loadInvestigation(currentInvestigation.id);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Report Generation Failed',
        message: formatApiError(err),
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleViewReport = async () => {
    if (!currentInvestigation) return;
    try {
      const rep = await investigationsApi.getReport(currentInvestigation.id);
      setActiveReport(rep);
      setReportModalOpen(true);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Could Not Open Report',
        message: formatApiError(err),
      });
    }
  };

  const handleDownloadReport = (format = 'html') => {
    if (!currentInvestigation) return;
    const reportId = currentInvestigation.report_id;
    if (!reportId) {
      showToast({
        type: 'info',
        title: 'Generating Report First',
        message: 'Generating report before download...',
      });
      handleGenerateReport();
      return;
    }

    if (format === 'json') {
      reportsApi.exportReport(reportId, 'json').then((blob) => {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `investigation_${currentInvestigation.id}_report.json`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      });
    } else {
      // Open printable HTML view directly in new tab so user can Print/Save as PDF
      const url = reportsApi.getDownloadUrl(reportId, 'html');
      window.open(url, '_blank');
    }
  };

  const summary = currentInvestigation?.investigation_summary || {};
  const vaspState = currentInvestigation?.vasp_state || 'NO_VASP_FOUND';
  const aiExp = currentInvestigation?.ai_explanation || {};
  const timeline = currentInvestigation?.timeline || [];
  const attributions = currentInvestigation?.attributions || [];
  const risk = getRiskBadge(currentInvestigation?.risk_level);

  return (
    <div className="space-y-8 pb-16">
      {/* ────────────────────────────────────────── */}
      {/* HEADER: Investigation Title & Case Selector */}
      {/* ────────────────────────────────────────── */}
      <div className="pb-4 border-b border-slate-800/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-mono tracking-wider text-cyan-400">
                Official Case Docket
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">
                Case ID #{currentInvestigation?.id || '—'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-cyan-400" />
              <span>{currentInvestigation?.name || `Investigation #${currentInvestigation?.id || '—'}`}</span>
            </h1>
          </div>

          {/* Case Selector Dropdown & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentInvestigation?.id || ''}
              onChange={(e) => loadInvestigation(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 max-w-xs"
            >
              {allInvestigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  #{inv.id}: {inv.name || truncateAddress(inv.wallet_address, 6, 4)} ({inv.status})
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={loadingInv}
              onClick={() => currentInvestigation && loadInvestigation(currentInvestigation.id)}
            >
              Reload Case
            </Button>

            <Button
              variant="cyan"
              size="sm"
              onClick={() => onNavigateTab('new-investigation')}
            >
              + New Case
            </Button>
          </div>
        </div>

        {/* Case Metadata Bar */}
        {currentInvestigation && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Investigation Status</span>
              <Badge variant={currentInvestigation.status === 'COMPLETED' ? 'emerald' : currentInvestigation.status === 'RUNNING' ? 'cyan' : 'rose'}>
                {currentInvestigation.status}
              </Badge>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Created Date</span>
              <span className="text-slate-200">{formatDateTime(currentInvestigation.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Blockchain / Network</span>
              <span className="text-cyan-300 font-semibold uppercase">{currentInvestigation.blockchain_network}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Analysis Depth</span>
              <span className="text-slate-200">{currentInvestigation.depth} Hop(s)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Assessed Risk</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${risk.color}`}>
                {risk.label}
              </span>
            </div>
          </div>
        )}

        {/* Subject Wallet Address Card */}
        {currentInvestigation && (
          <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 uppercase">Subject Wallet:</span>
              <span className="font-mono text-sm text-cyan-300 font-bold break-all">
                {currentInvestigation.wallet_address}
              </span>
              <CopyButton text={currentInvestigation.wallet_address} size="xs" />
            </div>
            <a
              href={`https://etherscan.io/address/${currentInvestigation.wallet_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 font-mono"
            >
              <span>Etherscan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {error && (
        <ErrorAlert title="Investigation Load Error" error={error} onRetry={() => loadInvestigation(activeInvestigationId || activeWallet)} />
      )}

      {/* ────────────────────────────────────────── */}
      {/* INVESTIGATION STATUS TIMELINE (12 STAGES)  */}
      {/* ────────────────────────────────────────── */}
      {timeline.length > 0 && (
        <Card className="border-slate-800 bg-slate-950/50">
          <CardHeader>
            <CardTitle icon={Clock}>Investigation Execution Lifecycle</CardTitle>
            <p className="text-xs text-slate-400">Real backend progression through the 12 forensic pipeline stages</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {timeline.map((step, idx) => {
                const isDone = step.status === 'completed';
                const isFail = step.status === 'failed';
                const isRunning = step.status === 'running';

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : isFail
                        ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                        : isRunning
                        ? 'bg-cyan-950/30 border-cyan-700/60 text-cyan-300 animate-pulse'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono opacity-70">#{idx + 1}</span>
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : isFail ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : isRunning ? (
                        <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    <div className="font-semibold text-[11px] leading-tight">{step.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────────────────────────────────────────── */}
      {/* SECTION 1: INVESTIGATION SUMMARY           */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">1</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Investigation Summary</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Transactions Analyzed</span>
            <span className="text-xl font-bold font-mono text-white mt-1 block">
              {summary.transactions_analyzed !== undefined ? Number(summary.transactions_analyzed).toLocaleString() : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Incoming Transfers</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
              {summary.incoming_transactions !== undefined ? Number(summary.incoming_transactions).toLocaleString() : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Outgoing Transfers</span>
            <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
              {summary.outgoing_transactions !== undefined ? Number(summary.outgoing_transactions).toLocaleString() : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Total Inflow</span>
            <span className="text-xl font-bold font-mono text-emerald-300 mt-1 block">
              {formatCryptoAmount(summary.total_inflow, 'ETH')}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Total Outflow</span>
            <span className="text-xl font-bold font-mono text-rose-300 mt-1 block">
              {formatCryptoAmount(summary.total_outflow, 'ETH')}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Unique Counterparties</span>
            <span className="text-xl font-bold font-mono text-cyan-300 mt-1 block">
              {summary.unique_counterparties !== undefined ? summary.unique_counterparties : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Graph Nodes</span>
            <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
              {summary.graph_nodes !== undefined ? summary.graph_nodes : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">Graph Relationships</span>
            <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
              {summary.graph_relationships !== undefined ? summary.graph_relationships : '—'}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">VASP-Linked Addresses</span>
            <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
              {summary.vasp_linked_nodes !== undefined ? summary.vasp_linked_nodes : (summary.vasp_linked_addresses !== undefined ? summary.vasp_linked_addresses : '—')}
            </span>
          </Card>

          <Card className="p-3.5 border-slate-800 bg-slate-900/40">
            <span className="text-slate-400 text-[10px] uppercase block font-mono">VASP Candidates</span>
            <span className="text-xl font-bold font-mono text-purple-300 mt-1 block">
              {summary.vasp_candidates !== undefined ? summary.vasp_candidates : '—'}
            </span>
          </Card>
        </div>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 2: TRANSACTION ANALYSIS            */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">2</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Transaction Analysis</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle icon={Activity}>Confirmed On-Chain Transactions</CardTitle>
            <p className="text-xs text-slate-400">Actual telemetry retrieved via blockchain provider</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[11px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Tx Hash</th>
                    <th className="py-2.5 px-4">Flow Type</th>
                    <th className="py-2.5 px-4">Counterparty</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingTx ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                        Loading transaction data...
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map((tx, idx) => {
                      const isIncoming = tx.receiver?.toLowerCase() === (currentInvestigation?.wallet_address || '').toLowerCase();
                      const counterparty = isIncoming ? tx.sender : tx.receiver;

                      return (
                        <tr key={tx.id || tx.tx_hash || idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-4 text-cyan-400 truncate max-w-[140px]">
                            {tx.tx_hash ? `${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-6)}` : '—'}
                          </td>
                          <td className="py-2 px-4">
                            {isIncoming ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                <ArrowDownLeft className="w-3.5 h-3.5" /> INCOMING
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1 font-semibold">
                                <ArrowUpRight className="w-3.5 h-3.5" /> OUTGOING
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <span className="text-slate-300">{truncateAddress(counterparty, 6, 4)}</span>
                          </td>
                          <td className="py-2 px-4 text-right font-bold text-white">
                            {formatCryptoAmount(tx.amount, tx.asset || 'ETH')}
                          </td>
                          <td className="py-2 px-4 text-slate-400 text-[11px]">
                            {formatDateTime(tx.timestamp)}
                          </td>
                          <td className="py-2 px-4">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                              {tx.status || 'CONFIRMED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        Zero transactions detected for this subject address on {currentInvestigation?.blockchain_network || 'the network'}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 3: FUND-FLOW ANALYSIS              */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">3</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Fund-Flow Analysis</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle icon={ArrowLeftRight}>Flow Trajectory & Counterparty Concentrations</CardTitle>
            <p className="text-xs text-slate-400">Directional movement across the highest volume connected wallets</p>
          </CardHeader>
          <CardContent>
            {summary.transactions_analyzed > 0 ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-mono text-[11px]">Fund Flow Balance</span>
                    <span className="text-sm font-semibold text-white">
                      Net Flow: {formatCryptoAmount((summary.total_inflow || 0) - (summary.total_outflow || 0), 'ETH')}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300">
                    Inflow: <span className="text-emerald-400">{formatCryptoAmount(summary.total_inflow, 'ETH')}</span> |
                    Outflow: <span className="text-rose-400 ml-1">{formatCryptoAmount(summary.total_outflow, 'ETH')}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-cyan-400 font-semibold block mb-1">Flow Pattern Observation:</span>
                  {summary.total_inflow > 0 && summary.total_outflow > 0 && Math.abs(summary.total_inflow - summary.total_outflow) < 0.2
                    ? 'Identified transit flow characteristics: Inflow closely matches outflow within short window, consistent with pass-through routing.'
                    : summary.total_inflow > summary.total_outflow
                    ? 'Identified capital accumulation characteristics: Majority of transferred assets remain retained or consolidated.'
                    : 'Identified disbursement characteristics: Substantial outgoing transfers relative to incoming historical volume.'}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ArrowLeftRight}
                title="No fund flow activity observed"
                description="Zero confirmed transactions recorded; directional fund flow metrics are currently non-existent."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 4: RELATIONSHIP GRAPH              */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">4</span>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Relationship Graph</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={ExternalLink}
            onClick={() => onNavigateTab('graph')}
          >
            Full-Screen Graph
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800">
          <div className="p-3 border-b border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Controls Bar */}
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" icon={ZoomIn} onClick={handleZoomIn} title="Zoom In" />
              <Button size="xs" variant="outline" icon={ZoomOut} onClick={handleZoomOut} title="Zoom Out" />
              <Button size="xs" variant="outline" icon={Maximize2} onClick={handleFit} title="Fit Graph" />
              <Button size="xs" variant="outline" icon={Crosshair} onClick={handleCenterTarget} title="Center Target" />
              <Button size="xs" variant="outline" icon={RotateCcw} onClick={handleResetGraph} title="Reset Layout" />
            </div>

            {/* Depth & Filter Selectors */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                <span>Depth:</span>
                <select
                  value={graphDepth}
                  onChange={(e) => {
                    setGraphDepth(e.target.value);
                    if (currentInvestigation) {
                      loadInvestigationGraph(currentInvestigation.id, currentInvestigation.wallet_address, e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
                >
                  <option value="1">1 Hop</option>
                  <option value="2">2 Hops</option>
                  <option value="3">3 Hops</option>
                </select>
              </div>

              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                <span>Filter:</span>
                <select
                  value={graphFilter}
                  onChange={(e) => setGraphFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
                >
                  <option value="all">All Nodes</option>
                  <option value="vasp_only">VASP Nodes Only</option>
                  <option value="direct_only">Direct 1-Hop Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Graph Canvas Container */}
          <div className="relative h-96 w-full bg-slate-950">
            <div ref={containerRef} className="w-full h-full" />

            {loadingGraph && (
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating topology layout...
                </div>
              </div>
            )}

            {/* Hierarchy Legend */}
            <div className="absolute bottom-3 left-3 p-2.5 rounded-lg bg-slate-900/95 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1 backdrop-blur-md hidden sm:block">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Hierarchy</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Target Subject (Cyan)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Direct Counterparty (Emerald)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Intermediary Wallet (Violet)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Known VASP Address (Amber)</div>
            </div>

            {/* Selection Inspector Drawer */}
            {selectedGraphElement && (
              <div className="absolute top-3 right-3 z-10 w-72 rounded-lg bg-slate-900/95 border border-slate-700 p-3 text-xs shadow-xl backdrop-blur-md animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 font-bold text-white">
                  <span>{selectedGraphElement.type === 'node' ? 'Node Telemetry' : 'Edge Transfer'}</span>
                  <button onClick={() => setSelectedGraphElement(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {selectedGraphElement.type === 'node' ? (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Address</span>
                      <span className="text-cyan-300 break-all">{selectedGraphElement.data.address}</span>
                    </div>
                    {selectedGraphElement.data.vasp_name && (
                      <div className="p-1.5 rounded bg-amber-950/40 border border-amber-600/40">
                        <span className="text-amber-400 block text-[9px] uppercase font-semibold">Verified VASP</span>
                        <span className="text-amber-200 font-bold">{selectedGraphElement.data.vasp_name}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Role</span>
                        <span className="text-slate-200 capitalize">{selectedGraphElement.data.role}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Hops Distance</span>
                        <span className="text-slate-200">{selectedGraphElement.data.hops}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Transfer Amount</span>
                      <span className="text-cyan-300 font-bold">
                        {formatCryptoAmount(selectedGraphElement.data.amount, selectedGraphElement.data.asset)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Source → Target</span>
                      <span className="text-slate-300 text-[10px] break-all">{selectedGraphElement.data.source} → {selectedGraphElement.data.target}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 5: VASP INTELLIGENCE               */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">5</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">VASP Intelligence</h2>
        </div>

        {/* State A: VASP Candidates Found */}
        {vaspState === 'CANDIDATES_FOUND' && attributions.length > 0 && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 font-mono flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>VASP Attribution Candidates Identified ({attributions.length} profile(s))</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attributions.map((attr, idx) => {
                const conf = getConfidenceBadge(attr.confidence);
                return (
                  <Card key={idx} className="p-4 border-amber-500/20 bg-slate-900/60">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                            Rank #{attr.rank || idx + 1}
                          </span>
                          <span className="text-base font-bold text-white">{attr.vasp_name || attr.vasp?.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Jurisdiction: {attr.vasp?.jurisdiction || 'Global'}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${conf.color}`}>
                          {conf.label}
                        </span>
                        <div className="text-sm font-bold font-mono text-cyan-300 mt-1">
                          Score: {attr.score?.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-1.5 font-mono">
                      <div className="text-[11px] text-slate-400">
                        <span className="text-slate-500">Distance: </span>
                        {attr.evidence?.distance_hops ? `${attr.evidence.distance_hops} Hop(s)` : 'Direct'}
                        <span className="text-slate-500 ml-3">Interactions: </span>
                        {attr.evidence?.interaction_count || 1}
                      </div>

                      {attr.evidence?.observed_evidence?.length > 0 && (
                        <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300">
                          <span className="text-cyan-400 block font-semibold mb-0.5">Observed Signals:</span>
                          <ul className="list-disc list-inside space-y-0.5">
                            {attr.evidence.observed_evidence.slice(0, 2).map((ev, i) => (
                              <li key={i}>{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* State B: Analysis completed but no VASP found */}
        {vaspState === 'NO_VASP_FOUND' && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              No VASP association identified
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              The current investigation did not produce sufficient evidence linking the analyzed wallet to a known VASP address.
              The observed counterparty addresses operate within unhosted or private clusters.
            </p>
          </div>
        )}

        {/* State C: VASP intelligence database unavailable */}
        {vaspState === 'DATABASE_UNAVAILABLE' && (
          <div className="p-6 rounded-xl border border-amber-800/40 bg-amber-950/20 text-center space-y-2">
            <Database className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wide">
              VASP intelligence unavailable
            </h3>
            <p className="text-xs text-amber-300/80 max-w-lg mx-auto leading-relaxed">
              Blockchain analysis completed, but no verified VASP address intelligence is currently configured in the database for this blockchain.
            </p>
          </div>
        )}

        {/* State D: Investigation still running */}
        {vaspState === 'ATTRIBUTION_PENDING' && (
          <div className="p-6 rounded-xl border border-cyan-800/40 bg-cyan-950/20 text-center space-y-2">
            <Cpu className="w-8 h-8 text-cyan-400 mx-auto animate-spin" />
            <h3 className="text-sm font-bold text-cyan-200 uppercase tracking-wide">
              VASP attribution pending
            </h3>
            <p className="text-xs text-cyan-300/80 max-w-lg mx-auto leading-relaxed">
              Transaction and relationship analysis is still being processed by the backend.
            </p>
          </div>
        )}

        {/* State E: Blockchain provider failure */}
        {vaspState === 'PROVIDER_FAILURE' && (
          <div className="p-6 rounded-xl border border-rose-800/40 bg-rose-950/20 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-rose-200 uppercase tracking-wide">
              Blockchain analysis could not be completed
            </h3>
            <p className="text-xs text-rose-300/80 max-w-lg mx-auto leading-relaxed">
              {currentInvestigation?.error_message || 'The investigation report will record the failure and its cause.'}
            </p>
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 6: EVIDENCE                        */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">6</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Observed Evidence & Attribution</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-slate-800 bg-slate-900/50">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Observed Blockchain Evidence (Hard Facts)
            </h3>
            <div className="space-y-1.5 text-xs text-slate-300 font-mono">
              {aiExp.evidence_breakdown?.observed_evidence?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {aiExp.evidence_breakdown.observed_evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Zero direct transactional evidence recorded in current telemetry.</p>
              )}
            </div>
          </Card>

          <Card className="p-4 border-slate-800 bg-slate-900/50">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-amber-400" /> System Attribution Assessment (Heuristics)
            </h3>
            <div className="space-y-1.5 text-xs text-slate-300 font-mono">
              {aiExp.evidence_breakdown?.system_attribution?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {aiExp.evidence_breakdown.system_attribution.map((sa, i) => (
                    <li key={i}>{sa}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Attribution algorithms evaluated graph with no positive matches.</p>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 7: AI INVESTIGATION EXPLANATION    */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">7</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">AI Investigation Explanation</h2>
        </div>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950">
          <CardHeader>
            <CardTitle icon={Cpu}>Grounded Forensic Narrative</CardTitle>
            <p className="text-xs text-slate-400">Synthesized strictly from actual stored telemetry (never hallucinating facts)</p>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {aiExp.analysis_scope && (
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 block mb-1">
                  1. Analysis Scope
                </span>
                <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  {aiExp.analysis_scope}
                </p>
              </div>
            )}

            {aiExp.discoveries?.length > 0 && (
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 block mb-1">
                  2. Key Findings Discovered
                </span>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {aiExp.discoveries.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {aiExp.interpretation && (
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 block mb-1">
                  3. Technical Interpretation
                </span>
                <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  {aiExp.interpretation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 8: DYNAMIC CONCLUSION              */}
      {/* ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs font-bold">8</span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Dynamic Investigation Conclusion</h2>
        </div>

        <div className="p-5 rounded-xl border border-cyan-500/40 bg-slate-900/90 shadow-lg">
          <p className="text-xs sm:text-sm text-slate-200 font-mono leading-relaxed">
            {aiExp.conclusion || currentInvestigation?.summary || 'Investigation concluded.'}
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────── */}
      {/* ACTION CONTROLS: GENERATE / VIEW / DOWNLOAD */}
      {/* ────────────────────────────────────────── */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Forensic Investigation Dossier</h3>
          <p className="text-xs text-slate-400">
            {currentInvestigation?.has_report
              ? `Report #${currentInvestigation.report_id} (${currentInvestigation.report_reference_id || 'Ready'}) archived in database.`
              : 'Generate formal case dossier for compliance and legal submission.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={generatingReport}
            onClick={handleGenerateReport}
          >
            {currentInvestigation?.has_report ? 'Regenerate Report' : 'Generate Report'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={handleViewReport}
          >
            View Report
          </Button>

          <Button
            variant="cyan"
            size="sm"
            icon={Download}
            onClick={() => handleDownloadReport('html')}
          >
            Download Report (PDF/Print)
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => handleDownloadReport('json')}
            title="Download JSON"
          >
            JSON
          </Button>
        </div>
      </div>

      {/* ────────────────────────────────────────── */}
      {/* SECTION 18: DATA SOURCE TRANSPARENCY       */}
      {/* ────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-2">
          Data Source Transparency & Attribution Provenance
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[11px]">
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Blockchain Data</span>
            <span className="text-cyan-300">Alchemy API Provider</span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">VASP Intelligence</span>
            <span className="text-amber-300 font-medium">Configured VASP Database</span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Attribution</span>
            <span className="text-emerald-300">Backend Heuristic Engine</span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Explanation</span>
            <span className="text-purple-300">AI Analysis of Stored Results</span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────── */}
      {/* VIEW REPORT FULL MODAL                     */}
      {/* ────────────────────────────────────────── */}
      {reportModalOpen && activeReport && (
        <Modal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={`Forensic Dossier: ${activeReport.title || 'Case Report'}`}
          description={`Ref: ${activeReport.reference_id || `REP-${activeReport.id}`} • Status: ${activeReport.status}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
              <span className="text-slate-500 text-[10px] block">Subject Address</span>
              <span className="text-cyan-300 font-bold">{activeReport.wallet_address}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Executive Summary</span>
              <p className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 leading-relaxed font-mono">
                {activeReport.summary}
              </p>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Formal Conclusion</span>
              <p className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 leading-relaxed font-mono">
                {activeReport.conclusion}
              </p>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Structured Telemetry</span>
              <pre className="p-3 rounded-lg bg-black/60 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-48">
                {JSON.stringify(activeReport.findings, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <Button
                variant="cyan"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadReport('html')}
              >
                Print / Save PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setReportModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WalletInvestigationPage;
