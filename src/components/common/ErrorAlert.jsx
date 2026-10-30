import React, { useState } from 'react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, ServerCrash } from 'lucide-react';
import Button from './Button';

export const ErrorAlert = ({
  error,
  title = 'API Communication Error',
  onRetry,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred while communicating with the backend.';
  const technicalDetail = error?.response?.data
    ? JSON.stringify(error.response.data, null, 2)
    : error?.stack || null;

  return (
    <div
      className={`rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 text-rose-200 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <ServerCrash className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-rose-200">{title}</div>
          <div className="text-xs text-rose-300/90 mt-1 leading-relaxed break-words">
            {errorMessage}
          </div>

          {technicalDetail && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline flex items-center gap-1"
              >
                <span>{expanded ? 'Hide technical diagnostics' : 'Show technical diagnostics'}</span>
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expanded && (
                <pre className="mt-2 p-2.5 rounded bg-black/60 border border-rose-900/60 text-[10px] text-rose-300/80 font-mono overflow-x-auto max-h-40">
                  {technicalDetail}
                </pre>
              )}
            </div>
          )}
        </div>

        {onRetry && (
          <Button
            size="sm"
            variant="danger"
            onClick={onRetry}
            icon={RefreshCw}
            className="shrink-0 text-xs py-1"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
