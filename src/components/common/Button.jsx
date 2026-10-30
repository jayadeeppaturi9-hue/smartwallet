import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-md shadow-cyan-500/20 border border-cyan-400/40',
    cyan:
      'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-md shadow-cyan-500/20 border border-cyan-400/40',
    emerald:
      'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 border border-emerald-500/40',
    amber:
      'bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-600/20 border border-amber-500/40',
    secondary:
      'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-sm',
    outline:
      'bg-transparent hover:bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white',
    ghost:
      'bg-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200',
    danger:
      'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 shadow-md shadow-rose-950/40',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
