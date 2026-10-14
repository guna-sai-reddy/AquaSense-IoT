"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { Field, ModelMetricsResponse, Prediction } from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

export default function PredictionsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetricsResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const loadData = async (targetFieldId?: string) => {
    setError(null);
    try {
      const [fieldList, metrics] = await Promise.all([
        api.getFields(),
        api.getModelMetrics().catch(() => null),
      ]);
      setFields(fieldList);
      setModelMetrics(metrics);

      const activeId =
        targetFieldId ||
        selectedFieldId ||
        (fieldList.length > 0 ? fieldList[0].id : "");

      if (activeId) {
        setSelectedFieldId(activeId);
        const preds = await api.getFieldPredictions(activeId, 50);
        setPredictions(preds);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load prediction history.");
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

  const handleTriggerPrediction = async () => {
    if (!selectedFieldId) return;
    setTriggering(true);
    setTriggerError(null);

    try {
      await api.triggerPrediction(selectedFieldId);
      await loadData(selectedFieldId);
    } catch (err: any) {
      setTriggerError(err.message || "Failed to execute ML inference pipeline.");
    } finally {
      setTriggering(false);
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
                Machine Learning Prediction History
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Trained Random Forest 24-hour root-zone soil moisture forecasts (7–28 cm depth)
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
                onClick={handleTriggerPrediction}
                disabled={triggering || !selectedFieldId}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                <Cpu className={`h-4 w-4 mr-1.5 ${triggering ? "animate-spin" : ""}`} />
                {triggering ? "Forecasting..." : "Forecast Next 24h"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadData();
                }}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition"
                title="Refresh predictions"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Trigger Error Banner */}
          {triggerError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Inference Execution Error</p>
                <p className="mt-0.5">{triggerError}</p>
              </div>
            </div>
          )}

          {/* User-Friendly Guide to Prediction & Analysis */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white p-4 shadow-xs">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-purple-600/10 text-purple-700 shrink-0">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h3 className="font-bold text-slate-900">
                  How Soil Moisture AI Prediction Works
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Click <strong>&quot;Forecast Next 24h&quot;</strong> to run the Machine Learning model. The AI analyzes weather forecasts (solar heat, wind speed, relative humidity) and crop water usage to calculate how fast your soil will dry out over the coming hours.
                </p>
                <div className="pt-1 flex flex-wrap gap-3 text-[11px] text-purple-900 font-medium">
                  <span>📉 Negative change: Soil drying out due to sun/wind.</span>
                  <span>📈 Positive change: Moisture rising from rain or irrigation.</span>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <CardSkeleton />
          ) : fields.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-7 w-7" />}
              title="No Fields Registered"
              description="Configure an agricultural field to generate 24-hour predictive forecasts."
              action={{
                label: "Create Field",
                onClick: () => (window.location.href = "/fields"),
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Latest Forecast Card */}
              {predictions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <BrainCircuit className="h-5 w-5 text-emerald-700" />
                      <h3 className="text-sm font-bold text-slate-900">Latest 24-Hour ML Forecast</h3>
                    </div>
                    <ProvenanceBadge type={predictions[0].input_provenance} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">
                        Current Moisture
                      </span>
                      <p className="text-xl font-bold text-slate-900 mt-0.5">
                        {predictions[0]?.current_moisture_m3m3 != null
                          ? `${(predictions[0].current_moisture_m3m3 * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {predictions[0]?.current_moisture_m3m3?.toFixed(3)} m³/m³
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">
                        Predicted (+24h)
                      </span>
                      <p className="text-xl font-bold text-emerald-800 mt-0.5">
                        {predictions[0]?.predicted_moisture_m3m3 != null
                          ? `${(predictions[0].predicted_moisture_m3m3 * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {predictions[0]?.predicted_moisture_m3m3?.toFixed(3)} m³/m³
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">
                        Projected Change
                      </span>
                      <p
                        className={`text-xl font-bold mt-0.5 flex items-center space-x-1 ${
                          (predictions[0]?.projected_change_m3m3 ?? 0) < 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {(predictions[0]?.projected_change_m3m3 ?? 0) < 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                        <span>
                          {(predictions[0]?.projected_change_m3m3 ?? 0) > 0 ? "+" : ""}
                          {predictions[0]?.projected_change_m3m3 != null
                            ? `${predictions[0].projected_change_m3m3.toFixed(3)} m³/m³`
                            : "—"}
                        </span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">
                        Target Stratum
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {predictions[0].target_depth}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Horizon: {predictions[0].horizon_hours}h | Model: {predictions[0].model_name}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Table of Past Predictions */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Chronological ML Prediction Log ({predictions.length})
                </h3>

                {predictions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <p className="text-sm">No predictions logged for this field yet.</p>
                    <p className="text-xs text-slate-500">
                      Click &quot;Forecast Next 24h&quot; above to execute the trained model.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Prediction Time (UTC)</th>
                          <th className="py-2.5 px-3">Target Time (+24h)</th>
                          <th className="py-2.5 px-3">Current Moisture</th>
                          <th className="py-2.5 px-3">Predicted Moisture</th>
                          <th className="py-2.5 px-3">Change</th>
                          <th className="py-2.5 px-3">Model</th>
                          <th className="py-2.5 px-3">Provenance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {predictions.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono">
                              {new Date(p.prediction_timestamp_utc).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {new Date(p.target_timestamp_utc).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {p.current_moisture_m3m3?.toFixed(3) ?? "—"} m³/m³
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-800">
                              {p.predicted_moisture_m3m3?.toFixed(3) ?? "—"} m³/m³
                            </td>
                            <td
                              className={`py-2.5 px-3 font-semibold ${
                                (p.projected_change_m3m3 ?? 0) < 0 ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              {(p.projected_change_m3m3 ?? 0) > 0 ? "+" : ""}
                              {p.projected_change_m3m3?.toFixed(3) ?? "—"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{p.model_name}</td>
                            <td className="py-2.5 px-3">
                              <ProvenanceBadge type={p.input_provenance} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* VERIFIED MODEL EVALUATION BENCHMARKS (REQ-06 & REQ-13) */}
              {modelMetrics && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          Verified Model Generalization & Chronological Benchmarks
                        </h3>
                        <p className="text-xs text-slate-500">
                          Evaluated on held-out chronological test dataset ({modelMetrics.sample_counts.test_samples} test samples, 24h horizon)
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Active: {modelMetrics.selected_best_model}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Model Candidate</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Test MAE (m³/m³)</th>
                          <th className="py-2.5 px-3">Test RMSE (m³/m³)</th>
                          <th className="py-2.5 px-3">Test R² Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(modelMetrics.evaluation_metrics.test).map(
                          ([modelName, metrics]) => (
                            <tr
                              key={modelName}
                              className={
                                modelName === modelMetrics.selected_best_model
                                  ? "bg-emerald-50/50 font-semibold"
                                  : "hover:bg-slate-50 transition"
                              }
                            >
                              <td className="py-2.5 px-3 text-slate-900">{modelName}</td>
                              <td className="py-2.5 px-3">
                                {modelName === modelMetrics.selected_best_model ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700 text-white">
                                    SELECTED_BEST
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                                    BENCHMARK
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{metrics.mae.toFixed(6)}</td>
                              <td className="py-2.5 px-3 font-mono">{metrics.rmse.toFixed(6)}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {metrics.r2.toFixed(3)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Point Forecast Uncertainty Notice (REQ-6.3) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-1">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                      Point Forecast Uncertainty Notice:
                    </span>
                    <p className="leading-relaxed text-[11px] text-slate-600">
                      Displayed values represent deterministic point forecasts for the 24-hour horizon.
                      Probabilistic uncertainty intervals or confidence bounds are omitted because multi-year
                      cross-seasonal calibration is pending. In accordance with precision irrigation research standards,
                      point forecasts must be corroborated with live in-situ telemetry.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
