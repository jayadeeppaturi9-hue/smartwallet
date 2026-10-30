import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  icon: Icon,
}) => {
  const base = 'inline-flex items-center font-medium rounded border tracking-wide select-none';

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-1.5',
  };

  const variants = {
    default: 'bg-slate-900 text-slate-300 border-slate-700/80',
    target: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
    direct: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    intermediary: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    vasp: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
    blue: 'bg-slate-800 text-slate-300 border-slate-700',
    indigo: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    critical: 'bg-red-950/80 text-red-200 border-red-700 shadow-sm shadow-red-950/50',
    outline: 'bg-transparent text-slate-400 border-slate-700',
    mono: 'bg-slate-900 font-mono text-slate-300 border-slate-800',
  };

  return (
    <span className={`${base} ${sizes[size] || sizes.sm} ${variants[variant] || variants.default} ${className}`}>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
};

export default Badge;
