import React from 'react';

export const Skeleton = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded bg-slate-800/60 ${className}`}
    />
  );
};

export const SkeletonKpi = () => {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
};

export const SkeletonTableRow = ({ columns = 6 }) => {
  return (
    <tr className="border-b border-slate-800/60 animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
};

export const SkeletonChart = () => {
  return (
    <div className="h-64 rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-col justify-between">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-end gap-3 h-40 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${20 + (i * 11) % 70}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
