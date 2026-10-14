"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Compass,
  Droplets,
  HelpCircle,
  Play,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sprout,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Field, IrrigationRecommendation, IrrigationTriggerPayload } from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ActionBadge } from "@/components/ui/action-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

export default function IrrigationAdvisoryPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [recommendations, setRecommendations] = useState<IrrigationRecommendation[]>([]);
  const [currentRec, setCurrentRec] = useState<IrrigationRecommendation | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Trigger Modal
  const [isTriggerOpen, setIsTriggerOpen] = useState<boolean>(false);
  const [triggerPayload, setTriggerPayload] = useState<IrrigationTriggerPayload>({
    forecast_rainfall_next_24h_mm: 0.0,
    forecast_rain_probability_pct: 10.0,
    forecast_et0_next_24h_mm: 3.5,
  });
  const [triggerSubmitting, setTriggerSubmitting] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const loadData = async (targetFieldId?: string) => {
    setError(null);
    try {
      const fieldList = await api.getFields();
      setFields(fieldList);

      const activeId =
        targetFieldId ||
        selectedFieldId ||
        (fieldList.length > 0 ? fieldList[0].id : "");

      if (activeId) {
        setSelectedFieldId(activeId);
        const recList = await api.getFieldRecommendations(activeId, 20);
        setRecommendations(recList);
        setCurrentRec(recList.length > 0 ? recList[0] : null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load irrigation recommendations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldChange = (newId: string) => {
    setSelectedFieldId(newId);
    setLoading(true);
    loadData(newId);
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldId) return;
    setTriggerSubmitting(true);
    setTriggerError(null);

    try {
      const newRec = await api.triggerRecommendation(selectedFieldId, triggerPayload);
      setCurrentRec(newRec);
      setIsTriggerOpen(false);
      await loadData(selectedFieldId);
    } catch (err: any) {
      setTriggerError(err.message || "Failed to trigger decision engine advisory.");
    } finally {
      setTriggerSubmitting(false);
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Precision Irrigation Advisory Engine
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Physics-informed FAO-56 water-balance model integrating 24h soil moisture forecasts and rainfall predictions
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {fields.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-600 uppercase">Field:</span>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setTriggerError(null);
                  setIsTriggerOpen(true);
                }}
                disabled={!selectedFieldId}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                <Play className="h-4 w-4 mr-1.5 fill-current" />
                Run Decision Engine
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadData();
                }}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition"
                title="Refresh recommendations"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Plain-English Explainer for Irrigation Advisory */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white p-4 shadow-xs">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-700 shrink-0">
                <Compass className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h3 className="font-bold text-slate-900">
                  How the Precision Irrigation Engine Saves Water & Energy
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Click <strong>&quot;Run Decision Engine&quot;</strong> to compute an instant water balance. The FAO-56 dual crop model monitors soil moisture vs. root depletion.
                  If rain is incoming (5 mm or more), watering is <strong>deferred automatically</strong> so you don&apos;t waste water or drown crops!
                </p>
                <div className="pt-1 flex flex-wrap gap-4 text-[11px] text-emerald-950 font-semibold">
                  <span>💧 IRRIGATE: Water needed to reach field capacity</span>
                  <span>🌿 DEFERRED: Soil has plenty of moisture, valves remain shut</span>
                  <span>🌧️ RAIN AVOIDANCE: Natural rain will irrigate your plot for free</span>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : fields.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-7 w-7" />}
              title="No Fields Found"
              description="Register an agricultural field to evaluate root-zone depletion and compute FAO-56 irrigation schedules."
              action={{
                label: "Create Field",
                onClick: () => (window.location.href = "/fields"),
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Active Recommendation Card */}
              {currentRec ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                  {/* Banner Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center space-x-3">
                        <ActionBadge action={currentRec.action} size="lg" />
                        <span className="text-xs text-slate-500 font-mono">
                          ID: {(currentRec.recommendation_id || currentRec.id)?.slice(0, 12)}...
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Evaluation Timestamp:{" "}
                        <strong className="text-slate-800 font-medium">
                          {new Date(currentRec.generated_at_utc).toLocaleString()} (UTC)
                        </strong>
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-right">
                      <span className="text-[11px] font-semibold uppercase text-slate-500 block">
                        Timing Window
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {currentRec.suggested_timing_window || "Immediate / Next Window"}
                      </span>
                    </div>
                  </div>

                  {/* Water Depth and Volumes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-slate-50 border border-emerald-200">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-500">
                        Net Depth (d_net)
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-0.5">
                        {currentRec.net_irrigation_depth_mm !== null &&
                        currentRec.net_irrigation_depth_mm !== undefined
                          ? `${currentRec.net_irrigation_depth_mm.toFixed(1)} mm`
                          : "0.0 mm"}
                      </p>
                      <span className="text-[10px] text-slate-500">Root-zone replacement</span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-500">
                        Gross Depth (d_gross)
                      </span>
                      <p className="text-2xl font-black text-emerald-800 mt-0.5">
                        {currentRec.gross_irrigation_depth_mm !== null &&
                        currentRec.gross_irrigation_depth_mm !== undefined
                          ? `${currentRec.gross_irrigation_depth_mm.toFixed(1)} mm`
                          : "0.0 mm"}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Adjusted for {selectedField ? (selectedField.application_efficiency * 100).toFixed(0) : "90"}% efficiency
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-500">
                        Water Volume (m³)
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-0.5">
                        {currentRec.water_volume_m3 !== null &&
                        currentRec.water_volume_m3 !== undefined
                          ? `${currentRec.water_volume_m3.toFixed(1)} m³`
                          : "0.0 m³"}
                      </p>
                      <span className="text-[10px] text-slate-500">Over {selectedField?.area_value} {selectedField?.area_unit}</span>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-500">
                        Volume (Liters)
                      </span>
                      <p className="text-2xl font-black text-slate-900 mt-0.5">
                        {currentRec.water_volume_liters !== null &&
                        currentRec.water_volume_liters !== undefined
                          ? `${Math.round(currentRec.water_volume_liters).toLocaleString()} L`
                          : "0 L"}
                      </p>
                      <span className="text-[10px] text-slate-500">Volumetric delivery</span>
                    </div>
                  </div>

                  {/* FAO-56 Hydraulic State Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      FAO-56 Soil Water Balance State
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] text-slate-500">Total Available (TAW)</span>
                        <p className="font-bold text-slate-900 mt-0.5">
                          {currentRec.total_available_water_taw_mm !== null &&
                          currentRec.total_available_water_taw_mm !== undefined
                            ? `${currentRec.total_available_water_taw_mm.toFixed(1)} mm`
                            : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400">1000 · (θ_FC - θ_WP) · Zr</span>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] text-slate-500">Readily Available (RAW)</span>
                        <p className="font-bold text-slate-900 mt-0.5">
                          {currentRec.readily_available_water_raw_mm !== null &&
                          currentRec.readily_available_water_raw_mm !== undefined
                            ? `${currentRec.readily_available_water_raw_mm.toFixed(1)} mm`
                            : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400">p · TAW (No plant stress)</span>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] text-slate-500">Current Depletion (Dr)</span>
                        <p className="font-bold text-slate-900 mt-0.5">
                          {currentRec.current_depletion_dr_mm !== null &&
                          currentRec.current_depletion_dr_mm !== undefined
                            ? `${currentRec.current_depletion_dr_mm.toFixed(1)} mm`
                            : "N/A"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {currentRec.current_depletion_dr_mm &&
                          currentRec.readily_available_water_raw_mm &&
                          currentRec.current_depletion_dr_mm > currentRec.readily_available_water_raw_mm
                            ? "Dr > RAW (Water Deficit)"
                            : "Dr ≤ RAW (Adequate Moisture)"}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] text-slate-500">Effective Rainfall (P_eff)</span>
                        <p className="font-bold text-slate-900 mt-0.5">
                          {currentRec.effective_rainfall_considered_mm != null
                            ? `${currentRec.effective_rainfall_considered_mm.toFixed(1)} mm`
                            : "0.0 mm"}
                        </p>
                        <span className="text-[10px] text-slate-400">Subtracted from water demand</span>
                      </div>
                    </div>
                  </div>

                  {/* Scientific Explanations */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Step-by-Step Decision Logic (Explanations):
                    </span>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2 text-xs text-slate-800">
                      {currentRec.explanations?.map((exp, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{exp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warnings (if any) */}
                  {currentRec.warnings && currentRec.warnings.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        Operational Warnings:
                      </span>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5 text-xs text-amber-900">
                        {currentRec.warnings.map((warn, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Baseline Comparison Card */}
                  {currentRec.baseline_comparison && (
                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Scale className="h-5 w-5 text-emerald-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Baseline Comparison: Precision vs Conventional Fixed Schedule
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Conventional Depth</span>
                          <p className="font-bold text-slate-900 text-sm">
                            {currentRec.baseline_comparison.conventional_depth_mm?.toFixed(1) ?? "0.0"} mm
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Precision Depth</span>
                          <p className="font-bold text-emerald-800 text-sm">
                            {currentRec.baseline_comparison.precision_depth_mm?.toFixed(1) ?? "0.0"} mm
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Water Conserved</span>
                          <p className="font-bold text-emerald-700 text-sm">
                            {currentRec.baseline_comparison.water_savings_depth_mm?.toFixed(1) ?? "0.0"} mm (
                            {currentRec.baseline_comparison.water_savings_pct?.toFixed(0) ?? "0"}%)
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Model Rationale</span>
                          <p className="text-[11px] text-slate-600 leading-tight">
                            {currentRec.baseline_comparison.rationale}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                        <Link
                          href="/evaluation"
                          className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition"
                        >
                          <span>Open Full Research Evaluation & Multi-Event Simulation →</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<Compass className="h-7 w-7" />}
                  title="No Recommendation Recorded"
                  description="Click 'Run Decision Engine' above to compute a precision irrigation schedule for this field."
                  action={{
                    label: "Run Decision Engine",
                    onClick: () => setIsTriggerOpen(true),
                  }}
                />
              )}

              {/* Historical Recommendations Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Advisory Execution History ({recommendations.length})
                </h3>

                {recommendations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No prior advisories logged for this field.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Generated (UTC)</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Net Depth</th>
                          <th className="py-2.5 px-3">Gross Depth</th>
                          <th className="py-2.5 px-3">Volume (m³)</th>
                          <th className="py-2.5 px-3">Volume (Liters)</th>
                          <th className="py-2.5 px-3">Timing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recommendations.map((r) => (
                          <tr
                            key={r.id || r.recommendation_id}
                            onClick={() => setCurrentRec(r)}
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >
                            <td className="py-2.5 px-3 font-mono">
                              {new Date(r.generated_at_utc).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <ActionBadge action={r.action} size="sm" />
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {r.net_irrigation_depth_mm !== null &&
                              r.net_irrigation_depth_mm !== undefined
                                ? `${r.net_irrigation_depth_mm.toFixed(1)} mm`
                                : "0.0 mm"}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-800">
                              {r.gross_irrigation_depth_mm !== null &&
                              r.gross_irrigation_depth_mm !== undefined
                                ? `${r.gross_irrigation_depth_mm.toFixed(1)} mm`
                                : "0.0 mm"}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.water_volume_m3 !== null && r.water_volume_m3 !== undefined
                                ? `${r.water_volume_m3.toFixed(1)} m³`
                                : "0.0 m³"}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.water_volume_liters !== null &&
                              r.water_volume_liters !== undefined
                                ? `${Math.round(r.water_volume_liters).toLocaleString()} L`
                                : "0 L"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                              {r.suggested_timing_window || "Standard"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RUN DECISION ENGINE MODAL */}
          {isTriggerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Run Precision Decision Engine
                  </h2>
                  <button
                    onClick={() => setIsTriggerOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {triggerError && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                    {triggerError}
                  </div>
                )}

                <form onSubmit={handleTriggerSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Soil Moisture Override (Optional m³/m³)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.0"
                      max="1.0"
                      placeholder="Leave blank to use latest field observation"
                      value={triggerPayload.soil_moisture_m3m3 ?? ""}
                      onChange={(e) =>
                        setTriggerPayload({
                          ...triggerPayload,
                          soil_moisture_m3m3:
                            e.target.value === "" ? null : parseFloat(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">
                      If omitted, automatically uses latest sensor observation or default FC/WP midpoint.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700">
                        24h Forecast Rain (mm)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="150"
                        value={triggerPayload.forecast_rainfall_next_24h_mm ?? 0}
                        onChange={(e) =>
                          setTriggerPayload({
                            ...triggerPayload,
                            forecast_rainfall_next_24h_mm: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700">
                        Rain Probability (%)
                      </label>
                      <input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        value={triggerPayload.forecast_rain_probability_pct ?? 10}
                        onChange={(e) =>
                          setTriggerPayload({
                            ...triggerPayload,
                            forecast_rain_probability_pct: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">
                      24h Forecast Reference ET0 (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="15.0"
                      value={triggerPayload.forecast_et0_next_24h_mm ?? 3.5}
                      onChange={(e) =>
                        setTriggerPayload({
                          ...triggerPayload,
                          forecast_et0_next_24h_mm: parseFloat(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsTriggerOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={triggerSubmitting}
                      className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {triggerSubmitting ? "Calculating..." : "Compute Advisory"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
