import React from "react";
import { IrrigationActionType } from "@/lib/types";

interface ActionBadgeProps {
  action: IrrigationActionType | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ActionBadge({ action, className = "", size = "md" }: ActionBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-semibold",
    md: "px-3 py-1 text-sm font-semibold",
    lg: "px-4 py-1.5 text-base font-bold",
  }[size];

  switch (action) {
    case "IRRIGATE_RECOMMENDED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm ${sizeClasses} ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 mr-2 animate-ping" />
          IRRIGATE RECOMMENDED
        </span>
      );
    case "IRRIGATION_DEFERRED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-sm ${sizeClasses} ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
          IRRIGATION DEFERRED
        </span>
      );
    case "INDETERMINATE":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-sm ${sizeClasses} ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
          INDETERMINATE (Insufficient Data)
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${sizeClasses} ${className}`}
        >
          {action || "UNKNOWN"}
        </span>
      );
  }
}
