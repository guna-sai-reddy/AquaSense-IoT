"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Droplets,
  Edit2,
  HelpCircle,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Field, FieldCreatePayload, FieldUpdatePayload } from "@/lib/types";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

// Smart Presets for Easy Mode
const CROP_PRESETS: Record<
  string,
  {
    label: string;
    name: string;
    stage: string;
    kc: number;
    root_depth_m: number;
    depletion_fraction_p: number;
    icon: string;
    category: "dry" | "wet";
    description: string;
  }
> = {
  // Dry Crops (Arid / Semi-Arid / Drought-Tolerant / Low Water Consumption)
  groundnut: {
    label: "Groundnut / Peanut",
    name: "groundnut",
    stage: "mid_season",
    kc: 1.15,
    root_depth_m: 0.60,
    depletion_fraction_p: 0.50,
    icon: "🥜",
    category: "dry",
    description: "Hardy legume, moderate moisture requirement",
  },
  cotton: {
    label: "Cotton",
    name: "cotton",
    stage: "mid_season",
    kc: 1.20,
    root_depth_m: 1.00,
    depletion_fraction_p: 0.65,
    icon: "🌱",
    category: "dry",
    description: "Deep taproot, resilient against water deficit",
  },
  maize: {
    label: "Maize (Corn)",
    name: "maize",
    stage: "mid_season",
    kc: 1.15,
    root_depth_m: 0.80,
    depletion_fraction_p: 0.55,
    icon: "🌽",
    category: "dry",
    description: "Dryland cereal, drought hardy with sensitive flowering",
  },
  wheat: {
    label: "Wheat",
    name: "wheat",
    stage: "mid_season",
    kc: 1.15,
    root_depth_m: 0.80,
    depletion_fraction_p: 0.55,
    icon: "🌾",
    category: "dry",
    description: "Rabi/winter cereal, deep root moisture extraction",
  },
  millets: {
    label: "Millets / Jowar / Bajra",
    name: "millets",
    stage: "mid_season",
    kc: 1.00,
    root_depth_m: 0.70,
    depletion_fraction_p: 0.60,
    icon: "🥣",
    category: "dry",
    description: "Super drought-hardy, minimal water requirement",
  },
  chickpea: {
    label: "Chickpea / Gram / Pulses",
    name: "chickpea",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.60,
    depletion_fraction_p: 0.50,
    icon: "🫘",
    category: "dry",
    description: "Low-water legume, extracts residual subsoil moisture",
  },
  mustard: {
    label: "Mustard / Oilseeds",
    name: "mustard",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.70,
    depletion_fraction_p: 0.55,
    icon: "🌼",
    category: "dry",
    description: "Drought-adapted oilseed, light irrigation events",
  },
  sorghum: {
    label: "Sorghum (Jowar)",
    name: "sorghum",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.90,
    depletion_fraction_p: 0.60,
    icon: "🌾",
    category: "dry",
    description: "Extensive root depth, excellent dryland resilience",
  },

  // Wet Crops (Irrigated / High Water Consumption / Wetland / Frequent Moisture)
  rice: {
    label: "Rice / Paddy",
    name: "rice",
    stage: "mid_season",
    kc: 1.20,
    root_depth_m: 0.50,
    depletion_fraction_p: 0.20,
    icon: "🍚",
    category: "wet",
    description: "Semi-aquatic, needs saturated soil or standing water",
  },
  sugarcane: {
    label: "Sugarcane",
    name: "sugarcane",
    stage: "mid_season",
    kc: 1.25,
    root_depth_m: 1.20,
    depletion_fraction_p: 0.65,
    icon: "🎋",
    category: "wet",
    description: "High water consumption crop throughout long season",
  },
  tomato: {
    label: "Tomato & Vegetables",
    name: "tomato",
    stage: "mid_season",
    kc: 1.15,
    root_depth_m: 0.60,
    depletion_fraction_p: 0.40,
    icon: "🍅",
    category: "wet",
    description: "Frequent irrigation needed, low deficit tolerance",
  },
  onion: {
    label: "Onion / Shallots",
    name: "onion",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.40,
    depletion_fraction_p: 0.35,
    icon: "🧅",
    category: "wet",
    description: "Shallow roots, sensitive to drying upper soil stratum",
  },
  chilli: {
    label: "Chilli / Bell Pepper",
    name: "chilli",
    stage: "mid_season",
    kc: 1.10,
    root_depth_m: 0.55,
    depletion_fraction_p: 0.35,
    icon: "🌶️",
    category: "wet",
    description: "Regular watering schedule prevents flower/fruit drop",
  },
  banana: {
    label: "Banana",
    name: "banana",
    stage: "mid_season",
    kc: 1.20,
    root_depth_m: 0.60,
    depletion_fraction_p: 0.35,
    icon: "🍌",
    category: "wet",
    description: "High transpiration canopy, demands consistent moisture",
  },
  watermelon: {
    label: "Watermelon / Melons",
    name: "watermelon",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.70,
    depletion_fraction_p: 0.45,
    icon: "🍉",
    category: "wet",
    description: "High volume water requirements during fruit sizing",
  },
  cabbage: {
    label: "Cabbage & Greens",
    name: "cabbage",
    stage: "mid_season",
    kc: 1.05,
    root_depth_m: 0.40,
    depletion_fraction_p: 0.30,
    icon: "🥬",
    category: "wet",
    description: "Shallow root depth, regular irrigation prevents stress",
  },
};

const SOIL_PRESETS: Record<
  string,
  { label: string; texture: string; field_capacity_theta: number; wilting_point_theta: number; description: string }
> = {
  clay_loam: {
    label: "Clay Loam (Most Common Farming Soil)",
    texture: "clay_loam",
    field_capacity_theta: 0.31,
    wilting_point_theta: 0.15,
    description: "Good water retention, ideal for groundnut & vegetables (31% capacity)",
  },
  clay: {
    label: "Black Clay Soil (Heavy, Deep Moisture Holding)",
    texture: "clay",
    field_capacity_theta: 0.36,
    wilting_point_theta: 0.20,
    description: "Very high water storage, common for cotton and paddy (36% capacity)",
  },
  sandy_loam: {
    label: "Sandy Loam (Light, Fast-Draining Soil)",
    texture: "sandy_loam",
    field_capacity_theta: 0.22,
    wilting_point_theta: 0.10,
    description: "Well-drained, requires more frequent lighter irrigation (22% capacity)",
  },
  loam: {
    label: "Red Loam (Balanced Porosity)",
    texture: "loam",
    field_capacity_theta: 0.28,
    wilting_point_theta: 0.13,
    description: "Standard fertile loam, holds moderate moisture (28% capacity)",
  },
  sand: {
    label: "Sandy Soil (Coarse, Highly Permeable)",
    texture: "sand",
    field_capacity_theta: 0.14,
    wilting_point_theta: 0.06,
    description: "Drains rapidly, requires frequent drip pulses (14% capacity)",
  },
};

const LOCATION_PRESETS: Record<string, { label: string; lat: number; lon: number }> = {
  kurnool: { label: "Kurnool, Andhra Pradesh", lat: 15.8281, lon: 78.0373 },
  anantapur: { label: "Anantapur, Andhra Pradesh", lat: 14.6819, lon: 77.6006 },
  nandyal: { label: "Nandyal, Andhra Pradesh", lat: 15.4886, lon: 78.4832 },
  kadapa: { label: "Kadapa, Andhra Pradesh", lat: 14.4674, lon: 78.8241 },
  hyderabad: { label: "Hyderabad, Telangana", lat: 17.3850, lon: 78.4867 },
  bengaluru: { label: "Bengaluru, Karnataka", lat: 12.9716, lon: 77.5946 },
};

const IRRIGATION_PRESETS: Record<
  string,
  { label: string; method: "drip" | "sprinkler" | "flood" | "subsurface_drip" | "furrow"; eff: number; maxDepth: number; badge: string }
> = {
  drip: {
    label: "Drip Irrigation (Recommended - 90% Efficiency)",
    method: "drip",
    eff: 0.90,
    maxDepth: 30.0,
    badge: "Saves ~40% Water",
  },
  sprinkler: {
    label: "Sprinkler System (75% Efficiency)",
    method: "sprinkler",
    eff: 0.75,
    maxDepth: 40.0,
    badge: "Medium Pressure",
  },
  flood: {
    label: "Surface / Flood / Furrow (60% Efficiency)",
    method: "flood",
    eff: 0.60,
    maxDepth: 60.0,
    badge: "Traditional Gravity",
  },
  subsurface_drip: {
    label: "Subsurface Drip (95% Efficiency)",
    method: "subsurface_drip",
    eff: 0.95,
    maxDepth: 30.0,
    badge: "Maximum Conservation",
  },
};

const DEFAULT_NEW_FIELD: FieldCreatePayload = {
  name: "",
  latitude: 15.8281,
  longitude: 78.0373,
  area_unit: "hectares",
  area_value: 2.0,
  irrigation_method: "drip",
  application_efficiency: 0.90,
  max_depth_per_event_mm: 30.0,
  crop: {
    crop_name: "groundnut",
    growth_stage: "mid_season",
    kc: 1.15,
    root_depth_m: 0.60,
    depletion_fraction_p: 0.50,
  },
  soil: {
    soil_texture: "clay_loam",
    field_capacity_theta: 0.31,
    wilting_point_theta: 0.15,
  },
};

export default function FieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newFieldData, setNewFieldData] = useState<FieldCreatePayload>(DEFAULT_NEW_FIELD);
  const [selectedCropKey, setSelectedCropKey] = useState<string>("groundnut");
  const [cropCategory, setCropCategory] = useState<"dry" | "wet">("dry");
  const [selectedSoilKey, setSelectedSoilKey] = useState<string>("clay_loam");
  const [selectedLocationKey, setSelectedLocationKey] = useState<string>("kurnool");
  const [selectedIrrigationKey, setSelectedIrrigationKey] = useState<string>("drip");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<Field | null>(null);
  const [editData, setEditData] = useState<FieldUpdatePayload>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  const [deletingField, setDeletingField] = useState<Field | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);

  const loadFields = async () => {
    setError(null);
    try {
      const data = await api.getFields();
      setFields(data);
    } catch (err: any) {
      setError(err.message || "Failed to load fields from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  // Handlers for smart preset selection & category filtering
  const handleCropPresetChange = (cropKey: string) => {
    setSelectedCropKey(cropKey);
    const preset = CROP_PRESETS[cropKey];
    if (preset) {
      setCropCategory(preset.category);
      setNewFieldData((prev) => ({
        ...prev,
        crop: {
          ...prev.crop,
          crop_name: preset.name,
          growth_stage: preset.stage,
          kc: preset.kc,
          root_depth_m: preset.root_depth_m,
          depletion_fraction_p: preset.depletion_fraction_p,
        },
      }));
    }
  };

  const handleCategoryTabChange = (category: "dry" | "wet") => {
    setCropCategory(category);
    // If current selected preset doesn't match new category, switch to category default
    const currentPreset = CROP_PRESETS[selectedCropKey];
    if (!currentPreset || currentPreset.category !== category) {
      const defaultKey = category === "dry" ? "groundnut" : "rice";
      handleCropPresetChange(defaultKey);
    }
  };

  const handleCropNameManualChange = (name: string) => {
    const trimmed = name.trim().toLowerCase();
    // Check if what the user entered matches any preset key or label
    const matchedEntry = Object.entries(CROP_PRESETS).find(
      ([k, p]) =>
        k.toLowerCase() === trimmed ||
        p.name.toLowerCase() === trimmed ||
        p.label.toLowerCase() === trimmed
    );

    if (matchedEntry) {
      const [matchedKey, preset] = matchedEntry;
      setSelectedCropKey(matchedKey);
      setCropCategory(preset.category);
      setNewFieldData((prev) => ({
        ...prev,
        crop: {
          ...prev.crop,
          crop_name: name,
          growth_stage: preset.stage,
          kc: preset.kc,
          root_depth_m: preset.root_depth_m,
          depletion_fraction_p: preset.depletion_fraction_p,
        },
      }));
    } else {
      setSelectedCropKey("custom");
      // Sensible baseline defaults based on active Dry/Wet category
      const defaultKc = cropCategory === "dry" ? 1.05 : 1.15;
      const defaultRoot = cropCategory === "dry" ? 0.70 : 0.50;
      const defaultP = cropCategory === "dry" ? 0.55 : 0.35;

      setNewFieldData((prev) => ({
        ...prev,
        crop: {
          ...prev.crop,
          crop_name: name,
          kc: prev.crop.kc || defaultKc,
          root_depth_m: prev.crop.root_depth_m || defaultRoot,
          depletion_fraction_p: prev.crop.depletion_fraction_p || defaultP,
        },
      }));
    }
  };

  const handleSoilPresetChange = (soilKey: string) => {
    setSelectedSoilKey(soilKey);
    const preset = SOIL_PRESETS[soilKey];
    if (preset) {
      setNewFieldData((prev) => ({
        ...prev,
        soil: {
          ...prev.soil,
          soil_texture: preset.texture,
          field_capacity_theta: preset.field_capacity_theta,
          wilting_point_theta: preset.wilting_point_theta,
        },
      }));
    }
  };

  const handleLocationPresetChange = (locKey: string) => {
    setSelectedLocationKey(locKey);
    if (locKey !== "custom") {
      const preset = LOCATION_PRESETS[locKey];
      if (preset) {
        setNewFieldData((prev) => ({
          ...prev,
          latitude: preset.lat,
          longitude: preset.lon,
        }));
      }
    }
  };

  const handleIrrigationPresetChange = (irrKey: string) => {
    setSelectedIrrigationKey(irrKey);
    const preset = IRRIGATION_PRESETS[irrKey];
    if (preset) {
      setNewFieldData((prev) => ({
        ...prev,
        irrigation_method: preset.method,
        application_efficiency: preset.eff,
        max_depth_per_event_mm: preset.maxDepth,
      }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Friendly validation
    if (!newFieldData.name.trim()) {
      setFormError("Please give your field a friendly name (e.g. 'My Farm Plot 1').");
      return;
    }

    if (!newFieldData.crop.crop_name.trim()) {
      setFormError("Please enter or select a crop name.");
      return;
    }

    if (newFieldData.soil.wilting_point_theta >= newFieldData.soil.field_capacity_theta) {
      setFormError("Soil Wilting Point must be lower than Field Capacity.");
      return;
    }

    setCreateSubmitting(true);
    try {
      await api.createField(newFieldData);
      setIsCreateOpen(false);
      setNewFieldData(DEFAULT_NEW_FIELD);
      setSelectedCropKey("groundnut");
      setCropCategory("dry");
      setSelectedSoilKey("clay_loam");
      setSelectedLocationKey("kurnool");
      setSelectedIrrigationKey("drip");
      setShowAdvancedSettings(false);
      await loadFields();
    } catch (err: any) {
      setFormError(err.message || "Failed to create field.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;
    setFormError(null);
    setEditSubmitting(true);

    try {
      await api.updateField(editingField.id, editData);
      setEditingField(null);
      await loadFields();
    } catch (err: any) {
      setFormError(err.message || "Failed to update field configuration.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingField) return;
    setDeleteSubmitting(true);
    try {
      await api.deleteField(deletingField.id);
      setDeletingField(null);
      await loadFields();
    } catch (err: any) {
      setError(err.message || "Failed to delete field.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Quick calculations for display
  const calculatedTAW = Math.max(
    0,
    1000 *
      (newFieldData.soil.field_capacity_theta - newFieldData.soil.wilting_point_theta) *
      newFieldData.crop.root_depth_m
  );
  const calculatedRAW = calculatedTAW * newFieldData.crop.depletion_fraction_p;

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>Field Management & Farm Profiles</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  Easy Setup
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Add and manage your agricultural lands. AquaSense automatically fills crop root depths, soil parameters, and water thresholds for you!
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={loadFields}
                disabled={loading}
                title="Refresh field directory"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewFieldData(DEFAULT_NEW_FIELD);
                  setSelectedCropKey("groundnut");
                  setSelectedSoilKey("clay_loam");
                  setSelectedLocationKey("kurnool");
                  setSelectedIrrigationKey("drip");
                  setShowAdvancedSettings(false);
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add New Field (Simple Mode)
              </button>
            </div>
          </div>

          {/* Quick Explanatory Banner for Farmers & Normal Users */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    How Field Setup Works (Zero Complex Math Required)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    You only need to tell us your <strong>Crop Name</strong>, <strong>Soil Type</strong>, and <strong>Location</strong>. Our AI & FAO-56 engine automatically fills in root depth ($Z_r$), water capacities, and optimal watering thresholds!
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center space-x-2">
                <Link
                  href="/"
                  className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-xs"
                >
                  <span>Go to Live Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Communication Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Fields Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : fields.length === 0 ? (
            <EmptyState
              icon={<Sprout className="h-7 w-7" />}
              title="No Fields Registered"
              description="Start by adding your farm plot. You can select your crop and soil type in 1 click."
              action={{
                label: "Add Your First Field",
                onClick: () => setIsCreateOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fields.map((field) => {
                const taw = Math.max(
                  0,
                  1000 * (field.field_capacity_theta - field.wilting_point_theta) * field.root_depth_m
                );
                const raw = taw * field.depletion_fraction_p;
                const capacityPercent = (field.field_capacity_theta * 100).toFixed(0);
                const wiltingPercent = (field.wilting_point_theta * 100).toFixed(0);

                return (
                  <div
                    key={field.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition space-y-4"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                            {field.crop_name}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{field.name}</h3>
                          <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              {field.latitude?.toFixed(2)}°N, {field.longitude?.toFixed(2)}°E
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingField(field);
                              setEditData({
                                name: field.name,
                                growth_stage: field.growth_stage as any,
                                kc: field.kc,
                                root_depth_m: field.root_depth_m,
                                depletion_fraction_p: field.depletion_fraction_p,
                                application_efficiency: field.application_efficiency,
                                max_depth_per_event_mm: field.max_depth_per_event_mm,
                              });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title="Edit Field"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingField(field)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete Field"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Friendly Specs */}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Farm Size</span>
                          <span className="font-semibold text-slate-800">
                            {field.area_value} {field.area_unit} ({field.area_m2.toLocaleString()} m²)
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Crop & Growth Stage</span>
                          <span className="font-semibold capitalize text-slate-800">
                            {field.crop_name} ({field.growth_stage})
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Soil Moisture Range</span>
                          <span className="font-semibold text-slate-800">
                            {wiltingPercent}% (Dry) to {capacityPercent}% (Full)
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Soil Type</span>
                          <span className="font-semibold capitalize text-slate-800">
                            {field.soil_texture.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Irrigation Method</span>
                          <span className="font-semibold capitalize text-slate-800">
                            {field.irrigation_method} (
                            {field.application_efficiency != null
                              ? (field.application_efficiency * 100).toFixed(0)
                              : "90"}
                            % efficiency)
                          </span>
                        </div>
                      </div>

                      {/* Plain-English Water Storage Card */}
                      <div className="mt-4 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-950 font-semibold flex items-center gap-1">
                            <Droplets className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Total Water Storage (TAW):</span>
                          </span>
                          <span className="font-bold text-emerald-950">{taw.toFixed(1)} mm</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-950 font-semibold">Watering Threshold (RAW):</span>
                          <span className="font-bold text-emerald-950">{raw.toFixed(1)} mm</span>
                        </div>
                        <p className="text-[10.5px] text-emerald-800 pt-0.5 leading-tight">
                          🌱 Crop is safely watered until it drops below {raw.toFixed(1)} mm of deficit.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>ID: {field.id.slice(0, 8)}...</span>
                      <Link
                        href="/"
                        className="font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                      >
                        <span>View Analytics</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CREATE FIELD MODAL (EASY MODE WITH SMART PRESETS) */}
          {isCreateOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
              <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 sm:my-6 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
                {/* Fixed Top Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0 sticky top-0 z-20">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>Add New Field</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                        Easy Setup Mode
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select your crop, soil, and region. All scientific parameters are configured automatically!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                  {/* Scrollable Form Body */}
                  <div className="overflow-y-auto p-6 space-y-4 text-xs flex-1">
                    {formError && (
                      <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200 flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* 1. Field Name & Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-sm text-slate-900 mb-1.5 flex items-center gap-1.5">
                          <Sprout className="h-4 w-4 text-emerald-600" />
                          <span>1. Field Name *</span>
                          <span className="font-normal text-xs text-slate-500">(Give a friendly name to identify this plot)</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newFieldData.name}
                          onChange={(e) =>
                            setNewFieldData({ ...newFieldData, name: e.target.value })
                          }
                          placeholder="e.g. Kurnool Groundnut Plot 1"
                          className="w-full rounded-lg border-2 border-emerald-500/50 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 p-2.5 text-sm font-semibold text-slate-900 bg-white focus:outline-none shadow-xs"
                        />
                      </div>

                    <div>
                      <label className="block font-semibold text-slate-700">
                        2. Region / Location *
                      </label>
                      <select
                        value={selectedLocationKey}
                        onChange={(e) => handleLocationPresetChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none bg-white"
                      >
                        {Object.entries(LOCATION_PRESETS).map(([k, loc]) => (
                          <option key={k} value={k}>
                            {loc.label}
                          </option>
                        ))}
                        <option value="custom">Custom GPS Coordinates...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">
                        3. Farm Area Size *
                      </label>
                      <div className="mt-1 flex space-x-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          required
                          value={newFieldData.area_value}
                          onChange={(e) =>
                            setNewFieldData({
                              ...newFieldData,
                              area_value: parseFloat(e.target.value) || 1.0,
                            })
                          }
                          className="w-2/3 rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                        />
                        <select
                          value={newFieldData.area_unit}
                          onChange={(e) =>
                            setNewFieldData({ ...newFieldData, area_unit: e.target.value as any })
                          }
                          className="w-1/3 rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none bg-white font-medium"
                        >
                          <option value="hectares">Hectares</option>
                          <option value="square_meters">m² (sq.m)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Custom Lat/Long if user selected Custom */}
                  {selectedLocationKey === "custom" && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <label className="block font-semibold text-slate-700">Latitude (°N)</label>
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={newFieldData.latitude}
                          onChange={(e) =>
                            setNewFieldData({
                              ...newFieldData,
                              latitude: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700">Longitude (°E)</label>
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={newFieldData.longitude}
                          onChange={(e) =>
                            setNewFieldData({
                              ...newFieldData,
                              longitude: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Crop Selection with Dry / Wet Crops Classification & Manual Name Entry */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-800">
                          4. What Crop Are You Cultivating? *
                        </label>
                        <span className="text-[11px] font-medium text-slate-500">
                          Classification: <strong className={cropCategory === "dry" ? "text-amber-700 uppercase" : "text-blue-700 uppercase"}>{cropCategory} Crops</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Choose <strong>Dry Crops</strong> or <strong>Wet Crops</strong> to filter smart agronomic suggestions, or enter your own custom crop name.
                      </p>
                    </div>

                    {/* Feature 1: Dry Crops vs. Wet Crops Toggle Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleCategoryTabChange("dry")}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
                          cropCategory === "dry"
                            ? "bg-amber-500 text-white shadow-xs ring-1 ring-amber-600"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                        }`}
                      >
                        <span className="text-base">🏜️</span>
                        <span>Dry Crops</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            cropCategory === "dry"
                              ? "bg-amber-600/60 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          Arid / Low-Water
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCategoryTabChange("wet")}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
                          cropCategory === "wet"
                            ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-700"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                        }`}
                      >
                        <span className="text-base">💧</span>
                        <span>Wet Crops</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            cropCategory === "wet"
                              ? "bg-blue-700/60 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          Wetland / High-Water
                        </span>
                      </button>
                    </div>

                    {/* Feature 2: Crop Name Input with Suggestions + Manual Entry */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700">
                          Crop Name <span className="font-normal text-slate-400">(Pick suggested or enter manually)</span> *
                        </label>
                        {selectedCropKey === "custom" ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                            Custom Manual Crop
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                            Preset Auto-Filled
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          required
                          list="crop-suggestions-list"
                          value={newFieldData.crop.crop_name}
                          onChange={(e) => handleCropNameManualChange(e.target.value)}
                          placeholder={
                            cropCategory === "dry"
                              ? "e.g. Groundnut, Cotton, Millets, Chickpea, or enter any custom crop..."
                              : "e.g. Rice, Sugarcane, Tomato, Onion, Chilli, or enter any custom crop..."
                          }
                          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white font-medium text-slate-800"
                        />
                        <datalist id="crop-suggestions-list">
                          {Object.values(CROP_PRESETS).map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.label} ({p.category.toUpperCase()} CROP)
                            </option>
                          ))}
                        </datalist>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        💡 You can click any suggested crop below to auto-fill root depth &amp; coefficients, or type any unique crop name directly in the box above.
                      </p>
                    </div>

                    {/* Suggested Crop Options for Selected Category */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Suggested {cropCategory === "dry" ? "Dry (Low-Water)" : "Wet (High-Water)"} Crops
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Click to select &amp; auto-fill
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(CROP_PRESETS)
                          .filter(([_, item]) => item.category === cropCategory)
                          .map(([key, item]) => {
                            const isSelected =
                              selectedCropKey === key ||
                              newFieldData.crop.crop_name.toLowerCase() === item.name.toLowerCase();
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleCropPresetChange(key)}
                                className={`p-2 rounded-xl border text-left transition flex items-center space-x-2 ${
                                  isSelected
                                    ? cropCategory === "dry"
                                      ? "border-amber-600 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-600 shadow-xs"
                                      : "border-blue-600 bg-blue-50 text-blue-950 font-bold ring-1 ring-blue-600 shadow-xs"
                                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                                }`}
                              >
                                <span className="text-xl shrink-0">{item.icon}</span>
                                <div className="truncate">
                                  <p className="truncate text-xs">{item.label}</p>
                                  <p className="text-[10px] text-slate-400 font-normal">
                                    Root: {item.root_depth_m}m · Kc: {item.kc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Notice when custom manual crop is entered */}
                    {selectedCropKey === "custom" && (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
                        <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-950">
                            Custom Crop Entered: &ldquo;{newFieldData.crop.crop_name}&rdquo;
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Initialized with baseline {cropCategory === "dry" ? "Dry Crop (low-water)" : "Wet Crop (high-water)"} agronomic values (Root: {newFieldData.crop.root_depth_m}m, Kc: {newFieldData.crop.kc}). You can adjust these in <em>Advanced Agronomic Parameters</em> below if desired.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Soil Type Selection */}
                  <div className="border-t border-slate-100 pt-3">
                    <label className="block font-semibold text-slate-700">
                      5. What Soil Type Is on Your Farm? *
                    </label>
                    <select
                      value={selectedSoilKey}
                      onChange={(e) => handleSoilPresetChange(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white font-medium text-slate-800"
                    >
                      {Object.entries(SOIL_PRESETS).map(([k, soil]) => (
                        <option key={k} value={k}>
                          {soil.label} — {soil.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Irrigation System */}
                  <div className="border-t border-slate-100 pt-3">
                    <label className="block font-semibold text-slate-700">
                      6. Irrigation Method *
                    </label>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {Object.entries(IRRIGATION_PRESETS).map(([k, irr]) => {
                        const isSelected = selectedIrrigationKey === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleIrrigationPresetChange(k)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-xs"
                                : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs">{irr.label.split("(")[0]}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                {(irr.eff * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                              {irr.badge}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Smart Auto-Calculation Summary Preview */}
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-1.5 text-xs text-emerald-950">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                        <span>Automatic Hydrology Setup Ready</span>
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-800">
                        FAO-56 Validated
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      For <strong>{newFieldData.crop.crop_name}</strong> in{" "}
                      <strong>{newFieldData.soil.soil_texture.replace("_", " ")}</strong>: Root depth is{" "}
                      <strong>{newFieldData.crop.root_depth_m}m</strong>, Total Water Storage is{" "}
                      <strong>{calculatedTAW.toFixed(1)} mm</strong>, and Watering triggers at{" "}
                      <strong>{calculatedRAW.toFixed(1)} mm</strong>.
                    </p>
                  </div>

                  {/* Expandable Advanced Agronomic Section for Researchers / Evaluators */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition py-1"
                    >
                      <Sliders className="h-3.5 w-3.5 text-slate-500" />
                      <span>Advanced Agronomic & FAO-56 Parameters (Optional)</span>
                      {showAdvancedSettings ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </button>

                    {showAdvancedSettings && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <p className="text-[11px] text-slate-500">
                          These parameters are calculated automatically from your selections above. Only modify them if you have exact laboratory measurements.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-slate-600 font-medium">Crop Coeff. (Kc)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newFieldData.crop.kc}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  crop: { ...newFieldData.crop, kc: parseFloat(e.target.value) || 1.15 },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-medium">Root Depth (Zr in m)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={newFieldData.crop.root_depth_m}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  crop: {
                                    ...newFieldData.crop,
                                    root_depth_m: parseFloat(e.target.value) || 0.6,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-medium">Depletion Fraction (p)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={newFieldData.crop.depletion_fraction_p}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  crop: {
                                    ...newFieldData.crop,
                                    depletion_fraction_p: parseFloat(e.target.value) || 0.5,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-medium">Field Capacity (θ_FC)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newFieldData.soil.field_capacity_theta}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  soil: {
                                    ...newFieldData.soil,
                                    field_capacity_theta: parseFloat(e.target.value) || 0.31,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-medium">Wilting Point (θ_WP)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newFieldData.soil.wilting_point_theta}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  soil: {
                                    ...newFieldData.soil,
                                    wilting_point_theta: parseFloat(e.target.value) || 0.15,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-medium">Irrigation Efficiency (η)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newFieldData.application_efficiency}
                              onChange={(e) =>
                                setNewFieldData({
                                  ...newFieldData,
                                  application_efficiency: parseFloat(e.target.value) || 0.9,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  </div>

                  {/* Sticky Actions Footer */}
                  <div className="flex items-center justify-end space-x-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/95 shrink-0 sticky bottom-0 z-20">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createSubmitting}
                      className="px-6 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {createSubmitting ? "Saving Field..." : "Save Field"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT FIELD MODAL */}
          {editingField && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
              <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 sm:my-6 max-h-[calc(100vh-2rem)]">
                {/* Fixed Top Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0 sticky top-0 z-20">
                  <h2 className="text-lg font-bold text-slate-900">
                    Edit Field: {editingField.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                  {/* Scrollable Form Body */}
                  <div className="overflow-y-auto p-6 space-y-4 text-xs flex-1">
                    {formError && (
                      <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                        {formError}
                      </div>
                    )}
                  <div>
                    <label className="block font-semibold text-slate-700">Field Name</label>
                    <input
                      type="text"
                      value={editData.name || ""}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700">Growth Stage</label>
                      <select
                        value={editData.growth_stage || editingField.growth_stage}
                        onChange={(e) =>
                          setEditData({ ...editData, growth_stage: e.target.value as any })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="initial">Initial</option>
                        <option value="development">Development</option>
                        <option value="mid_season">Mid-Season</option>
                        <option value="late_season">Late Season</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Crop Coeff. (Kc)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.15"
                        max="1.45"
                        value={editData.kc !== undefined ? editData.kc : editingField.kc}
                        onChange={(e) =>
                          setEditData({ ...editData, kc: parseFloat(e.target.value) })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Root Depth (Zr in m)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.10"
                        max="3.0"
                        value={
                          editData.root_depth_m !== undefined
                            ? editData.root_depth_m
                            : editingField.root_depth_m
                        }
                        onChange={(e) =>
                          setEditData({ ...editData, root_depth_m: parseFloat(e.target.value) })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Depletion Frac. (p)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.10"
                        max="0.85"
                        value={
                          editData.depletion_fraction_p !== undefined
                            ? editData.depletion_fraction_p
                            : editingField.depletion_fraction_p
                        }
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            depletion_fraction_p: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Application Efficiency</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.30"
                        max="0.98"
                        value={
                          editData.application_efficiency !== undefined
                            ? editData.application_efficiency
                            : editingField.application_efficiency
                        }
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            application_efficiency: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Max Depth/Event (mm)</label>
                      <input
                        type="number"
                        step="1.0"
                        min="5"
                        max="100"
                        value={
                          editData.max_depth_per_event_mm !== undefined
                            ? editData.max_depth_per_event_mm
                            : editingField.max_depth_per_event_mm
                        }
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            max_depth_per_event_mm: parseFloat(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  </div>

                  {/* Sticky Actions Footer */}
                  <div className="flex items-center justify-end space-x-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/95 shrink-0 sticky bottom-0 z-20">
                    <button
                      type="button"
                      onClick={() => setEditingField(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {editSubmitting ? "Updating..." : "Update Field"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION MODAL */}
          {deletingField && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-3 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                  <h3 className="text-base font-bold text-slate-900">Delete Agricultural Field</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-slate-900">{deletingField.name}</strong>? This action
                  will permanently remove all associated sensor observations, weather records,
                  predictions, and precision irrigation recommendations.
                </p>
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeletingField(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteSubmitting}
                    className="px-5 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 transition"
                  >
                    {deleteSubmitting ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
