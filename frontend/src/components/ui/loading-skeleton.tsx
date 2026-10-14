import React from "react";

export function LoadingSkeleton({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-10 w-full rounded-lg bg-slate-200"
          style={{ opacity: 1 - idx * 0.15 }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse space-y-4">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-8 w-1/2 rounded bg-slate-200" />
      <div className="h-3 w-3/4 rounded bg-slate-100" />
    </div>
  );
}
