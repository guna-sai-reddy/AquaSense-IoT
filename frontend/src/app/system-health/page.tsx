"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  Globe,
  Radio,
  RefreshCw,
  Server,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { DatabaseHealthResponse, SystemStatusResponse } from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthResponse | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadHealthData = async () => {
    setError(null);
    try {
      const [h, dbH, sys] = await Promise.all([
        api.getHealth().catch((e) => ({ status: "unavailable", error: e.message })),
        api.getDatabaseHealth().catch((e) => ({
          status: "unavailable" as const,
          database: "PostgreSQL",
          connected: false,
          error: e.message,
          remedy: "Start-Service postgresql-x64-18",
        })),
        api.getSystemStatus().catch((e) => null),
      ]);
      setHealth(h);
      setDbHealth(dbH);
      if (sys) setSystemStatus(sys);
    } catch (err: any) {
      setError(err.message || "Failed to query system status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealthData();
  }, []);

  const handleCopyRemedy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                System Operations & Data-Source Health
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Real-time observability of FastAPI backend, PostgreSQL database, ML model pipelines, and satellite services
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                loadHealthData();
              }}
              disabled={refreshing}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
              Live Ping
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Health Endpoint Communication Issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Primary Architecture Tiers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. FastAPI API Server */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Server className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold text-slate-900 text-sm">FastAPI Web Application</h3>
                    </div>
                    {health?.status === "healthy" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Operational
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        Unreachable
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Service</span>
                      <span className="font-mono text-slate-800">Uvicorn ASGI</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">API Version</span>
                      <span className="font-mono text-slate-800">v1.0.0</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Endpoint</span>
                      <span className="font-mono text-slate-800">http://localhost:8000</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Interactive Docs</span>
                      <a
                        href="http://localhost:8000/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        /docs (Swagger UI)
                      </a>
                    </div>
                  </div>
                </div>

                {/* 2. PostgreSQL Relational Database */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold text-slate-900 text-sm">PostgreSQL Engine</h3>
                    </div>
                    {dbHealth?.connected ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        Service Stopped
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Driver</span>
                      <span className="font-mono text-slate-800">AsyncPG / SQLAlchemy 2.0</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Default Port</span>
                      <span className="font-mono text-slate-800">5432</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Database Name</span>
                      <span className="font-mono text-slate-800">aquasense_db</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Schema Migrations</span>
                      <span className="font-semibold text-slate-800">Alembic (001_initial)</span>
                    </div>
                  </div>
                </div>

                {/* 3. ML Inference Engine */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold text-slate-900 text-sm">ML Forecasting Engine</h3>
                    </div>
                    {systemStatus?.services?.ml_engine?.artifact_found ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Inference Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        Missing Artifact
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Model Artifact</span>
                      <span className="font-mono text-slate-800">root_zone_model.joblib</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Algorithm</span>
                      <span className="font-semibold text-slate-800">
                        {systemStatus?.services?.ml_engine?.selected_model || "RandomForest"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Target Horizon</span>
                      <span className="font-semibold text-slate-800">
                        {systemStatus?.services?.ml_engine?.target_horizon || "24h"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Target Depth</span>
                      <span className="font-semibold text-slate-800">
                        {systemStatus?.services?.ml_engine?.target_depth || "7-28 cm (Root Zone)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PostgreSQL Remediation Box (if stopped) */}
              {dbHealth && !dbHealth.connected && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-6 shadow-sm space-y-3">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <h3 className="font-bold text-sm">
                      PostgreSQL Connection Required for Persistent Operations
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    The FastAPI backend is operational, but PostgreSQL on port 5432 is currently stopped.
                    To enable field persistence and historic telemetry logging, launch the database using either command:
                  </p>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-xs text-slate-200">
                      <code>Start-Service postgresql-x64-18</code>
                      <button
                        type="button"
                        onClick={() => handleCopyRemedy("Start-Service postgresql-x64-18")}
                        className="text-slate-400 hover:text-white transition flex items-center space-x-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-2.5 font-mono text-xs text-slate-200">
                      <code>docker compose up -d database</code>
                      <button
                        type="button"
                        onClick={() => handleCopyRemedy("docker compose up -d database")}
                        className="text-slate-400 hover:text-white transition flex items-center space-x-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* External Data Sources Status */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Globe className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    External Remote Sensing & Microclimate Ingestion Feeds
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Open-Meteo ERA5 Reanalysis</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-slate-600">
                      Historical hourly temperature, humidity, surface pressure, shortwave radiation, and precipitation.
                    </p>
                    <span className="inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Public REST / No Credentials
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Open-Meteo Synoptic Forecast</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-slate-600">
                      7-day weather forecasting including Penman-Monteith FAO-56 Reference Evapotranspiration (ET0).
                    </p>
                    <span className="inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Public REST / High Resolution
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">NASA SMAP Radiometry (CMR)</span>
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                    </div>
                    <p className="text-slate-600">
                      Global L-band microwave surface moisture (0-5 cm) retrievals via Earthdata Common Metadata Repository.
                    </p>
                    <span className="inline-block text-[10px] text-sky-800 font-semibold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      NASA Earth Science / Public Search
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Physical In-situ Ground Probes</span>
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                    </div>
                    <p className="text-slate-600">
                      LoRaWAN / cellular field telemetry endpoint accepting multi-depth moisture, soil temperature, and RSSI.
                    </p>
                    <span className="inline-block text-[10px] text-purple-800 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      API Ingestion Active (/observations)
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Spatiotemporal Fusion Engine</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-slate-600">
                      Inverse-distance weighted (IDW) spatial interpolation and cubic spline temporal interpolation pipeline.
                    </p>
                    <span className="inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Python Engine Service
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
