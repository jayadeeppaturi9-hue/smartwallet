import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Wallet,
  ArrowLeftRight,
  Building2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ShieldPlus,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import investigationsApi from '../api/investigations';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { SkeletonKpi, SkeletonChart } from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import AddressBadge from '../components/common/AddressBadge';
import { formatDateTime, getRiskBadge } from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';

export const DashboardPage = ({ onNavigateTab }) => {
  const [stats, setStats] = useState(null);
  const [recentInvestigations, setRecentInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { selectInvestigation } = useInvestigation();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, invRes] = await Promise.allSettled([
        investigationsApi.getDashboardStats(),
        investigationsApi.listInvestigations({ limit: 10 }),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats(null);
      }

      if (invRes.status === 'fulfilled') {
        const data = invRes.value;
        setRecentInvestigations(Array.isArray(data) ? data : data?.results || []);
      } else {
        setRecentInvestigations([]);
      }

      if (statsRes.status === 'rejected' && invRes.status === 'rejected') {
        setError(formatApiError(statsRes.reason || invRes.reason));
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const hasAnyData = stats && (
    stats.total_investigations > 0 ||
    stats.wallets_analyzed > 0 ||
    stats.transactions_analyzed > 0 ||
    stats.vasp_candidates > 0
  );

  const confidenceData = Array.isArray(stats?.confidence_distribution) ? stats.confidence_distribution : [];
  const volumeTrendData = Array.isArray(stats?.volume_trends) ? stats.volume_trends : [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Blockchain Forensics Dashboard</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-normal border border-slate-700">
              LIVE DATABASE METRICS
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time smart wallet attribution, VASP counterparty mapping, and fund-flow telemetry from SQLite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchDashboardData}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="cyan"
            size="sm"
            icon={ShieldPlus}
            onClick={() => onNavigateTab('new-investigation')}
          >
            New Investigation
          </Button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          title="Backend Connection Notice"
          error={error}
          onRetry={fetchDashboardData}
        />
      )}

      {/* KPI Cards Grid: All 7 Real Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            {/* 1. Total Investigations */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Investigations</span>
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-white">
                {stats?.total_investigations !== undefined ? Number(stats.total_investigations).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Total registered</div>
            </Card>

            {/* 2. Completed Investigations */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-400">
                {stats?.completed_investigations !== undefined ? Number(stats.completed_investigations).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Successful cases</div>
            </Card>

            {/* 3. Failed Investigations */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Failed</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-rose-400">
                {stats?.failed_investigations !== undefined ? Number(stats.failed_investigations).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Provider/node errors</div>
            </Card>

            {/* 4. Wallets Analyzed */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Wallets</span>
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-cyan-300">
                {stats?.wallets_analyzed !== undefined ? Number(stats.wallets_analyzed).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Unique subjects</div>
            </Card>

            {/* 5. Transactions Analyzed */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Transactions</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-slate-100">
                {stats?.transactions_analyzed !== undefined ? Number(stats.transactions_analyzed).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Stored & analyzed</div>
            </Card>

            {/* 6. VASP Candidates -> Semantic Amber */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">VASP Matches</span>
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-amber-300">
                {stats?.vasp_candidates !== undefined ? Number(stats.vasp_candidates).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Attributed entities</div>
            </Card>

            {/* 7. Reports Generated */}
            <Card className="p-3.5 border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-mono text-[10px] uppercase">Reports</span>
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-300">
                {stats?.reports_generated !== undefined ? Number(stats.reports_generated).toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Archived dossiers</div>
            </Card>
          </>
        )}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Attribution Confidence Distribution */}
        <Card>
          <CardHeader>
            <CardTitle icon={PieChartIcon}>Attribution Confidence Distribution</CardTitle>
            <p className="text-xs text-slate-400">Breakdown of backend VASP mapping certainty</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonChart />
            ) : confidenceData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No confidence data available"
                description="Confidence distribution will display once investigations with VASP attributions are completed."
                className="py-10"
              />
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Transaction Volume Trend */}
        <Card>
          <CardHeader>
            <CardTitle icon={TrendingUp}>Analyzed Transaction Volume</CardTitle>
            <p className="text-xs text-slate-400">On-chain transfer volume processed over time</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonChart />
            ) : volumeTrendData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#volumeGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No transaction trends available"
                description="Historical transaction analysis points will populate once investigations are performed."
                className="py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Investigations History & Management Table (Requirement 13 & 15) */}
      <Card>
        <CardHeader
          action={
            <Button
              variant="cyan"
              size="sm"
              icon={ShieldPlus}
              onClick={() => onNavigateTab('new-investigation')}
              className="text-xs"
            >
              Start Investigation
            </Button>
          }
        >
          <CardTitle icon={Clock}>Investigation Case History</CardTitle>
          <p className="text-xs text-slate-400">Reopen previous investigations and review dossiers (All values from SQLite database)</p>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <div className="h-10 bg-slate-800/40 rounded animate-pulse" />
              <div className="h-10 bg-slate-800/40 rounded animate-pulse" />
            </div>
          ) : recentInvestigations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Case # / Name</th>
                    <th className="py-3 px-4">Target Wallet</th>
                    <th className="py-3 px-4">Network</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">VASP Status</th>
                    <th className="py-3 px-4">Report</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentInvestigations.map((inv) => {
                    const risk = getRiskBadge(inv.risk_level);
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">#{inv.id}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[160px] font-sans">
                            {inv.name || 'Untitled Case'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <AddressBadge address={inv.wallet_address} network={inv.blockchain_network} />
                        </td>
                        <td className="py-3 px-4 text-slate-300 uppercase">
                          {inv.blockchain_network || 'ethereum'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={inv.status === 'COMPLETED' ? 'emerald' : inv.status === 'RUNNING' ? 'cyan' : 'rose'}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-300">
                            {inv.vasp_state === 'CANDIDATES_FOUND' ? (
                              <span className="text-purple-400 font-semibold">Matched ({inv.attributions_count || 0})</span>
                            ) : inv.vasp_state === 'NO_VASP_FOUND' ? (
                              <span className="text-slate-400">No VASP</span>
                            ) : (
                              <span className="text-amber-400">Unconfigured</span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={inv.has_report ? 'emerald' : 'default'}>
                            {inv.has_report ? 'Archived' : 'None'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {formatDateTime(inv.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => {
                                selectInvestigation(inv);
                                onNavigateTab('wallet');
                              }}
                            >
                              Open Case
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                selectInvestigation(inv);
                                onNavigateTab('graph');
                              }}
                            >
                              Graph
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={ShieldAlert}
                title="No investigations yet"
                description="Start a new wallet investigation to begin blockchain analysis."
                actionLabel="Create First Investigation"
                onAction={() => onNavigateTab('new-investigation')}
                actionIcon={ShieldPlus}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
