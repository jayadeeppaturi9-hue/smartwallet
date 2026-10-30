import React, { useState, useEffect } from 'react';
import {
  ShieldPlus,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Search,
  Eye,
  GitFork,
  FileText,
} from 'lucide-react';
import investigationsApi from '../api/investigations';
import systemApi from '../api/system';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import ErrorAlert from '../components/common/ErrorAlert';
import { validateAddressForNetwork } from '../utils/validators';
import { useToast } from '../context/ToastContext';
import { useInvestigation } from '../context/InvestigationContext';

export const NewInvestigationPage = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const { selectInvestigation, selectWallet } = useInvestigation();

  // Form State
  const [walletAddress, setWalletAddress] = useState('');
  const [network, setNetwork] = useState('ethereum');
  const [name, setName] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [depth, setDepth] = useState('2');
  const [traceContracts, setTraceContracts] = useState(true);
  const [clusterVasps, setClusterVasps] = useState(true);
  const [includeMempool, setIncludeMempool] = useState(false);

  // Dynamic Networks fetched from backend
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState(null);
  const [createdResult, setCreatedResult] = useState(null);

  useEffect(() => {
    const fetchNetworks = async () => {
      setLoadingNetworks(true);
      try {
        const nets = await systemApi.getSupportedNetworks();
        if (Array.isArray(nets) && nets.length > 0) {
          setAvailableNetworks(nets);
          setNetwork(nets[0].id || 'ethereum');
        }
      } catch {
        // Fallback default networks
      } finally {
        setLoadingNetworks(false);
      }
    };
    fetchNetworks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setApiError(null);
    setCreatedResult(null);

    // Frontend validation
    const validation = validateAddressForNetwork(walletAddress, network);
    if (!validation.valid) {
      setValidationError(validation.message);
      return;
    }

    setSubmitting(true);
    setSubmissionStep(1);

    // Simulate progress visual steps for analytical telemetry while request is in flight
    const timer1 = setTimeout(() => setSubmissionStep(2), 1200);
    const timer2 = setTimeout(() => setSubmissionStep(3), 2800);

    try {
      const payload = {
        wallet_address: walletAddress.trim(),
        blockchain_network: network,
        name: name.trim() || undefined,
        reference_id: referenceId.trim() || undefined,
        depth: parseInt(depth, 10) || 2,
        options: {
          trace_contracts: traceContracts,
          cluster_vasps: clusterVasps,
          include_mempool: includeMempool,
        },
      };

      const response = await investigationsApi.createInvestigation(payload);
      clearTimeout(timer1);
      clearTimeout(timer2);
      setSubmissionStep(4);
      setCreatedResult(response);

      selectInvestigation(response);
      selectWallet(walletAddress.trim(), network);

      showToast({
        type: 'success',
        title: 'Investigation Initiated',
        message: `Analysis job registered by Django API for ${walletAddress.slice(0, 10)}...`,
      });
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setSubmissionStep(0);
      const formatted = formatApiError(err);
      setApiError(formatted);
      showToast({
        type: 'error',
        title: 'Investigation Request Failed',
        message: formatted,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    'Connecting to Django REST API...',
    'Querying blockchain node & mempool...',
    'Executing VASP clustering algorithms...',
    'Investigation completed successfully.',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-800/60">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <ShieldPlus className="w-6 h-6 text-cyan-400" />
          <span>New Forensic Investigation</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Initiate an automated deep-dive analysis on a blockchain wallet to detect VASP interactions, transaction flow, and attribution.
        </p>
      </div>

      {apiError && (
        <ErrorAlert
          title="Investigation Dispatch Error"
          error={apiError}
          onRetry={handleSubmit}
        />
      )}

      {/* Success Banner if investigation completed */}
      {createdResult && (
        <div className="p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-emerald-200">
                Investigation Dispatched & Analyzed Successfully
              </h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                Investigation #{createdResult.id || createdResult.investigation_id || 'NEW'} has been processed by the Django blockchain engine.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="cyan"
                  icon={Eye}
                  onClick={() => onNavigateTab('wallet')}
                >
                  View Wallet Investigation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={GitFork}
                  onClick={() => onNavigateTab('graph')}
                >
                  Inspect Relationship Graph
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={FileText}
                  onClick={() => onNavigateTab('reports')}
                >
                  Generate Forensic Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle icon={Search}>Target Identification</CardTitle>
            <p className="text-xs text-slate-400">Specify the primary blockchain wallet address to investigate</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Wallet Address Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                Target Wallet Address <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => {
                  setWalletAddress(e.target.value);
                  setValidationError('');
                }}
                disabled={submitting}
                placeholder="e.g. 0x71C...a83F or 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                className={`w-full bg-slate-950 border ${
                  validationError ? 'border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                } rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {validationError && (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError}</span>
                </p>
              )}
            </div>

            {/* Blockchain Network & Depth Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                  Blockchain Network <span className="text-cyan-400">*</span>
                </label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  disabled={submitting || loadingNetworks}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {availableNetworks.map((net) => (
                    <option key={net.id} value={net.id}>
                      {net.name} ({net.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Endpoints configured in Django backend settings.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                  Traversal Depth (Hops)
                </label>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="1">1 Hop (Direct counterparties only)</option>
                  <option value="2">2 Hops (Standard forensic depth)</option>
                  <option value="3">3 Hops (Deep multi-cluster trace)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Higher hops analyze indirect fund routes through intermediary wallets.
                </p>
              </div>
            </div>

            {/* Optional Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Investigation Name / Alias
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Case Titan - Suspected Liquidity Pull"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  External Reference / Incident ID
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. INC-2026-8921A"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Analysis Options */}
        <Card>
          <CardHeader>
            <CardTitle icon={Sliders}>Forensic Analysis Modules</CardTitle>
            <p className="text-xs text-slate-400">Configure heuristic clustering and transaction parsing modules</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={clusterVasps}
                onChange={(e) => setClusterVasps(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-200">
                  Execute Smart VASP Mapping & Heuristic Clustering
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Analyze transaction behavior against known exchange deposit patterns, sweep accounts, and hot wallets.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={traceContracts}
                onChange={(e) => setTraceContracts(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-200">
                  Trace Smart Contract Invocations & Internal Transfers
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Inspect ERC20/SPL transfers, DEX swaps, and bridge interactions across EVM call traces.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={includeMempool}
                onChange={(e) => setIncludeMempool(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-200">
                  Inspect Unconfirmed Mempool Transfers
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Query pending broadcast transactions to detect active fund exfiltration in flight.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Live Loading Telemetry */}
        {submitting && (
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-900/90 shadow-xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>Backend Analysis in Progress</span>
              </span>
              <span className="font-mono text-slate-400 text-[11px]">
                Step {submissionStep} of 3
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-1.5 transition-all duration-500 ease-out"
                style={{ width: `${(submissionStep / 3) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-300 font-mono">
              {steps[submissionStep - 1] || 'Processing...'}
            </p>
          </div>
        )}

        {/* Form Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setWalletAddress('');
              setName('');
              setReferenceId('');
              setValidationError('');
            }}
            disabled={submitting}
          >
            Clear Form
          </Button>

          <Button
            type="submit"
            variant="cyan"
            size="lg"
            loading={submitting}
            icon={ArrowRight}
            className="px-6"
          >
            Initiate Investigation
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewInvestigationPage;
