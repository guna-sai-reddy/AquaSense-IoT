"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CloudRain,
  Database,
  Droplets,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import {
  Field,
  Prediction,
  SatelliteResponse,
  SensorObservation,
  WeatherObservation,
} from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton, LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function SoilMoisturePage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [observations, setObservations] = useState<SensorObservation[]>([]);
  const [weatherList, setWeatherList] = useState<WeatherObservation[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [satelliteData, setSatelliteData] = useState<SatelliteResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Ingest Observation Modal
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string>("SN-PROBE-01");
  const [soilMoisture, setSoilMoisture] = useState<number>(0.22);
  const [soilTemp, setSoilTemp] = useState<number>(24.0);
  const [humidity, setHumidity] = useState<number>(65.0);
  const [depthCm, setDepthCm] = useState<number>(20.0);
  const [ingestSubmitting, setIngestSubmitting] = useState<boolean>(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

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
        const [obs, weather, preds, sat] = await Promise.all([
          api.getFieldObservations(activeId, 100).catch(() => []),
          api.getFieldWeather(activeId, 100).catch(() => []),
          api.getFieldPredictions(activeId, 50).catch(() => []),
          api.getFieldSatellite(activeId).catch(() => null),
        ]);
        setObservations(obs);
        setWeatherList(weather);
        setPredictions(preds);
        setSatelliteData(sat);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load soil moisture and weather observations.");
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

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldId) return;
    setIngestSubmitting(true);
    setIngestError(null);

    const nowIso = new Date().toISOString();
    try {
      await api.ingestObservation({
        field_id: selectedFieldId,
        device_id: deviceId,
        observation_timestamp_utc: nowIso,
        soil_moisture: soilMoisture,
        soil_moisture_unit: "m3/m3",
        soil_temperature: soilTemp,
        soil_temperature_unit: "celsius",
        relative_humidity: humidity,
        relative_humidity_unit: "percent",
        depth_cm: depthCm,
        is_test_fixture: false,
      });
      setIsIngestOpen(false);
      await loadData(selectedFieldId);
    } catch (err: any) {
      setIngestError(err.message || "Failed to ingest sensor telemetry.");
    } finally {
      setIngestSubmitting(false);
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Prepare chart series: Sort chronologically
  const chartData = [...observations]
    .sort(
      (a, b) =>
        new Date(a.observation_timestamp_utc).getTime() -
        new Date(b.observation_timestamp_utc).getTime()
    )
    .map((obs) => ({
      timestamp: new Date(obs.observation_timestamp_utc).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      soilMoisture: obs.soil_moisture_m3m3,
      temperature: obs.soil_temperature_c,
      humidity: obs.relative_humidity_pct,
      depth: `${obs.depth_cm} cm`,
      source: obs.source_type,
    }));

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Soil Moisture & Microclimate Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Calibrated in-situ telemetry, soil depth profiling, and ambient weather context
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
                  setIngestError(null);
                  setIsIngestOpen(true);
                }}
                disabled={!selectedFieldId}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ingest Probe Reading
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadData();
                }}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition"
                title="Refresh observations"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Backend Communication Issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <CardSkeleton />
          ) : fields.length === 0 ? (
            <EmptyState
              icon={<Droplets className="h-7 w-7" />}
              title="No Fields Found"
              description="Configure an agricultural field first before streaming soil moisture probe telemetry."
              action={{
                label: "Create Field",
                onClick: () => (window.location.href = "/fields"),
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Hydraulic Context Banner */}
              {selectedField && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Field Capacity (θ_FC)
                    </span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {selectedField.field_capacity_theta} m³/m³
                    </p>
                    <span className="text-[10px] text-slate-400">Upper drained limit</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Wilting Point (θ_WP)
                    </span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {selectedField.wilting_point_theta} m³/m³
                    </p>
                    <span className="text-[10px] text-slate-400">Lower plant limit</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Management Allowed Depletion
                    </span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {(
                        selectedField.field_capacity_theta -
                        (selectedField.field_capacity_theta - selectedField.wilting_point_theta) *
                          selectedField.depletion_fraction_p
                      ).toFixed(3)}{" "}
                      m³/m³
                    </p>
                    <span className="text-[10px] text-slate-400">
                      p = {selectedField.depletion_fraction_p} threshold
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Latest Reading
                    </span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {observations[0]?.soil_moisture_m3m3 != null
                        ? `${observations[0].soil_moisture_m3m3.toFixed(3)} m³/m³`
                        : "No Telemetry"}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {observations.length > 0
                        ? `${observations[0].depth_cm} cm depth`
                        : "Awaiting probe"}
                    </span>
                  </div>
                </div>
              )}

              {/* Chart Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Droplets className="h-5 w-5 text-emerald-700" />
                    <h2 className="text-base font-bold text-slate-900">
                      Volumetric Soil Moisture Dynamics (m³/m³)
                    </h2>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      <span className="text-slate-600">In-situ Probe</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-slate-600">24h Forecast</span>
                    </span>
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Database className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-sm font-medium">No real sensor observations recorded for this field yet.</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Use the &quot;Ingest Probe Reading&quot; button above to submit calibrated physical probe telemetry.
                    </p>
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="timestamp"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={11}
                          domain={[0, 0.5]}
                          tickFormatter={(v) => `${v.toFixed(2)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#cbd5e1",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="soilMoisture"
                          name="Soil Moisture (m³/m³)"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#059669" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Historical Telemetry Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Chronological Ground Telemetry Records ({observations.length})
                  </h3>
                </div>

                {observations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No records found. Ingest physical sensor readings to build history.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Timestamp (UTC)</th>
                          <th className="py-2.5 px-3">Device ID</th>
                          <th className="py-2.5 px-3">Moisture (m³/m³)</th>
                          <th className="py-2.5 px-3">Temperature (°C)</th>
                          <th className="py-2.5 px-3">Humidity (%)</th>
                          <th className="py-2.5 px-3">Depth</th>
                          <th className="py-2.5 px-3">Provenance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {observations.map((obs) => (
                          <tr key={obs.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-mono">
                              {new Date(obs.observation_timestamp_utc).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                              {obs.device_id}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {obs.soil_moisture_m3m3?.toFixed(3) ?? "—"} m³/m³
                            </td>
                            <td className="py-2.5 px-3">
                              {obs.soil_temperature_c != null ? `${obs.soil_temperature_c.toFixed(1)} °C` : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              {obs.relative_humidity_pct != null ? `${obs.relative_humidity_pct.toFixed(0)} %` : "—"}
                            </td>
                            <td className="py-2.5 px-3">{obs.depth_cm} cm</td>
                            <td className="py-2.5 px-3">
                              <ProvenanceBadge type={obs.source_type} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SATELLITE & GROUND DATA FUSION SECTION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-2">
                    <Radio className="h-5 w-5 text-emerald-700" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Satellite & Ground Data Fusion: NASA SMAP (9km) vs In-Situ Probes
                      </h2>
                      <p className="text-xs text-slate-500">
                        Multi-scale hydrological assimilation: Satellite radiometry footprint vs calibrated root-zone telemetry
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ProvenanceBadge type="SATELLITE_DERIVED" />
                    <ProvenanceBadge type="MEASURED" />
                  </div>
                </div>

                {/* Scale & Footprint Comparison Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase">
                      Satellite Sensor / Radiometer
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {satelliteData?.product_name || "NASA SMAP SPL3SMP_E"}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Version {satelliteData?.product_version || "006"} (Enhanced L3)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase">
                      Spatial Grid Resolution
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {satelliteData?.spatial_resolution || "9 km EASE-Grid 2.0"}
                    </p>
                    <span className="text-[10px] text-slate-400">Regional Footprint Cell</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase">
                      Sensing Depth Stratum
                    </span>
                    <p className="font-bold text-emerald-800 text-sm mt-0.5">
                      0 – 5 cm (Surface Skin)
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Ground Probe: 20 cm (Root Zone)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase">
                      NASA CMR Granules
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {satelliteData?.granule_count || 0} Overpasses
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Cadence: ~2-3 days repeat
                    </span>
                  </div>
                </div>

                {/* Vertical Scale Distinction Notice */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Scientific Scale & Depth Discrepancy Notice:</span>
                  </div>
                  <p className="leading-relaxed">
                    Satellite passive microwave radiometry penetrates the top 0–5 cm surface layer, reflecting diurnal
                    skin evaporation and direct precipitation. In-situ capacitive ground probes measure at 20 cm depth,
                    representing the buffered crop root zone (7–28 cm). AquaSense-IoT explicitly preserves both distinct
                    strata and prohibits treating surface satellite skin moisture as a direct substitute for root-zone moisture.
                  </p>
                </div>

                {/* Satellite Overpasses Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    NASA CMR Satellite Granules Intersecting Field (15.83°N, 78.04°E):
                  </h3>
                  {satelliteData && satelliteData.granules && satelliteData.granules.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Granule ID</th>
                            <th className="py-2.5 px-3">Acquisition Window</th>
                            <th className="py-2.5 px-3">Footprint Depth</th>
                            <th className="py-2.5 px-3">CMR Index Status</th>
                            <th className="py-2.5 px-3">Cloud Access</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {satelliteData.granules.slice(0, 5).map((g) => (
                            <tr key={g.granule_id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                                {g.granule_id}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {new Date(g.time_start).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-emerald-800">
                                {g.depth}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  VERIFIED_IN_NASA_CMR
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-500">
                                {g.retrieval_status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      Querying NASA Earthdata CMR API for intersecting satellite granules...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* INGEST SENSOR READING MODAL */}
          {isIngestOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Ingest Physical Ground Probe Telemetry
                  </h2>
                  <button
                    onClick={() => setIsIngestOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {ingestError && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                    {ingestError}
                  </div>
                )}

                <form onSubmit={handleIngestSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">Hardware Device ID</label>
                    <input
                      type="text"
                      required
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="e.g. SN-KURNOOL-01"
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700">Soil Moisture (m³/m³)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.0"
                        max="1.0"
                        required
                        value={soilMoisture}
                        onChange={(e) => setSoilMoisture(parseFloat(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700">Depth (cm)</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="300"
                        required
                        value={depthCm}
                        onChange={(e) => setDepthCm(parseFloat(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700">Soil Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-20"
                        max="60"
                        required
                        value={soilTemp}
                        onChange={(e) => setSoilTemp(parseFloat(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700">Humidity (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        required
                        value={humidity}
                        onChange={(e) => setHumidity(parseFloat(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsIngestOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={ingestSubmitting}
                      className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {ingestSubmitting ? "Ingesting..." : "Ingest Telemetry"}
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
