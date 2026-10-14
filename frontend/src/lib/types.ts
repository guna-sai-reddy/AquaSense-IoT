/**
 * AquaSense-IoT Core TypeScript Interfaces & DTOs
 * Strictly typed against backend FastAPI & SQLAlchemy Schemas
 */

export type DataSourceType =
  | "MEASURED"              // Physical in-situ ground probes
  | "SATELLITE_DERIVED"     // NASA SMAP L3/L4 radiometer retrievals
  | "WEATHER_MODEL_DERIVED" // Open-Meteo ERA5 / Numerical Weather Prediction
  | "PREDICTED"             // AquaSense-IoT machine learning forecasts
  | "SIMULATED";            // Synthetic test fixtures

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_superuser?: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export interface CropConfig {
  crop_name: string;
  growth_stage: "initial" | "development" | "mid_season" | "late_season" | string;
  kc: number;
  root_depth_m: number;
  depletion_fraction_p: number;
}

export interface SoilConfig {
  soil_texture: string;
  field_capacity_theta: number;
  wilting_point_theta: number;
}

export interface Field {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  area_value: number;
  area_unit: "hectares" | "square_meters" | string;
  area_m2: number;
  irrigation_method: "drip" | "sprinkler" | "furrow" | "flood" | "subsurface_drip" | string;
  application_efficiency: number;
  max_depth_per_event_mm: number;
  max_volume_m3?: number | null;
  crop_name: string;
  growth_stage: string;
  kc: number;
  root_depth_m: number;
  depletion_fraction_p: number;
  soil_texture: string;
  field_capacity_theta: number;
  wilting_point_theta: number;
  created_at: string;
  updated_at: string;
}

export interface FieldCreatePayload {
  name: string;
  latitude: number;
  longitude: number;
  area_unit: "hectares" | "square_meters";
  area_value: number;
  irrigation_method: "drip" | "sprinkler" | "furrow" | "flood" | "subsurface_drip";
  application_efficiency: number;
  max_depth_per_event_mm: number;
  max_volume_m3?: number | null;
  crop: CropConfig;
  soil: SoilConfig;
}

export interface FieldUpdatePayload {
  name?: string;
  growth_stage?: "initial" | "development" | "mid_season" | "late_season";
  kc?: number;
  root_depth_m?: number;
  depletion_fraction_p?: number;
  application_efficiency?: number;
  max_depth_per_event_mm?: number;
  max_volume_m3?: number | null;
}

export interface SensorObservation {
  id: string;
  field_id: string;
  device_id: string;
  observation_timestamp_utc: string;
  soil_moisture_m3m3: number;
  soil_temperature_c: number;
  relative_humidity_pct: number;
  depth_cm: number;
  source_type: "MEASURED" | "SIMULATED" | string;
  battery_level_pct?: number | null;
  signal_rssi_dbm?: number | null;
  created_at: string;
}

export interface WeatherObservation {
  id: string;
  field_id: string;
  timestamp_utc: string;
  temperature_2m_c: number;
  relative_humidity_pct: number;
  precipitation_mm: number;
  rain_mm: number;
  surface_pressure_hpa?: number | null;
  et0_fao_mm?: number | null;
  shortwave_radiation_wm2?: number | null;
  wind_speed_kmh?: number | null;
  source_type: string;
  provider: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  field_id: string;
  prediction_timestamp_utc: string;
  target_timestamp_utc: string;
  horizon_hours: number;
  target_variable: string;
  target_depth: string;
  units: string;
  current_moisture_m3m3: number;
  predicted_moisture_m3m3: number;
  projected_change_m3m3: number;
  model_version: string;
  model_name: string;
  input_provenance: string;
  features_json?: string | null;
  created_at: string;
}

export interface PredictionTriggerPayload {
  current_soil_moisture_m3m3?: number | null;
  hour_of_day?: number | null;
  day_of_year?: number | null;
}

export type IrrigationActionType =
  | "IRRIGATE_RECOMMENDED"
  | "IRRIGATION_DEFERRED"
  | "INDETERMINATE";

export interface BaselineComparison {
  conventional_depth_mm: number;
  precision_depth_mm: number;
  water_savings_depth_mm: number;
  water_savings_pct: number;
  rationale: string;
}

export interface IrrigationRecommendation {
  recommendation_id?: string;
  id?: string;
  field_id: string;
  generated_at_utc: string;
  action: IrrigationActionType;
  net_irrigation_depth_mm?: number | null;
  gross_irrigation_depth_mm?: number | null;
  water_volume_m3?: number | null;
  water_volume_liters?: number | null;
  total_available_water_taw_mm?: number | null;
  readily_available_water_raw_mm?: number | null;
  current_depletion_dr_mm?: number | null;
  current_depletion_fraction?: number | null;
  effective_rainfall_considered_mm: number;
  crop_evapotranspiration_etc_mm?: number | null;
  explanations: string[];
  warnings?: string[];
  baseline_comparison?: BaselineComparison | null;
  suggested_timing_window?: string | null;
}

export interface IrrigationTriggerPayload {
  soil_moisture_m3m3?: number | null;
  forecast_rainfall_next_24h_mm?: number;
  forecast_rain_probability_pct?: number;
  forecast_et0_next_24h_mm?: number;
}

export interface SystemStatusResponse {
  project: string;
  api_version: string;
  environment: string;
  services: {
    api_server: string;
    database: {
      status: "healthy" | "unavailable";
      engine: string;
      detail: string;
    };
    ml_engine: {
      artifact_found: boolean;
      artifact_path: string;
      inference_ready: boolean;
      metadata_found: boolean;
      selected_model?: string | null;
      target_horizon: string;
      target_depth: string;
    };
    external_data_sources: {
      open_meteo_archive: string;
      open_meteo_forecast: string;
      nasa_smap_cmr: string;
      nasa_smap_hdf5_download: string;
      in_situ_ground_sensors: string;
    };
  };
}

export interface DatabaseHealthResponse {
  status: "healthy" | "unavailable";
  database: string;
  connected: boolean;
  detail?: string;
  error?: string;
  remedy?: string;
}

export interface SatelliteGranule {
  granule_id: string;
  producer_granule_id: string;
  time_start: string;
  time_end: string;
  download_url: string;
  status: string;
  retrieval_status: string;
  depth: string;
}

export interface SatelliteResponse {
  field_id: string;
  latitude: number;
  longitude: number;
  product_name: string;
  product_version: string;
  spatial_resolution: string;
  measurement_depth: string;
  source_type: string;
  provider: string;
  granule_count: number;
  granules: SatelliteGranule[];
  limitation_note: string;
}

export interface IrrigationEvent {
  id: string;
  field_id: string;
  recommendation_id?: string | null;
  event_timestamp_utc: string;
  actual_volume_m3: number;
  actual_depth_mm: number;
  irrigation_method: string;
  pre_irrigation_sm?: number | null;
  post_irrigation_sm?: number | null;
  execution_status: string;
  operator_notes?: string | null;
}

export interface IrrigationEventCreatePayload {
  recommendation_id?: string | null;
  actual_volume_m3: number;
  actual_depth_mm: number;
  irrigation_method?: string;
  pre_irrigation_sm?: number | null;
  post_irrigation_sm?: number | null;
  execution_status?: string;
  operator_notes?: string | null;
}

export interface SimulationStep {
  timestamp_utc: string;
  observed_soil_moisture_m3m3: number;
  rainfall_mm: number;
  et0_mm: number;
  conventional_depletion_dr_mm: number;
  conventional_irrigated: boolean;
  conventional_depth_mm: number;
  conventional_volume_m3: number;
  predictive_depletion_dr_mm: number;
  predictive_irrigated: boolean;
  predictive_depth_mm: number;
  predictive_volume_m3: number;
  target_moisture_deviation_m3m3: number;
}

export interface ComparativeEvaluationReport {
  field_id: string;
  field_name: string;
  crop_name: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  total_timesteps: number;
  provenance: string;

  taw_mm: number;
  raw_mm: number;
  depletion_fraction_p: number;
  irrigation_efficiency: number;
  field_area_m2: number;
  field_area_ha: number;

  conventional_total_depth_mm: number;
  predictive_total_depth_mm: number;
  conventional_total_volume_m3: number;
  predictive_total_volume_m3: number;
  water_savings_depth_mm: number;
  water_savings_volume_m3: number;
  water_savings_pct: number;

  conventional_event_count: number;
  predictive_event_count: number;
  conventional_events_per_week: number;
  predictive_events_per_week: number;
  mean_days_between_events_conventional: number;
  mean_days_between_events_predictive: number;

  conventional_stress_hours: number;
  predictive_stress_hours: number;
  mean_target_deviation_m3m3: number;
  irrigation_water_productivity_m3_per_ha: number;
  crop_yield_status: string;

  methodology_notes: string[];
  time_series_sample: SimulationStep[];
}

export interface ModelMetricsResponse {
  project: string;
  milestone: string;
  timestamp_created_utc: string;
  target: {
    variable: string;
    description: string;
    depth: string;
    unit: string;
    horizon_hours: number;
  };
  sample_counts: {
    total_clean_samples: number;
    train_samples: number;
    validation_samples: number;
    test_samples: number;
  };
  selected_best_model: string;
  evaluation_metrics: {
    validation: Record<string, { mae: number; rmse: number; r2: number }>;
    test: Record<string, { mae: number; rmse: number; r2: number }>;
  };
  scientific_limitations: string[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  fields_count: number;
}

export interface AdminOverviewStats {
  total_users: number;
  total_fields: number;
  total_sensor_observations: number;
  total_weather_observations: number;
  total_predictions: number;
  total_recommendations: number;
  total_irrigation_events: number;
  server_time_utc: string;
}

export interface AdminField {
  id: string;
  name: string;
  owner_email: string;
  owner_name: string;
  crop_name: string;
  growth_stage: string;
  area_value: number;
  area_unit: string;
  area_m2: number;
  irrigation_method: string;
  latitude: number;
  longitude: number;
  soil_texture?: string;
  field_capacity_theta: number;
  wilting_point_theta: number;
  latest_moisture?: number | null;
  created_at?: string | null;
}

export interface AdminEvent {
  id: string;
  field_id: string;
  field_name: string;
  crop_name: string;
  event_timestamp_utc: string;
  actual_volume_m3: number;
  actual_depth_mm: number;
  irrigation_method: string;
  pre_irrigation_sm?: number | null;
  post_irrigation_sm?: number | null;
  execution_status: string;
  operator_notes?: string | null;
}


