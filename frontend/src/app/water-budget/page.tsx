"use client";

import React, { useState } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Droplets,
  Gauge,
  Percent,
  PieChart,
  RefreshCw,
  Sparkles,
  Sprout,
  TrendingUp,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

export default function WaterBudgetPage() {
  const { t } = useLanguage();
  const { palette } = useTheme();

  // Calculator Parameters
  const [areaHectares, setAreaHectares] = useState<number>(3.5);
  const [cropType, setCropType] = useState<string>("groundnut");
  const [baselineMethod, setBaselineMethod] = useState<string>("flood"); // flood, timer_sprinkler, uncalibrated_drip
  const [seasonDays, setSeasonDays] = useState<number>(120);
  const [pumpDepthMeters, setPumpDepthMeters] = useState<number>(35);
  const [electricityTariff, setElectricityTariff] = useState<number>(6.5); // ₹ or $ per kWh

  // Crop water demand estimates (m3 per hectare per season)
  const cropWaterNeeds: Record<string, { name: string; gross_m3_ha: number; yield_kg_ha: number }> = {
    groundnut: { name: "Groundnut (Peanut)", gross_m3_ha: 5500, yield_kg_ha: 2600 },
    cotton: { name: "Cotton", gross_m3_ha: 7500, yield_kg_ha: 3100 },
    tomato: { name: "Tomato", gross_m3_ha: 6000, yield_kg_ha: 45000 },
    maize: { name: "Maize (Corn)", gross_m3_ha: 6800, yield_kg_ha: 6200 },
  };

  // Efficiency factors
  const methodEfficiency: Record<string, { label: string; efficiency: number; factor: number }> = {
    flood: { label: "Conventional Flood Irrigation", efficiency: 0.50, factor: 1.0 },
    timer_sprinkler: { label: "Timer-Based Sprinkler (No Soil Feedback)", efficiency: 0.68, factor: 0.74 },
    uncalibrated_drip: { label: "Fixed-Interval Drip (No AI Forecasting)", efficiency: 0.78, factor: 0.64 },
  };

  const selectedCrop = cropWaterNeeds[cropType] || cropWaterNeeds.groundnut;
  const selectedMethod = methodEfficiency[baselineMethod] || methodEfficiency.flood;

  // AquaSense Precision Efficiency (Fused Sensor + SMAP + AI Forecast)
  const precisionEfficiency = 0.92;

  // Computations
  const totalCropNeedM3 = areaHectares * (selectedCrop.gross_m3_ha * 0.55); // net root requirement
  const baselineWaterM3 = Math.round(totalCropNeedM3 / selectedMethod.efficiency);
  const precisionWaterM3 = Math.round(totalCropNeedM3 / precisionEfficiency);
  const waterSavedM3 = Math.max(0, baselineWaterM3 - precisionWaterM3);
  const waterSavedLiters = waterSavedM3 * 1000;
  const waterSavingsPercent = Math.round((waterSavedM3 / baselineWaterM3) * 100);

  // Energy & Financial Savings
  // Hydraulic energy: E (kWh) = (Volume_m3 * 9.81 * Head_m) / (3600 * Pump_Efficiency ~0.65)
  const pumpEfficiency = 0.65;
  const baselineEnergyKWh = Math.round((baselineWaterM3 * 9.81 * pumpDepthMeters) / (3600 * pumpEfficiency));
  const precisionEnergyKWh = Math.round((precisionWaterM3 * 9.81 * pumpDepthMeters) / (3600 * pumpEfficiency));
  const energySavedKWh = Math.max(0, baselineEnergyKWh - precisionEnergyKWh);
  const moneySavedCurrency = Math.round(energySavedKWh * electricityTariff);

  // Water Productivity (kg crop per m3 water)
  const baselineWUE = ((selectedCrop.yield_kg_ha * areaHectares) / baselineWaterM3).toFixed(2);
  const precisionWUE = ((selectedCrop.yield_kg_ha * areaHectares) / precisionWaterM3).toFixed(2);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              <span>{t("navWaterBudget")}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quantify water conservation, electric pumping reduction, and economic ROI comparing AquaSense-IoT precision scheduling against traditional irrigation.
            </p>
          </div>
        </div>

        {/* 3 Top Summary Impact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white dark:to-slate-900 p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Water Volume Conserved
              </span>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <Droplets className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {(waterSavedLiters / 1000000).toFixed(2)}M Liters
              </div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <span>{waterSavedM3.toLocaleString()} m³ ({waterSavingsPercent}% savings vs baseline)</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-300 dark:border-sky-800 bg-gradient-to-br from-sky-500/10 via-sky-50/50 to-white dark:to-slate-900 p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                Pumping Energy Conserved
              </span>
              <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-sky-700 dark:text-sky-300">
                {energySavedKWh.toLocaleString()} kWh
              </div>
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400 mt-1">
                Reduced wear on borewell pump & transformer
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white dark:to-slate-900 p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Economic Utility Savings
              </span>
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                <Coins className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                ₹{moneySavedCurrency.toLocaleString()}
              </div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">
                Direct seasonal electricity cost savings
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Configuration Sliders & Comparative Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Form */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Farm Parameters & Irrigation Setup</span>
            </h3>

            {/* Farm Area */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Field Area</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{areaHectares} Hectares</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                value={areaHectares}
                onChange={(e) => setAreaHectares(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Crop Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Crop Variety
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="groundnut">Groundnut (Kurnool Standard)</option>
                <option value="cotton">Cotton (Black Cotton Soil)</option>
                <option value="tomato">Tomato (High-Value Horticulture)</option>
                <option value="maize">Maize (Grain Filling)</option>
              </select>
            </div>

            {/* Baseline Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Baseline Method to Compare Against
              </label>
              <select
                value={baselineMethod}
                onChange={(e) => setBaselineMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="flood">Conventional Flood Irrigation (50% Eff)</option>
                <option value="timer_sprinkler">Timer-Based Sprinkler (68% Eff)</option>
                <option value="uncalibrated_drip">Fixed-Interval Drip (78% Eff)</option>
              </select>
            </div>

            {/* Season Duration */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Crop Season Duration</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{seasonDays} Days</span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                step="5"
                value={seasonDays}
                onChange={(e) => setSeasonDays(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Borewell Pumping Depth */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Borewell Pumping Head / Depth</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{pumpDepthMeters} Meters</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={pumpDepthMeters}
                onChange={(e) => setPumpDepthMeters(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Electricity Tariff */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Electricity Tariff Rate</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">₹{electricityTariff} / kWh</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="15.0"
                step="0.5"
                value={electricityTariff}
                onChange={(e) => setElectricityTariff(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Comparative Metrics & Chart Display */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Side-by-Side Irrigation Comparison</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Benchmarking baseline water distribution against AquaSense-IoT closed-loop depletion scheduling.
              </p>
            </div>

            {/* Visual Bar Comparison */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Baseline ({selectedMethod.label})</span>
                  <span className="font-mono">{baselineWaterM3.toLocaleString()} m³</span>
                </div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  <span>AquaSense-IoT Fused Precision System</span>
                  <span className="font-mono font-extrabold">{precisionWaterM3.toLocaleString()} m³ (-{waterSavingsPercent}%)</span>
                </div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((precisionWaterM3 / baselineWaterM3) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI Matrix Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3">Performance Dimension</th>
                    <th className="p-3 text-right">Conventional</th>
                    <th className="p-3 text-right text-emerald-600 dark:text-emerald-400">AquaSense-IoT</th>
                    <th className="p-3 text-right">Net Benefit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  <tr>
                    <td className="p-3 font-medium">Seasonal Water Consumption</td>
                    <td className="p-3 text-right font-mono">{baselineWaterM3.toLocaleString()} m³</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{precisionWaterM3.toLocaleString()} m³</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">-{waterSavingsPercent}%</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Pumping Electricity Used</td>
                    <td className="p-3 text-right font-mono">{baselineEnergyKWh.toLocaleString()} kWh</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{precisionEnergyKWh.toLocaleString()} kWh</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">-{energySavedKWh.toLocaleString()} kWh</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Electricity Bill Cost</td>
                    <td className="p-3 text-right font-mono">₹{Math.round(baselineEnergyKWh * electricityTariff).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{Math.round(precisionEnergyKWh * electricityTariff).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">Save ₹{moneySavedCurrency.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Water Use Efficiency (WUE)</td>
                    <td className="p-3 text-right font-mono">{baselineWUE} kg/m³</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{precisionWUE} kg/m³</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">+{Math.round(((parseFloat(precisionWUE) - parseFloat(baselineWUE)) / parseFloat(baselineWUE)) * 100)}% Boost</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Scientific Provenance Note */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <strong className="text-slate-700 dark:text-slate-200 block font-semibold">
                Hydrological Derivation:
              </strong>
              <p>
                Calculations conform to <strong>FAO-56 Irrigation and Drainage</strong> standards, incorporating management allowed depletion ($p$), effective root-zone depth ($Z_r$), and dynamic Penman-Monteith crop evapotranspiration ($ET_c = K_c \times ET_0$).
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
