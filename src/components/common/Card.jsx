import React from 'react';

export const Card = ({ children, className = '', interactive = false, ...props }) => {
  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-xl ${
        interactive ? 'hover:border-cyan-500/30 transition-all duration-200' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', action = null }) => {
  return (
    <div className={`p-5 pb-3 border-b border-slate-800/60 flex items-start justify-between gap-4 ${className}`}>
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const CardTitle = ({ children, className = '', icon: Icon = null }) => {
  return (
    <h3 className={`text-base font-semibold text-slate-100 flex items-center gap-2 ${className}`}>
      {Icon && <Icon className="w-4 h-4 text-cyan-400 shrink-0" />}
      <span>{children}</span>
    </h3>
  );
};

export const CardDescription = ({ children, className = '' }) => {
  return (
    <p className={`text-xs text-slate-400 mt-1 leading-relaxed ${className}`}>
      {children}
    </p>
  );
};

export const CardContent = ({ children, className = '' }) => {
  return <div className={`p-5 ${className}`}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`p-4 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
