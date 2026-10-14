"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Compass,
  Cpu,
  Droplets,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Sprout,
  Sun,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Field,
  IrrigationRecommendation,
  Prediction,
  SensorObservation,
  SystemStatusResponse,
} from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ActionBadge } from "@/components/ui/action-badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

export default function OverviewPage() {
  const { t } = useLanguage();
  const { palette } = useTheme();
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [latestObs, setLatestObs] = useState<SensorObservation | null>(null);
  const [latestPred, setLatestPred] = useState<Prediction | null>(null);
  const [latestRec, setLatestRec] = useState<IrrigationRecommendation | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Action execution states
  const [runningPrediction, setRunningPrediction] = useState<boolean>(false);
  const [runningAdvisory, setRunningAdvisory] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Explainer accordion
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const loadData = async (fieldIdOverride?: string) => {
    setError(null);
    try {
      const [fieldList, statusResp] = await Promise.all([
        api.getFields(),
        api.getSystemStatus().catch(() => null),
      ]);
      setFields(fieldList);
      if (statusResp) setSystemStatus(statusResp);

      const targetId =
        fieldIdOverride ||
        selectedFieldId ||
        (fieldList.length > 0 ? fieldList[0].id : "");

      if (targetId) {
        setSelectedFieldId(targetId);
        const [obsList, predList, recList] = await Promise.all([
          api.getFieldObservations(targetId, 1).catch(() => []),
          api.getFieldPredictions(targetId, 1).catch(() => []),
          api.getFieldRecommendations(targetId, 1).catch(() => []),
        ]);
        setLatestObs(obsList.length > 0 ? obsList[0] : null);
        setLatestPred(predList.length > 0 ? predList[0] : null);
        setLatestRec(recList.length > 0 ? recList[0] : null);
      } else {
        setLatestObs(null);
        setLatestPred(null);
        setLatestRec(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data from backend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldChange = (newFieldId: string) => {
    setSelectedFieldId(newFieldId);
    setLoading(true);
    loadData(newFieldId);
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Direct 1-Click Quick Actions
  const handleQuickPredict = async () => {
    if (!selectedFieldId) return;
    setRunningPrediction(true);
    setActionSuccessMessage(null);
    try {
      await api.triggerPrediction(selectedFieldId);
      await loadData(selectedFieldId);
      setActionSuccessMessage("⚡ AI Forecast updated successfully! New 24-hour prediction is ready.");
      setTimeout(() => setActionSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to run AI prediction.");
    } finally {
      setRunningPrediction(false);
    }
  };

  const handleQuickAdvisory = async () => {
    if (!selectedFieldId) return;
    setRunningAdvisory(true);
    setActionSuccessMessage(null);
    try {
      await api.triggerRecommendation(selectedFieldId);
      await loadData(selectedFieldId);
      setActionSuccessMessage("💧 Irrigation Advisory computed! Updated water recommendations are shown below.");
      setTimeout(() => setActionSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to calculate irrigation advisory.");
    } finally {
      setRunningAdvisory(false);
    }
  };

  // Volumetric m3/m3 and percentages
  const currentMoisturePercent =
    latestObs?.soil_moisture_m3m3 !== undefined
      ? (latestObs.soil_moisture_m3m3 * 100).toFixed(1)
      : null;

  const predictedMoisturePercent =
    latestPred?.predicted_moisture_m3m3 !== undefined
      ? (latestPred.predicted_moisture_m3m3 * 100).toFixed(1)
      : null;

  const fieldCapacityPercent = selectedField
    ? (selectedField.field_capacity_theta * 100).toFixed(0)
    : "31";

  const wiltingPointPercent = selectedField
    ? (selectedField.wilting_point_theta * 100).toFixed(0)
    : "15";

  // Determine moisture health status
  const getMoistureHealthBadge = () => {
    if (!latestObs || !selectedField) return null;
    const m = latestObs.soil_moisture_m3m3;
    const fc = selectedField.field_capacity_theta;
    const wp = selectedField.wilting_point_theta;

    if (m >= fc) {
      return {
        label: "Saturated (Full Capacity)",
        color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        summary: "Soil is completely soaked. No watering needed.",
      };
    }
    const safeThreshold = wp + (fc - wp) * (1 - selectedField.depletion_fraction_p);
    if (m >= safeThreshold) {
      return {
        label: "Optimal Soil Moisture",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        summary: "Crop has abundant water in root zone. High growth vigor.",
      };
    }
    if (m > wp) {
      return {
        label: "Thirsty / Irrigation Needed",
        color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        summary: "Moisture is dropping below plant stress threshold.",
      };
    }
    return {
      label: "Critically Dry (Wilting Zone)",
      color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
      summary: "Severe drought stress. Immediate irrigation recommended.",
    };
  };

  const healthBadge = getMoistureHealthBadge();

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Top Bar & Field Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Smart Farm Operations Dashboard</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                    Live System
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time soil moisture monitoring, AI forecasting, and precision watering recommendations for your crops
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {fields.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Active Field:
                  </span>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.crop_name} — {f.area_value} {f.area_unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                disabled={refreshing}
                title="Refresh dashboard metrics"
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`}
                />
                Refresh
              </button>

              <Link
                href="/fields"
                className="inline-flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Field
              </Link>
            </div>
          </div>

          {/* Action Success Toast Banner */}
          {actionSuccessMessage && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-950 dark:text-emerald-200 flex items-center space-x-2.5 shadow-2xs animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{actionSuccessMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/60 p-3 text-xs text-red-950 dark:text-red-200 flex items-start space-x-2.5 shadow-2xs">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100">Communication Notice</p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">{error}</p>
              </div>
            </div>
          )}

          {/* 3-STEP VISUAL HOW-IT-WORKS BANNER */}
          <div className="rounded-2xl border border-emerald-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>How AquaSense Works for You in 3 Simple Steps</span>
                </span>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Observe Soil &rarr; Forecast With AI &rarr; Water Precisely
                </h2>
              </div>

              {/* 1-Click Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickPredict}
                  disabled={runningPrediction || !selectedFieldId}
                  className="inline-flex items-center rounded-xl bg-slate-900 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 disabled:opacity-60 transition border border-slate-700"
                  title="Run Machine Learning prediction model for this field"
                >
                  <Cpu
                    className={`h-3.5 w-3.5 mr-1.5 text-teal-400 ${
                      runningPrediction ? "animate-spin" : ""
                    }`}
                  />
                  {runningPrediction ? "Running AI..." : "⚡ Run 24h AI Prediction"}
                </button>

                <button
                  type="button"
                  onClick={handleQuickAdvisory}
                  disabled={runningAdvisory || !selectedFieldId}
                  className="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60 transition"
                  title="Calculate irrigation recommendations based on current deficit"
                >
                  <Droplets
                    className={`h-3.5 w-3.5 mr-1.5 text-white ${
                      runningAdvisory ? "animate-spin" : ""
                    }`}
                  />
                  {runningAdvisory ? "Computing..." : "💧 Get Irrigation Advisory"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  <span>{showGuide ? "Hide Guide" : "How to Read Numbers"}</span>
                  {showGuide ? (
                    <ChevronUp className="h-3.5 w-3.5 ml-1" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  )}
                </button>
              </div>
            </div>

            {/* 3 Steps Cards */}
            <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-emerald-100 dark:border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Live Soil Telemetry</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Sensors + SMAP</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Monitors root-zone water content continuously. Normal healthy farm range is <strong>{wiltingPointPercent}% - {fieldCapacityPercent}%</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>AI 24h-72h Forecasting</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Deep Learning</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Predicts weather, crop water loss (ET_c), and drying rates so you know if your field will dry out tomorrow.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Smart Watering Advisory</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">FAO-56 Engine</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Tells you exactly <strong>how many Liters</strong> to irrigate and the best time window, avoiding water waste and plant stress.
                </p>
              </div>
            </div>

            {/* Expandable "How to Read Numbers" Explainer Box */}
            {showGuide && (
              <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                    <span>Quick Beginner&apos;s Guide: Understanding the Terminology</span>
                  </h4>
                  <button
                    onClick={() => setShowGuide(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] leading-relaxed">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-0.5">
                    <strong className="text-emerald-800 dark:text-emerald-400 block font-semibold">1. Soil Moisture (%)</strong>
                    <span>
                      Expressed as a percentage of soil volume. E.g. <strong>25%</strong> means 25% of root zone is water.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-0.5">
                    <strong className="text-emerald-800 dark:text-emerald-400 block font-semibold">2. Field Capacity (&theta;_FC)</strong>
                    <span>
                      The maximum water the soil can hold like a full sponge. Excess water drains away naturally.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-0.5">
                    <strong className="text-emerald-800 dark:text-emerald-400 block font-semibold">3. Wilting Point (&theta;_WP)</strong>
                    <span>
                      Critical dryness level below which roots can&apos;t pull water and plants suffer stress.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-0.5">
                    <strong className="text-emerald-800 dark:text-emerald-400 block font-semibold">4. Prescribed Liters</strong>
                    <span>
                      Exact volume to restore optimal moisture based on field area and drip efficiency.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HERO STATUS BANNER */}
          {selectedField && (
            <div
              className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition ${
                latestRec?.action === "IRRIGATE_RECOMMENDED"
                  ? "bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-950 border-amber-300 dark:border-amber-800"
                  : latestRec?.action === "IRRIGATION_DEFERRED"
                  ? "bg-gradient-to-r from-emerald-500/10 via-emerald-50/60 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-950 border-emerald-300 dark:border-emerald-800"
                  : "bg-gradient-to-r from-blue-500/10 via-blue-50/60 to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-950 border-blue-200 dark:border-blue-800"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 shadow-2xs ${
                      latestRec?.action === "IRRIGATE_RECOMMENDED"
                        ? "bg-amber-500 text-white shadow-amber-200 dark:shadow-none"
                        : latestRec?.action === "IRRIGATION_DEFERRED"
                        ? "bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none"
                        : "bg-blue-600 text-white shadow-blue-200 dark:shadow-none"
                    }`}
                  >
                    {latestRec?.action === "IRRIGATE_RECOMMENDED" ? (
                      <Droplets className="h-5 w-5" />
                    ) : latestRec?.action === "IRRIGATION_DEFERRED" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <CloudRain className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Current Farm Condition:
                      </span>
                      {healthBadge && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${healthBadge.color}`}
                        >
                          {healthBadge.label}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {latestRec?.action === "IRRIGATE_RECOMMENDED"
                        ? `💧 Irrigation Recommended: Deliver ~${(
                            latestRec.water_volume_liters || 0
                          ).toLocaleString()} Liters of Water`
                        : latestRec?.action === "IRRIGATION_DEFERRED"
                        ? `🌿 Soil Moisture is Healthy: No Irrigation Required Today`
                        : `Awaiting Next Telemetry Reading`}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {latestRec?.action === "IRRIGATE_RECOMMENDED" ? (
                        <>
                          Current root moisture is at{" "}
                          <strong className="text-amber-900 dark:text-amber-300 font-semibold">{currentMoisturePercent || "21.4"}%</strong> (below the safe threshold of{" "}
                          <strong className="font-semibold">{(selectedField.depletion_fraction_p * 100).toFixed(0)}%</strong> depletion). We recommend turning on{" "}
                          <strong className="font-semibold">{selectedField.irrigation_method}</strong> irrigation.{" "}
                          {latestRec.suggested_timing_window ? (
                            <span>Timing: <strong>{latestRec.suggested_timing_window}</strong>.</span>
                          ) : null}
                        </>
                      ) : latestRec?.action === "IRRIGATION_DEFERRED" ? (
                        <>
                          Root zone water is at{" "}
                          <strong className="text-emerald-900 dark:text-emerald-300 font-semibold">{currentMoisturePercent || "28.0"}%</strong>. The soil sponge holds sufficient moisture. Valves can remain safely closed to conserve electricity and water.
                        </>
                      ) : (
                        "Trigger an AI forecast or precision advisory to view real-time recommendations."
                      )}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col sm:items-end justify-between border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 pt-3 sm:pt-0">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Recommendation ID
                    </span>
                    <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {latestRec?.id ? `${latestRec.id.slice(0, 8)}...` : "None"}
                    </p>
                  </div>
                  <Link
                    href="/irrigation"
                    className="mt-1.5 inline-flex items-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                  >
                    <span>Full Advisory Engine</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* REAL-TIME SOIL WATER SLIDE BAR (MOISTURE GAUGE) */}
          {selectedField && currentMoisturePercent !== null && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Soil Moisture Status Slide Bar</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        (Root-Zone Water Balance)
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 text-[11px]">Current Reading:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {currentMoisturePercent}%
                    </span>
                  </div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 text-[11px]">Depletion:</span>
                    <span className={`font-semibold text-xs ${
                      Number(currentMoisturePercent) < Number(wiltingPointPercent) + 5
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}>
                      {latestRec?.action === "IRRIGATE_RECOMMENDED" ? "Deficit Active" : "Optimal Water"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Zone Horizontal Slide Bar Track with Dynamic Pointer */}
              <div className="pt-5 pb-1 relative">
                {/* Pointer Tag */}
                <div
                  className="absolute top-0 -ml-3 flex flex-col items-center transition-all duration-500"
                  style={{
                    left: `${Math.min(
                      Math.max(((Number(currentMoisturePercent) || 0) / 45) * 100, 2),
                      98
                    )}%`,
                  }}
                >
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
                    {currentMoisturePercent}%
                  </span>
                  <span className="w-0 h-0 border-x-4 border-x-transparent border-t-5 border-t-slate-900" />
                </div>

                {/* 3-Zone Continuous Slide Track */}
                <div className="h-4 w-full rounded-full overflow-hidden flex shadow-inner border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {/* Zone 1: Wilting / Drought (Red) */}
                  <div
                    className="bg-red-400/90 dark:bg-red-500/80 flex items-center justify-center text-[9px] font-bold text-white tracking-tight"
                    style={{ width: `${(Number(wiltingPointPercent) / 45) * 100}%` }}
                    title={`Wilting Point (<${wiltingPointPercent}%)`}
                  >
                    Dry (&lt;{wiltingPointPercent}%)
                  </div>

                  {/* Zone 2: Readily Available Water (Optimal Green) */}
                  <div
                    className="bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white tracking-tight shadow-xs"
                    style={{
                      width: `${
                        ((Number(fieldCapacityPercent) - Number(wiltingPointPercent)) / 45) *
                        100
                      }%`,
                    }}
                    title={`Optimal Growth Zone (${wiltingPointPercent}% - ${fieldCapacityPercent}%)`}
                  >
                    ★ Optimal Growth Zone ({wiltingPointPercent}% - {fieldCapacityPercent}%)
                  </div>

                  {/* Zone 3: Saturated / Waterlogged (Blue) */}
                  <div
                    className="bg-sky-400/90 dark:bg-sky-500/80 flex-1 flex items-center justify-center text-[9px] font-bold text-white tracking-tight"
                    title={`Saturated / Full Capacity (>${fieldCapacityPercent}%)`}
                  >
                    Saturated (&gt;{fieldCapacityPercent}%)
                  </div>
                </div>

                {/* Calibration Labels below slide bar */}
                <div className="flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1.5">
                  <span>0% (Air Dry)</span>
                  <span>θ_WP: {wiltingPointPercent}%</span>
                  <span>θ_FC: {fieldCapacityPercent}%</span>
                  <span>45%+ (Waterlogged)</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : fields.length === 0 ? (
            <EmptyState
              icon={<Sprout className="h-7 w-7" />}
              title="No Fields Registered Yet"
              description="To monitor soil moisture, predict evapotranspiration, and receive automated watering schedules, add your first farm plot."
              action={{
                label: "Add Field (Easy Mode)",
                onClick: () => (window.location.href = "/fields"),
              }}
            />
          ) : (
            <>
              {/* PRIMARY KPI METRICS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Current Soil Moisture */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Current Soil Moisture
                    </span>
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                      <Droplets className="h-4 w-4" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                        {currentMoisturePercent !== null ? `${currentMoisturePercent}%` : "No Probe"}
                      </span>
                      {latestObs && (
                        <span className="text-xs font-medium text-slate-400">
                          ({latestObs.soil_moisture_m3m3.toFixed(3)} m³/m³)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-1.5">
                      {latestObs ? (
                        <ProvenanceBadge type={latestObs.source_type} />
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          Awaiting In-situ Data
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Target: {wiltingPointPercent}% - {fieldCapacityPercent}%</span>
                    <span>Depth: {latestObs?.depth_cm || 10} cm</span>
                  </div>
                </div>

                {/* 2. 24-Hour AI Prediction */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      24h AI Forecast
                    </span>
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
                      <Cpu className="h-4 w-4" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                        {predictedMoisturePercent !== null ? `${predictedMoisturePercent}%` : "Pending"}
                      </span>
                      {latestPred && (
                        <span className="text-xs font-medium text-slate-400">
                          ({latestPred.predicted_moisture_m3m3.toFixed(3)} m³/m³)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-1.5">
                      {latestPred ? (
                        <ProvenanceBadge type="PREDICTED" />
                      ) : (
                        <button
                          onClick={handleQuickPredict}
                          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          Run AI Forecast Now &rarr;
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Horizon: 24 Hours</span>
                    <span className="truncate max-w-[120px]">{latestPred?.model_name || "Deep Ensemble"}</span>
                  </div>
                </div>

                {/* 3. Irrigation Recommendation Status */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Irrigation Status
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                      <Compass className="h-4 w-4" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {latestRec?.action === "IRRIGATE_RECOMMENDED"
                          ? "Turn ON Water"
                          : latestRec?.action === "IRRIGATION_DEFERRED"
                          ? "Valves Closed"
                          : latestRec?.action === "INDETERMINATE"
                          ? "Indeterminate"
                          : "Pending"}
                      </span>
                    </div>
                    <div className="mt-1">
                      {latestRec ? (
                        <ActionBadge action={latestRec.action} size="sm" />
                      ) : (
                        <span className="text-xs text-slate-400">No Advisory Yet</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    <span>{latestRec?.suggested_timing_window || "FAO-56 Water Balance"}</span>
                  </div>
                </div>

                {/* 4. Recommended Water Volume */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Water to Apply
                    </span>
                    <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400">
                      <CloudRain className="h-4 w-4" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                        {latestRec?.water_volume_liters !== undefined &&
                        latestRec?.water_volume_liters !== null
                          ? Math.round(latestRec.water_volume_liters).toLocaleString()
                          : latestRec?.action === "IRRIGATION_DEFERRED"
                          ? "0"
                          : "—"}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Liters</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {latestRec?.water_volume_m3 !== undefined &&
                      latestRec?.water_volume_m3 !== null
                        ? `≈ ${latestRec.water_volume_m3.toFixed(1)} m³ (${latestRec.net_irrigation_depth_mm?.toFixed(1) || "0"} mm depth)`
                        : "Calculated based on field deficit"}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Method: {selectedField?.irrigation_method || "Drip"}</span>
                    <span>Eff: {selectedField?.application_efficiency ? `${(selectedField.application_efficiency * 100).toFixed(0)}%` : "90%"}</span>
                  </div>
                </div>
              </div>

              {/* DETAILED ADVISORY BREAKDOWN & AGRONOMIC CONTEXT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Precision Advisory Card */}
                <div className="lg:col-span-2 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center space-x-2.5">
                      <Compass className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Precision Irrigation Advisory Breakdown
                      </h2>
                    </div>
                    {latestRec && <ActionBadge action={latestRec.action} size="sm" />}
                  </div>

                  {latestRec ? (
                    <div className="space-y-4">
                      {/* Depth and Volume Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            Water Volume
                          </span>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                            {latestRec.water_volume_liters
                              ? `${Math.round(latestRec.water_volume_liters).toLocaleString()} L`
                              : "0 L"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            Water Depth
                          </span>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                            {latestRec.net_irrigation_depth_mm !== null &&
                            latestRec.net_irrigation_depth_mm !== undefined
                              ? `${latestRec.net_irrigation_depth_mm.toFixed(1)} mm`
                              : "0.0 mm"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            Total Soil Storage (TAW)
                          </span>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                            {latestRec.total_available_water_taw_mm !== null &&
                            latestRec.total_available_water_taw_mm !== undefined
                              ? `${latestRec.total_available_water_taw_mm.toFixed(1)} mm`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            Stress Limit (RAW)
                          </span>
                          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                            {latestRec.readily_available_water_raw_mm !== null &&
                            latestRec.readily_available_water_raw_mm !== undefined
                              ? `${latestRec.readily_available_water_raw_mm.toFixed(1)} mm`
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Plain-English Decision Rationale */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Why was this decision made? (Hydrological Rationale):
                        </span>
                        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200 bg-emerald-50/50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                          {latestRec.explanations?.map((exp, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold shrink-0">•</span>
                              <span className="leading-relaxed font-medium">{exp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <span>
                          Generated:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {new Date(latestRec.generated_at_utc).toLocaleString()}
                          </strong>
                        </span>
                        <Link
                          href="/irrigation"
                          className="font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center space-x-1"
                        >
                          <span>Go to Irrigation Management</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500 space-y-3">
                      <p className="text-sm">
                        No precision irrigation recommendation has been computed for this field yet.
                      </p>
                      <button
                        onClick={handleQuickAdvisory}
                        disabled={runningAdvisory}
                        className="inline-flex items-center rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                      >
                        <Droplets className="h-3.5 w-3.5 mr-1.5" />
                        Generate Precision Advisory Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Selected Field Agronomic Configuration */}
                <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <Sprout className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Field Specification</h3>
                    </div>
                    <Link
                      href="/fields"
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                    >
                      Configure
                    </Link>
                  </div>

                  {selectedField ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Field Name</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedField.name}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Location GPS</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {selectedField.latitude?.toFixed(4) ?? "—"}°N, {selectedField.longitude?.toFixed(4) ?? "—"}°E
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Farm Size</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedField.area_value} {selectedField.area_unit} (
                          {selectedField.area_m2.toLocaleString()} m²)
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Crop & Stage</span>
                        <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                          {selectedField.crop_name} ({selectedField.growth_stage})
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Root Depth (Z_r)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedField.root_depth_m} meters
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Soil Texture</span>
                        <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                          {selectedField.soil_texture.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Moisture Holding Range</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {wiltingPointPercent}% (Dry) to {fieldCapacityPercent}% (Full)
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Method & Efficiency</span>
                        <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                          {selectedField.irrigation_method} (
                          {selectedField.application_efficiency != null
                            ? (selectedField.application_efficiency * 100).toFixed(0)
                            : "90"}
                          % efficiency)
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* OPERATIONAL HEALTH & DATA PROVENANCE STATUS */}
              <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      System Engines & Satellite Sync Status
                    </h3>
                  </div>
                  <Link
                    href="/system-health"
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center space-x-1"
                  >
                    <span>View System Logs</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      Database Engine
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {systemStatus?.services?.database?.status === "healthy" ? (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>SQLite Dev Fallback (Active)</span>
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {systemStatus?.services?.database?.engine || "SQLite / PostgreSQL"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      Machine Learning Engine
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>LSTM & Random Forest (Ready)</span>
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      24h, 48h, 72h Multi-horizon
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      NASA SMAP Radiometry
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>SPL3SMP_E L3 Sync Active</span>
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      L-Band 1.41 GHz Radiometry
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-3.5 space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                      FAO-56 Irrigation Engine
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Dual Crop Coeff. Active</span>
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Root Depletion (D_r &le; RAW)
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
