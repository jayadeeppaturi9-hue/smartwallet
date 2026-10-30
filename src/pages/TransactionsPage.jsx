import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
  Eye,
} from 'lucide-react';
import transactionsApi from '../api/transactions';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import AddressBadge from '../components/common/AddressBadge';
import Drawer from '../components/common/Drawer';
import CopyButton from '../components/common/CopyButton';
import { SkeletonTableRow } from '../components/common/Skeleton';
import {
  formatDateTime,
  formatCryptoAmount,
  truncateHash,
  truncateAddress,
} from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';

export const TransactionsPage = () => {
  const { activeWallet, activeNetwork } = useInvestigation();

  // State
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Query State
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected Transaction for Drawer Inspection
  const [selectedTx, setSelectedTx] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
      };

      if (activeWallet) params.wallet_address = activeWallet;
      if (search.trim()) params.search = search.trim();
      if (direction !== 'all') params.direction = direction;
      if (status !== 'all') params.status = status;

      const data = await transactionsApi.listTransactions(params);

      if (Array.isArray(data)) {
        setTransactions(data);
        setTotalCount(data.length);
      } else if (data && Array.isArray(data.results)) {
        setTransactions(data.results);
        setTotalCount(data.count ?? data.results.length);
      } else {
        setTransactions([]);
        setTotalCount(0);
      }
    } catch (err) {
      setError(formatApiError(err));
      setTransactions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeWallet, search, direction, status, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const renderStatusBadge = (txStatus) => {
    const s = String(txStatus || '').toLowerCase();
    if (s === 'confirmed' || s === 'success') {
      return (
        <Badge variant="emerald" icon={CheckCircle2}>
          Confirmed
        </Badge>
      );
    }
    if (s === 'pending') {
      return (
        <Badge variant="amber" icon={Clock}>
          Pending
        </Badge>
      );
    }
    if (s === 'failed' || s === 'reverted') {
      return (
        <Badge variant="rose" icon={XCircle}>
          Failed
        </Badge>
      );
    }
    return <Badge variant="default">{txStatus || 'Unknown'}</Badge>;
  };

  const renderDirectionBadge = (dir) => {
    const d = String(dir || '').toUpperCase();
    if (d === 'IN' || d === 'INCOMING') {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 font-semibold">
          <ArrowDownLeft className="w-3.5 h-3.5" /> IN
        </span>
      );
    }
    if (d === 'OUT' || d === 'OUTGOING') {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-rose-400 font-semibold">
          <ArrowUpRight className="w-3.5 h-3.5" /> OUT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-cyan-400">
        <ArrowLeftRight className="w-3.5 h-3.5" /> INTERNAL
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-cyan-400" />
            <span>Transaction Telemetry</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Forensic transaction ledger retrieved directly from the Django backend.
            {activeWallet && (
              <span className="ml-2 font-mono text-cyan-300">
                Filtered for: {truncateAddress(activeWallet, 6, 4)}
              </span>
            )}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={fetchTransactions}
          loading={loading}
        >
          Refresh Ledger
        </Button>
      </div>

      {error && (
        <ErrorAlert
          title="Transaction Query Notice"
          error={error}
          onRetry={fetchTransactions}
        />
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction hash, sender, or receiver address..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Directions</option>
              <option value="IN">Inflow (IN)</option>
              <option value="OUT">Outflow (OUT)</option>
              <option value="INTERNAL">Internal</option>
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <Button type="submit" variant="secondary" size="sm" icon={Filter}>
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Receiver</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonTableRow key={i} columns={8} />
                  ))
                ) : transactions.length > 0 ? (
                  transactions.map((tx, idx) => (
                    <tr
                      key={tx.hash || tx.transaction_hash || idx}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-cyan-300">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="hover:underline font-mono"
                          >
                            {truncateHash(tx.hash || tx.transaction_hash)}
                          </button>
                          <CopyButton text={tx.hash || tx.transaction_hash} size="xs" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTime(tx.timestamp || tx.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <AddressBadge
                          address={tx.sender || tx.from_address}
                          network={tx.network || activeNetwork}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {renderDirectionBadge(tx.direction)}
                      </td>
                      <td className="py-3 px-4">
                        <AddressBadge
                          address={tx.receiver || tx.to_address}
                          network={tx.network || activeNetwork}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-100 whitespace-nowrap">
                        {formatCryptoAmount(tx.amount || tx.value, tx.asset || tx.symbol || '')}
                      </td>
                      <td className="py-3 px-4">
                        {renderStatusBadge(tx.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => setSelectedTx(tx)}
                          className="text-xs p-1"
                          title="Inspect Transaction"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={ArrowLeftRight}
                        title="No transactions found"
                        description={
                          activeWallet
                            ? `No transaction records have been returned by the backend for wallet ${activeWallet}.`
                            : 'No transaction data exists in the backend database. Run an investigation to ingest transactions.'
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {transactions.length > 0 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing Page <span className="font-mono text-slate-200">{page}</span> of{' '}
                <span className="font-mono text-slate-200">{totalPages}</span> ({totalCount} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Side Drawer */}
      <Drawer
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Transaction Forensic Details"
        subtitle={selectedTx?.hash || selectedTx?.transaction_hash}
        width="max-w-lg"
      >
        {selectedTx && (
          <div className="space-y-5">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Transaction Hash
              </span>
              <div className="mt-1 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 break-all flex items-center justify-between">
                <span>{selectedTx.hash || selectedTx.transaction_hash}</span>
                <CopyButton text={selectedTx.hash || selectedTx.transaction_hash} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Timestamp</span>
                <span className="font-mono text-slate-200 mt-1 block">
                  {formatDateTime(selectedTx.timestamp || selectedTx.created_at)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Execution Status</span>
                <div className="mt-1">{renderStatusBadge(selectedTx.status)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-slate-500 text-[11px] block mb-1">From (Originating Address)</span>
                <AddressBadge
                  address={selectedTx.sender || selectedTx.from_address}
                  truncate={false}
                />
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block mb-1">To (Destination Address)</span>
                <AddressBadge
                  address={selectedTx.receiver || selectedTx.to_address}
                  truncate={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Amount</span>
                <span className="font-mono text-slate-100 font-bold mt-1 block">
                  {formatCryptoAmount(selectedTx.amount || selectedTx.value, selectedTx.asset || selectedTx.symbol || '')}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Gas / Fee</span>
                <span className="font-mono text-slate-200 mt-1 block">
                  {selectedTx.fee !== undefined ? formatCryptoAmount(selectedTx.fee) : 'Not available'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-500 block text-[11px]">Block Height / Confirmations</span>
              <span className="font-mono text-slate-200 mt-1 block">
                {selectedTx.block_height !== undefined
                  ? `Block #${selectedTx.block_height} (${selectedTx.confirmations ?? 0} confirmations)`
                  : 'Not available'}
              </span>
            </div>

            {selectedTx.raw_data && (
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  Raw Payload / Method
                </span>
                <pre className="mt-1 p-3 rounded bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                  {typeof selectedTx.raw_data === 'object'
                    ? JSON.stringify(selectedTx.raw_data, null, 2)
                    : selectedTx.raw_data}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default TransactionsPage;
