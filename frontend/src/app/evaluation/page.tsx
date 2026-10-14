"use client";

import React, { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api, ApiError } from "@/lib/api";
import {
  ComparativeEvaluationReport,
  Field,
  IrrigationEvent,
  IrrigationEventCreatePayload,
} from "@/lib/types";
import {
  BarChart3,
  CheckCircle2,
  Calendar,
  CloudRain,
  Compass,
  Droplets,
  HelpCircle,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileText,
  Clock,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

export default function EvaluationPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <EvaluationContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function EvaluationContent() {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [report, setReport] = useState<ComparativeEvaluationReport | null>(null);
  const [events, setEvents] = useState<IrrigationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-Irrigation Log Modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [eventPayload, setEventPayload] = useState<IrrigationEventCreatePayload>({
    actual_volume_m3: 150.0,
    actual_depth_mm: 6.0,
    irrigation_method: "drip",
    execution_status: "COMPLETED",
    operator_notes: "Regular scheduled precision drip block cycle.",
  });

  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const handleDownloadCsv = async () => {
    if (!selectedFieldId) return;
    setDownloadingCsv(true);
    try {
      const blob = await api.downloadEvaluationCsv(selectedFieldId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquasense_evaluation_${selectedFieldId.substring(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download evaluation CSV.");
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Load fields
  useEffect(() => {
    let isMounted = true;
    async function loadFields() {
      try {
        const fieldList = await api.getFields();
        if (isMounted) {
          setFields(fieldList);
          if (fieldList.length > 0) {
            setSelectedFieldId(fieldList[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load agricultural fields.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFields();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Evaluation Report & Events whenever selectedFieldId changes
  useEffect(() => {
    if (!selectedFieldId) return;
    let isMounted = true;

    async function loadEvaluation() {
      setEvaluating(true);
      setError(null);
      try {
        const [evalReport, eventList] = await Promise.all([
          api.getFieldEvaluation(selectedFieldId),
          api.listIrrigationEvents(selectedFieldId),
        ]);
        if (isMounted) {
          setReport(evalReport);
          setEvents(eventList);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            err.message ||
              "Could not calculate baseline comparison. Please ensure weather records exist."
          );
        }
      } finally {
        if (isMounted) setEvaluating(false);
      }
    }

    loadEvaluation();
    return () => {
      isMounted = false;
    };
  }, [selectedFieldId]);

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const handleLogEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldId) return;
    setEventSubmitting(true);
    setEventFormError(null);
    try {
      const created = await api.logIrrigationEvent(selectedFieldId, eventPayload);
      setEvents((prev) => [created, ...prev]);
      setIsEventModalOpen(false);
      // Reset form defaults
      setEventPayload({
        actual_volume_m3: 150.0,
        actual_depth_mm: 6.0,
        irrigation_method: selectedField?.irrigation_method || "drip",
        execution_status: "COMPLETED",
        operator_notes: "",
      });
    } catch (err: any) {
      setEventFormError(err.message || "Failed to log irrigation event.");
    } finally {
      setEventSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Field Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Research Evaluation & Baseline Benchmarking
            </h1>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 font-semibold">
              FAO-56 vs Conventional
            </span>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            Empirical comparison between the AquaSense-IoT predictive scheduler and a conventional
            static Management Allowed Depletion (MAD) threshold baseline.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {fields.length > 0 && (
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-slate-600">Field:</span>
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.crop_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv || !report}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 transition shadow-sm disabled:opacity-50"
            title="Download full time-series benchmark dataset as CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{downloadingCsv ? "Exporting..." : "Export Research CSV"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEventModalOpen(true)}
            className="flex items-center space-x-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Executed Event</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {evaluating && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            Simulating conventional vs predictive water balance...
          </p>
          <span className="text-xs text-slate-400">
            Applying chronological meteorological inputs and soil hydraulic parameters
          </span>
        </div>
      )}

      {!evaluating && report && (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Water Conserved */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase">
                <span>Total Water Conserved</span>
                <TrendingDown className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="text-2xl font-black text-emerald-950">
                {report.water_savings_volume_m3.toLocaleString()} m³
              </p>
              <div className="flex items-center justify-between text-xs text-emerald-800 pt-1 border-t border-emerald-200/60">
                <span>{report.water_savings_depth_mm.toFixed(1)} mm depth</span>
                <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  {report.water_savings_pct.toFixed(1)}% Reduction
                </span>
              </div>
            </div>

            {/* 2. Irrigation Frequency */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase">
                <span>Irrigation Frequency</span>
                <Calendar className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                {report.predictive_events_per_week.toFixed(1)}{" "}
                <span className="text-xs font-normal text-slate-500">events / week</span>
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>Baseline: {report.conventional_events_per_week.toFixed(1)}/wk</span>
                <span className="font-semibold text-slate-700">
                  Δ {report.conventional_event_count - report.predictive_event_count} events
                </span>
              </div>
            </div>

            {/* 3. Target Moisture Deviation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase">
                <span>Target Band Deviation</span>
                <Scale className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                {report.mean_target_deviation_m3m3.toFixed(4)}{" "}
                <span className="text-xs font-normal text-slate-500">m³/m³</span>
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>Stress: {report.predictive_stress_hours}h</span>
                <span className="font-semibold text-slate-700">
                  Base: {report.conventional_stress_hours}h
                </span>
              </div>
            </div>

            {/* 4. Water Productivity Indicator */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase">
                <span>Water Application Rate</span>
                <Droplets className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                {report.irrigation_water_productivity_m3_per_ha.toFixed(1)}{" "}
                <span className="text-xs font-normal text-slate-500">m³/ha</span>
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>Field Area: {report.field_area_ha} ha</span>
                <span className="text-[11px] text-amber-700 font-semibold truncate max-w-[120px]">
                  Yield: Pending
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Comparative Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conventional Scheduler Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-slate-500" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Conventional Baseline: Static MAD Threshold
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                  Fixed Dr ≥ RAW
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 text-[11px]">Gross Depth</span>
                  <p className="font-bold text-slate-900 text-base mt-0.5">
                    {report.conventional_total_depth_mm.toFixed(1)} mm
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 text-[11px]">Applied Volume</span>
                  <p className="font-bold text-slate-900 text-base mt-0.5">
                    {report.conventional_total_volume_m3.toLocaleString()} m³
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 text-[11px]">Total Events</span>
                  <p className="font-bold text-slate-900 text-base mt-0.5">
                    {report.conventional_event_count}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 text-[11px]">Mean Interval</span>
                  <p className="font-bold text-slate-900 text-base mt-0.5">
                    {report.mean_days_between_events_conventional.toFixed(1)} days
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Policy applies irrigation whenever depletion exceeds RAW ({report.raw_mm.toFixed(1)}{" "}
                mm) without forecast rainfall subtraction or forward soil moisture projections.
                Susceptible to applying water immediately before rain events.
              </p>
            </div>

            {/* AquaSense-IoT Predictive Box */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                <div className="flex items-center space-x-2">
                  <Compass className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-bold text-emerald-950 text-sm">
                    AquaSense-IoT: Predictive Precision Scheduler
                  </h3>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
                  ML + Rain Aware
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-emerald-200">
                  <span className="text-slate-500 text-[11px]">Gross Depth</span>
                  <p className="font-bold text-emerald-900 text-base mt-0.5">
                    {report.predictive_total_depth_mm.toFixed(1)} mm
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200">
                  <span className="text-slate-500 text-[11px]">Applied Volume</span>
                  <p className="font-bold text-emerald-900 text-base mt-0.5">
                    {report.predictive_total_volume_m3.toLocaleString()} m³
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200">
                  <span className="text-slate-500 text-[11px]">Total Events</span>
                  <p className="font-bold text-emerald-900 text-base mt-0.5">
                    {report.predictive_event_count}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200">
                  <span className="text-slate-500 text-[11px]">Mean Interval</span>
                  <p className="font-bold text-emerald-900 text-base mt-0.5">
                    {report.mean_days_between_events_predictive.toFixed(1)} days
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Dynamically subtracts effective rainfall (P_eff) from root-zone depletion and uses
                the 24-hour machine-learning forecast to defer irrigation when precipitation is
                imminent, preserving TAW buffer capacity.
              </p>
            </div>
          </div>

          {/* Time Series Dynamics Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Comparative Soil Moisture Dynamics & Irrigation Event Timeline
                </h3>
                <span className="text-xs text-slate-500">
                  Period: {new Date(report.evaluation_period_start).toLocaleDateString()} –{" "}
                  {new Date(report.evaluation_period_end).toLocaleDateString()} ({report.total_timesteps}{" "}
                  hourly timesteps)
                </span>
              </div>
              <ProvenanceBadge type="SIMULATED" />
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={report.time_series_sample}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="timestamp_utc"
                    tickFormatter={(ts) => {
                      const d = new Date(ts);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    domain={[0.1, 0.35]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    label={{
                      value: "Moisture (m³/m³)",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 10,
                      fill: "#64748b",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "0.75rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />

                  {/* Reference Lines */}
                  <ReferenceLine
                    y={selectedField?.field_capacity_theta || 0.31}
                    label={{
                      value: "FC (0.31)",
                      position: "right",
                      fill: "#059669",
                      fontSize: 10,
                    }}
                    stroke="#059669"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    y={
                      (selectedField?.field_capacity_theta || 0.31) -
                      report.raw_mm / (1000.0 * (selectedField?.root_depth_m || 0.6))
                    }
                    label={{
                      value: "Stress Threshold RAW",
                      position: "right",
                      fill: "#d97706",
                      fontSize: 10,
                    }}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                  />

                  {/* Trajectory */}
                  <Line
                    type="monotone"
                    dataKey="observed_soil_moisture_m3m3"
                    name="Predictive Soil Moisture"
                    stroke="#047857"
                    strokeWidth={2}
                    dot={false}
                  />

                  {/* Irrigation event bars */}
                  <Bar
                    dataKey="conventional_depth_mm"
                    name="Conventional Event Depth (mm)"
                    fill="#94a3b8"
                    opacity={0.4}
                  />
                  <Bar
                    dataKey="predictive_depth_mm"
                    name="Predictive Event Depth (mm)"
                    fill="#10b981"
                    opacity={0.7}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Post-Irrigation Logged Events Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-slate-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Field Post-Irrigation Event Audit Log
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {events.length} Recorded Application Events
              </span>
            </div>

            {events.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Droplets className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">No executed events recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click &quot;Log Executed Event&quot; above to log an actual field irrigation event.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Execution Time</th>
                      <th className="py-2.5 px-3">Applied Volume</th>
                      <th className="py-2.5 px-3">Applied Depth</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Pre / Post SM</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-mono">
                          {new Date(ev.event_timestamp_utc).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {ev.actual_volume_m3.toFixed(1)} m³
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">
                          {ev.actual_depth_mm.toFixed(1)} mm
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-700">
                          {ev.irrigation_method}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {ev.pre_irrigation_sm != null ? ev.pre_irrigation_sm.toFixed(3) : "—"} →{" "}
                          {ev.post_irrigation_sm != null ? ev.post_irrigation_sm.toFixed(3) : "—"}{" "}
                          m³/m³
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.execution_status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ev.execution_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                          {ev.operator_notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scientific Methodology Notes & Assumptions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Scientific Methodology, Assumptions & Limitations:
            </h4>
            <ul className="space-y-1.5 list-disc pl-5 text-slate-600 leading-relaxed">
              {report.methodology_notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
              <li>
                <strong>Agronomic Water-Use Efficiency (WUE):</strong> Currently marked as{" "}
                <code className="text-amber-800 font-mono text-[11px]">{report.crop_yield_status}</code>.
                Agronomic WUE (kg/m³) cannot be scientifically claimed without physical crop
                yield measurements at harvest.
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Log Executed Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Log Executed Field Irrigation Event
              </h3>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {eventFormError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {eventFormError}
              </div>
            )}

            <form onSubmit={handleLogEventSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Actual Volume (m³)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={eventPayload.actual_volume_m3}
                    onChange={(e) =>
                      setEventPayload({
                        ...eventPayload,
                        actual_volume_m3: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Actual Depth (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={eventPayload.actual_depth_mm}
                    onChange={(e) =>
                      setEventPayload({
                        ...eventPayload,
                        actual_depth_mm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Irrigation Method</label>
                <select
                  value={eventPayload.irrigation_method}
                  onChange={(e) =>
                    setEventPayload({ ...eventPayload, irrigation_method: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                >
                  <option value="drip">Drip Irrigation</option>
                  <option value="sprinkler">Sprinkler</option>
                  <option value="subsurface_drip">Subsurface Drip</option>
                  <option value="furrow">Furrow</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Pre-SM (m³/m³, opt)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0.05"
                    max="0.55"
                    placeholder="e.g. 0.210"
                    value={eventPayload.pre_irrigation_sm ?? ""}
                    onChange={(e) =>
                      setEventPayload({
                        ...eventPayload,
                        pre_irrigation_sm: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Post-SM (m³/m³, opt)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0.05"
                    max="0.55"
                    placeholder="e.g. 0.295"
                    value={eventPayload.post_irrigation_sm ?? ""}
                    onChange={(e) =>
                      setEventPayload({
                        ...eventPayload,
                        post_irrigation_sm: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Operator Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on pump pressure, emitter lines, block valve..."
                  value={eventPayload.operator_notes || ""}
                  onChange={(e) =>
                    setEventPayload({ ...eventPayload, operator_notes: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eventSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {eventSubmitting ? "Logging..." : "Confirm & Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
