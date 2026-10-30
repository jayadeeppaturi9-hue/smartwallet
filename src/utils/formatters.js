/**
 * Formatting utilities for blockchain forensic intelligence
 */

export const truncateAddress = (address, start = 6, end = 4) => {
  if (!address || typeof address !== 'string') return 'Not available';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const truncateHash = (hash, start = 8, end = 6) => {
  if (!hash || typeof hash !== 'string') return 'Not available';
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
};

export const formatDateTime = (dateInput) => {
  if (!dateInput) return 'Not available';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return String(dateInput);
  }
};

export const formatCryptoAmount = (amount, symbol = '', maxDecimals = 6) => {
  if (amount === null || amount === undefined || amount === '') return 'Not available';
  const num = Number(amount);
  if (isNaN(num)) return `${amount} ${symbol}`.trim();
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  }).format(num);
  return symbol ? `${formatted} ${symbol}` : formatted;
};

export const formatPercent = (score, isDecimalFraction = false) => {
  if (score === null || score === undefined || score === '') return 'Not available';
  let val = Number(score);
  if (isNaN(val)) return String(score);
  if (isDecimalFraction && val <= 1) {
    val = val * 100;
  }
  return `${val.toFixed(1)}%`;
};

export const getConfidenceBadge = (confidence) => {
  if (!confidence) return { label: 'Unknown', color: 'bg-slate-800 text-slate-400 border-slate-700' };
  const str = String(confidence).toLowerCase();
  if (str === 'high' || str.includes('high') || Number(confidence) >= 0.8) {
    return { label: 'High Confidence', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  }
  if (str === 'medium' || str.includes('medium') || Number(confidence) >= 0.5) {
    return { label: 'Medium Confidence', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  }
  return { label: 'Low Confidence', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
};

export const getRiskBadge = (risk) => {
  if (!risk) return { label: 'Unassessed', color: 'bg-slate-800 text-slate-400 border-slate-700' };
  const str = String(risk).toLowerCase();
  if (str.includes('critical') || str.includes('severe')) {
    return { label: 'Critical Risk', color: 'bg-rose-950/60 text-rose-300 border-rose-700/60' };
  }
  if (str.includes('high')) {
    return { label: 'High Risk', color: 'bg-orange-950/60 text-orange-300 border-orange-700/60' };
  }
  if (str.includes('medium') || str.includes('moderate')) {
    return { label: 'Medium Risk', color: 'bg-amber-950/60 text-amber-300 border-amber-700/60' };
  }
  if (str.includes('low')) {
    return { label: 'Low Risk', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60' };
  }
  return { label: String(risk), color: 'bg-slate-800 text-slate-300 border-slate-700' };
};
