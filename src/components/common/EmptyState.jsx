import React from 'react';
import { Database, Search, ArrowRight } from 'lucide-react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = Database,
  title = 'No data available',
  description = 'No records have been returned by the backend API.',
  actionLabel,
  onAction,
  actionIcon: ActionIcon = ArrowRight,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="secondary"
          size="sm"
          icon={ActionIcon}
          className="border-slate-700 hover:border-cyan-500/50 hover:text-cyan-300"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
