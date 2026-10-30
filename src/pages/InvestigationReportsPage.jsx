import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
  Wallet,
  ArrowRight,
  ShieldAlert,
  Printer,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import reportsApi from '../api/reports';
import investigationsApi from '../api/investigations';
import { formatApiError } from '../api/client';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import Modal from '../components/common/Modal';
import AddressBadge from '../components/common/AddressBadge';
import { formatDateTime, getRiskBadge, truncateAddress } from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';
import { useToast } from '../context/ToastContext';

export const InvestigationReportsPage = ({ onNavigateTab }) => {
  const { activeWallet, activeInvestigationId, selectInvestigation } = useInvestigation();
  const { showToast } = useToast();

  const [investigationsList, setInvestigationsList] = useState([]);
  const [selectedCaseFilter, setSelectedCaseFilter] = useState(activeInvestigationId || 'all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Generate Report Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reportFormat, setReportFormat] = useState('json');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // View Report Modal State
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(false);

  // Load cases list
  useEffect(() => {
    const loadCases = async () => {
      try {
        const data = await investigationsApi.listInvestigations();
        const list = Array.isArray(data) ? data : data?.results || [];
        setInvestigationsList(list);
      } catch (err) {
        console.error('Failed to load investigations list for reports:', err);
      }
    };
    loadCases();
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCaseFilter !== 'all') {
        params.investigation_id = selectedCaseFilter;
      } else if (activeInvestigationId) {
        params.investigation_id = activeInvestigationId;
      } else if (activeWallet) {
        params.wallet_address = activeWallet;
      }

      const data = await reportsApi.listReports(params);
      const results = Array.isArray(data) ? data : data?.results || [];
      setReports(results);
    } catch (err) {
      setError(formatApiError(err));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCaseFilter, activeInvestigationId, activeWallet]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRegenerateReport = async (report) => {
    setGenerating(true);
    try {
      showToast({
        type: 'info',
        title: 'Regenerating Report',
        message: 'Re-compiling blockchain findings, VASP attributions, and AI analysis...',
      });

      const invId = report.investigation_id || activeInvestigationId;
      const walletAddr = report.wallet_address || report.subject_address || activeWallet;

      await reportsApi.generateReport({
        investigation_id: invId || undefined,
        wallet_address: walletAddr || undefined,
        title: report.title || `Forensic Report - Investigation #${invId}`,
        notes: 'Regenerated from latest live blockchain state.',
      });

      showToast({
        type: 'success',
        title: 'Report Regenerated',
        message: 'Updated forensic intelligence dossier generated successfully.',
      });

      fetchReports();
      if (selectedReport) {
        setSelectedReport(null);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Regeneration Failed',
        message: formatApiError(err),
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    setGenerateError('');
    setGenerating(true);
    try {
      const payload = {
        title: reportTitle.trim() || `Forensic Report - ${activeWallet || 'General'}`,
        notes: reportNotes.trim() || undefined,
        wallet_address: activeWallet || undefined,
        investigation_id: activeInvestigationId || undefined,
      };

      const response = await reportsApi.generateReport(payload);
      showToast({
        type: 'success',
        title: 'Report Generated',
        message: 'The Django backend has generated the forensic report dossier.',
      });
      setIsGenerateModalOpen(false);
      setReportTitle('');
      setReportNotes('');
      fetchReports();
    } catch (err) {
      const msg = formatApiError(err);
      setGenerateError(msg);
      showToast({
        type: 'error',
        title: 'Report Generation Failed',
        message: msg,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportDownload = async (report, format = 'json') => {
    if (format === 'html') {
      const url = reportsApi.getDownloadUrl(report.id || report.report_id, 'html');
      window.open(url, '_blank');
      return;
    }

    try {
      showToast({
        type: 'info',
        title: 'Preparing Download',
        message: `Requesting JSON export from Django API...`,
      });
      const blob = await reportsApi.exportReport(report.id || report.report_id, 'json');

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vasp_report_${report.id || 'export'}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        title: 'Export Downloaded',
        message: `Report file downloaded successfully.`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: formatApiError(err),
      });
    }
  };

  const handleViewReport = async (report) => {
    setViewingReport(true);
    try {
      const full = await reportsApi.getReport(report.id || report.report_id);
      setSelectedReport(full || report);
    } catch {
      setSelectedReport(report);
    } finally {
      setViewingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-cyan-400" />
            <span>Investigation Forensic Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Official compliance, attribution, and fund-flow dossiers assembled automatically by the Django backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Case Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <span className="text-slate-500 font-mono text-[10px]">CASE:</span>
            <select
              value={selectedCaseFilter}
              onChange={(e) => setSelectedCaseFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono max-w-[140px] truncate"
            >
              <option value="all">All Cases</option>
              {investigationsList.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} {c.name || truncateAddress(c.wallet_address)}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchReports}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="cyan"
            size="sm"
            icon={Plus}
            onClick={() => setIsGenerateModalOpen(true)}
          >
            Generate Report
          </Button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          title="Reports Retrieval Error"
          error={error}
          onRetry={fetchReports}
        />
      )}

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle icon={FileText}>Archived Forensic Reports</CardTitle>
          <p className="text-xs text-slate-400">All reports tied to persistent database investigations</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Report ID / Title</th>
                  <th className="py-3 px-4">Subject Wallet</th>
                  <th className="py-3 px-4">Generated At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Risk Rating</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-4 px-4">
                        <div className="h-4 bg-slate-800/50 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : reports.length > 0 ? (
                  reports.map((report) => {
                    const risk = getRiskBadge(report.risk_level || report.risk);
                    return (
                      <tr key={report.id || report.report_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200 font-sans">
                            {report.title || `Report #${report.id}`}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Ref: {report.reference_id || `REP-${report.id}`}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <AddressBadge address={report.wallet_address || report.subject_address} />
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                          {formatDateTime(report.created_at || report.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={report.status === 'completed' ? 'emerald' : 'default'}>
                            {report.status || 'Ready'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${risk.color}`}>
                            {risk.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {report.investigation_id && onNavigateTab && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  selectInvestigation(report.investigation_id);
                                  onNavigateTab('wallet');
                                }}
                                title="Open Investigation"
                              >
                                Case #{report.investigation_id}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="xs"
                              icon={Eye}
                              onClick={() => handleViewReport(report)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={RotateCcw}
                              onClick={() => handleRegenerateReport(report)}
                              title="Regenerate Report Dossier"
                            >
                              Regenerate
                            </Button>
                            <Button
                              variant="cyan"
                              size="xs"
                              icon={Printer}
                              onClick={() => handleExportDownload(report, 'html')}
                              title="Print / Save PDF"
                            >
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Download}
                              onClick={() => handleExportDownload(report, 'json')}
                              title="Export JSON"
                            >
                              JSON
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState
                        icon={FileText}
                        title="No reports generated yet"
                        description="Trigger an investigation or report generation to create an official blockchain intelligence case summary."
                        actionLabel="Generate First Report"
                        onAction={() => setIsGenerateModalOpen(true)}
                        actionIcon={Plus}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Forensic Intelligence Report"
        description="Call Django REST backend to compile transaction findings and attribution metrics into a formal report."
      >
        <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
          {generateError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
              {generateError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="e.g. Case Titan - Full Forensic Dossier"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Analyst Investigation Notes
            </label>
            <textarea
              rows={3}
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              placeholder="Add investigator observations, regulatory context, or subpoenas..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Scope
            </label>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300">
              <div>Wallet: {activeWallet || 'Current Filter / All'}</div>
              {activeInvestigationId && <div className="text-[11px] text-slate-500 mt-1">Investigation Case: #{activeInvestigationId}</div>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="cyan"
              size="sm"
              loading={generating}
              icon={CheckCircle2}
            >
              Dispatch Generation Job
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Report Full Details Modal */}
      {selectedReport && (
        <Modal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          title={selectedReport.title || `Forensic Dossier #${selectedReport.id}`}
          description={`Ref: ${selectedReport.reference_id || `REP-${selectedReport.id}`} • Generated ${formatDateTime(selectedReport.created_at || selectedReport.timestamp)}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
              <span className="text-slate-500 text-[10px] uppercase block">Target Subject Address</span>
              <span className="text-cyan-300 font-bold">{selectedReport.wallet_address || selectedReport.subject_address}</span>
            </div>

            {selectedReport.summary && (
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                  Executive Summary
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                  {selectedReport.summary}
                </p>
              </div>
            )}

            {selectedReport.conclusion && (
              <div>
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                  Dynamic Conclusion
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-cyan-800/40 font-mono">
                  {selectedReport.conclusion}
                </p>
              </div>
            )}

            {selectedReport.findings && (
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                  Structured Findings Telemetry
                </h4>
                <pre className="text-[11px] text-slate-300 font-mono bg-black/60 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-52">
                  {typeof selectedReport.findings === 'object'
                    ? JSON.stringify(selectedReport.findings, null, 2)
                    : selectedReport.findings}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => handleRegenerateReport(selectedReport)}
                >
                  Regenerate
                </Button>
                <Button
                  variant="cyan"
                  size="sm"
                  icon={Printer}
                  onClick={() => handleExportDownload(selectedReport, 'html')}
                >
                  Print / Save PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={() => handleExportDownload(selectedReport, 'json')}
                >
                  Download JSON
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedReport(null)}
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InvestigationReportsPage;
