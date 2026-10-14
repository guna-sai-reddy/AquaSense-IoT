import React from "react";
import { DataSourceType } from "@/lib/types";

interface ProvenanceBadgeProps {
  type: DataSourceType | string;
  className?: string;
}

export function ProvenanceBadge({ type, className = "" }: ProvenanceBadgeProps) {
  const normType = (type || "").toUpperCase();

  switch (normType) {
    case "MEASURED":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ${className}`}
          title="Physical in-situ ground probe reading"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mr-1.5 animate-pulse" />
          MEASURED (Ground Probe)
        </span>
      );
    case "SATELLITE_DERIVED":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 ${className}`}
          title="NASA SMAP Radiometer retrieval"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400 mr-1.5" />
          SATELLITE (NASA SMAP)
        </span>
      );
    case "WEATHER_MODEL_DERIVED":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 ${className}`}
          title="Open-Meteo ERA5 / Numerical Weather Prediction"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mr-1.5" />
          WEATHER MODEL (ERA5)
        </span>
      );
    case "PREDICTED":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${className}`}
          title="AquaSense-IoT Machine Learning Forecast"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 mr-1.5" />
          PREDICTED (24h ML)
        </span>
      );
    case "SIMULATED":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 ${className}`}
          title="Automated Test Fixture"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mr-1.5" />
          SIMULATED (Test)
        </span>
      );
    case "PROVISIONAL_DEFAULT_MIDPOINT":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${className}`}
          title="Agronomic Default Midpoint Fallback"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5" />
          PROVISIONAL (Agronomic Midpoint)
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${className}`}
        >
          {normType || "UNKNOWN"}
        </span>
      );
  }
}
