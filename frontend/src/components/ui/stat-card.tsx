import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  badge,
  trend,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow dark:shadow-none ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline space-x-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>
        )}
      </div>

      {(subtitle || badge || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-xs text-slate-600 dark:text-slate-400">
          {badge}
          {trend && (
            <span
              className={`font-medium ${
                trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
