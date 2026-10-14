"""AquaSense-IoT Comprehensive Data Generation, Merging, and Preprocessing Pipeline.

Generates 4 distinct raw datasets (~10,000 rows each) with common latitude & longitude columns:
1. Ground probe sensor data
2. Weather data
3. Crop and field data
4. Satellite and remote-sensing data

Merges them on (latitude, longitude, timestamp_utc) into merged_raw_data.csv.
Cleans and preprocesses the merged dataset (handling duplicates, missing values,
outlier detection & physical bounds, hydrological feature engineering) into processed_data.csv.
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd

def generate_datasets(target_rows: int = 10000, random_seed: int = 42):
    np.random.seed(random_seed)
    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)

    # 1. Coordinate & Timestamp Foundation (10,000 sequential hourly observations across agricultural fields)
    base_lat = 15.8281
    base_lon = 78.0373
    start_time = pd.Timestamp("2024-01-01 00:00:00", tz="UTC")
    timestamps = [start_time + pd.Timedelta(hours=i) for i in range(target_rows)]
    
    # 5 agricultural monitoring plots around Kurnool
    plots = [
        {"field_id": "fld_kurnool_01", "name": "Kurnool Groundnut Plot 1", "lat": base_lat, "lon": base_lon, "crop": "groundnut", "soil": "Sandy Loam", "area": 4.5},
        {"field_id": "fld_kurnool_02", "name": "Precision Research Plot A", "lat": base_lat + 0.0015, "lon": base_lon - 0.0018, "crop": "groundnut", "soil": "Loam", "area": 3.2},
        {"field_id": "fld_kurnool_03", "name": "Kurnool Cotton Sector B", "lat": 15.8272, "lon": 78.0383, "crop": "cotton", "soil": "Clay Loam", "area": 5.8},
        {"field_id": "fld_kurnool_04", "name": "Tomato Precision Block", "lat": base_lat - 0.0025, "lon": base_lon + 0.0012, "crop": "tomato", "soil": "Sandy Clay Loam", "area": 2.1},
        {"field_id": "fld_kurnool_05", "name": "Maize Water-Deficit Zone", "lat": base_lat + 0.0030, "lon": base_lon + 0.0025, "crop": "maize", "soil": "Silt Loam", "area": 6.0},
    ]

    # Assign each timestamp row to a field in rotating blocks/sequence
    field_indices = np.random.choice(len(plots), size=target_rows, p=[0.35, 0.25, 0.15, 0.15, 0.10])
    lats = [plots[idx]["lat"] for idx in field_indices]
    lons = [plots[idx]["lon"] for idx in field_indices]
    f_ids = [plots[idx]["field_id"] for idx in field_indices]
    c_names = [plots[idx]["crop"] for idx in field_indices]
    s_textures = [plots[idx]["soil"] for idx in field_indices]
    areas = [plots[idx]["area"] for idx in field_indices]

    # Base seasonal & diurnal cycle simulation
    hours = np.array([ts.hour for ts in timestamps])
    day_of_year = np.array([ts.dayofyear for ts in timestamps])
    diurnal_cycle = np.sin((hours - 8) * np.pi / 12.0)
    seasonal_temp = 28.0 + 7.0 * np.sin((day_of_year - 80) * 2 * np.pi / 365.25)
    
    # Air temperature (°C)
    air_temp = seasonal_temp + 5.0 * diurnal_cycle + np.random.normal(0, 1.5, size=target_rows)
    air_temp = np.clip(air_temp, 12.0, 46.0)

    # Relative humidity (%) (inversely related to temperature)
    humidity = 85.0 - (air_temp - 15.0) * 1.8 + np.random.normal(0, 4.0, size=target_rows)
    humidity = np.clip(humidity, 15.0, 98.0)

    # Atmospheric pressure (hPa)
    surface_pressure = 982.0 + np.random.normal(0, 2.5, size=target_rows)

    # Solar radiation (W/m2)
    solar_rad = np.where(diurnal_cycle > 0, diurnal_cycle * 850.0 + np.random.normal(0, 30.0, size=target_rows), 0.0)
    solar_rad = np.clip(solar_rad, 0.0, 1100.0)

    # Wind speed (km/h)
    wind_speed = np.abs(np.random.normal(7.5, 3.5, size=target_rows))

    # Precipitation (mm) (sporadic events)
    precip_prob = np.random.random(size=target_rows)
    precipitation = np.where(precip_prob > 0.95, np.random.exponential(4.0, size=target_rows), 0.0)
    precipitation = np.round(precipitation, 2)
    rain = precipitation.copy()

    # FAO-56 Penman-Monteith ET0 estimate (mm/hr)
    et0 = np.maximum(0.0, (0.0023 * (air_temp + 17.8) * np.sqrt(np.maximum(1.0, air_temp - 15.0)) * (solar_rad / 250.0 + 0.1)) / 24.0)
    et0 = np.round(et0, 4)

    # Hydrological soil moisture dynamics
    # baseline volumetric water content around 0.22 - 0.32
    sm_root_base = 0.27 + 0.05 * np.sin((day_of_year - 150) * 2 * np.pi / 365.25)
    # cumulative water balance impulse
    sm_variation = np.zeros(target_rows)
    curr_v = 0.27
    for i in range(target_rows):
        inflow = precipitation[i] * 0.015
        outflow = et0[i] * 0.02
        curr_v = np.clip(curr_v + inflow - outflow + np.random.normal(0, 0.001), 0.12, 0.42)
        sm_variation[i] = curr_v

    sm_root = sm_variation
    sm_surface = np.clip(sm_root + (precipitation > 0) * 0.06 - (solar_rad > 300) * 0.03 + np.random.normal(0, 0.005, size=target_rows), 0.08, 0.45)
    sm_deep = np.clip(sm_root * 0.95 + 0.03 + np.random.normal(0, 0.003, size=target_rows), 0.15, 0.40)

    soil_temp_surf = air_temp + diurnal_cycle * 2.5 + np.random.normal(0, 1.0, size=target_rows)
    soil_temp_root = seasonal_temp + diurnal_cycle * 0.8 + np.random.normal(0, 0.5, size=target_rows)

    # -------------------------------------------------------------------------
    # DATASET 1: Ground Probe Sensor Data (~10,000 rows)
    # -------------------------------------------------------------------------
    ground_df = pd.DataFrame({
        "timestamp_utc": [ts.isoformat() for ts in timestamps],
        "latitude": lats,
        "longitude": lons,
        "field_id": f_ids,
        "device_id": [f"PROBE_{fid[-2:]}_{i%10:02d}" for i, fid in enumerate(f_ids)],
        "soil_moisture_0_to_7cm": np.round(sm_surface, 4),
        "soil_moisture_7_to_28cm": np.round(sm_root, 4),
        "soil_moisture_28_to_100cm": np.round(sm_deep, 4),
        "soil_temperature_0_to_7cm": np.round(soil_temp_surf, 2),
        "soil_temperature_7_to_28cm": np.round(soil_temp_root, 2),
        "probe_humidity_pct": np.round(humidity + np.random.normal(0, 2.0, size=target_rows), 2),
        "probe_depth_cm": 20.0,
        "battery_level_pct": np.round(np.clip(98.0 - (np.arange(target_rows) / target_rows) * 15.0 + np.random.normal(0, 1.0, size=target_rows), 10.0, 100.0), 1),
        "signal_rssi_dbm": np.random.randint(-85, -60, size=target_rows),
        "source_type": "MEASURED",
    })

    # -------------------------------------------------------------------------
    # DATASET 2: Weather Data (~10,000 rows)
    # -------------------------------------------------------------------------
    weather_df = pd.DataFrame({
        "timestamp_utc": [ts.isoformat() for ts in timestamps],
        "latitude": lats,
        "longitude": lons,
        "temperature_2m": np.round(air_temp, 2),
        "relative_humidity_2m": np.round(humidity, 2),
        "precipitation": np.round(precipitation, 2),
        "rain": np.round(rain, 2),
        "surface_pressure": np.round(surface_pressure, 2),
        "et0_fao_evapotranspiration": np.round(et0, 4),
        "shortwave_radiation_instant": np.round(solar_rad, 2),
        "wind_speed_10m": np.round(wind_speed, 2),
        "source_type": "WEATHER_MODEL_DERIVED",
        "provider": "Open-Meteo ERA5 Reanalysis",
    })

    # -------------------------------------------------------------------------
    # DATASET 3: Crop and Field Data (~10,000 rows)
    # -------------------------------------------------------------------------
    # FAO-56 parameters mapping
    crop_info = {
        "groundnut": {"kc": 0.85, "root_depth": 0.6, "p": 0.50, "stage": "Flowering/Pegging"},
        "cotton": {"kc": 0.95, "root_depth": 1.0, "p": 0.65, "stage": "Boll Formation"},
        "tomato": {"kc": 1.05, "root_depth": 0.7, "p": 0.40, "stage": "Fruit Development"},
        "maize": {"kc": 1.15, "root_depth": 0.9, "p": 0.55, "stage": "Grain Filling"},
    }
    soil_hydraulics = {
        "Sandy Loam": {"fc": 0.23, "wp": 0.10},
        "Loam": {"fc": 0.28, "wp": 0.14},
        "Clay Loam": {"fc": 0.32, "wp": 0.18},
        "Sandy Clay Loam": {"fc": 0.29, "wp": 0.15},
        "Silt Loam": {"fc": 0.30, "wp": 0.13},
    }

    kc_vals = [crop_info[c]["kc"] for c in c_names]
    root_depths = [crop_info[c]["root_depth"] for c in c_names]
    p_fractions = [crop_info[c]["p"] for c in c_names]
    stages = [crop_info[c]["stage"] for c in c_names]
    fc_vals = [soil_hydraulics[s]["fc"] for s in s_textures]
    wp_vals = [soil_hydraulics[s]["wp"] for s in s_textures]

    crop_df = pd.DataFrame({
        "timestamp_utc": [ts.isoformat() for ts in timestamps],
        "latitude": lats,
        "longitude": lons,
        "field_id": f_ids,
        "crop_name": c_names,
        "growth_stage": stages,
        "crop_coefficient_kc": kc_vals,
        "root_depth_m": root_depths,
        "depletion_fraction_p": p_fractions,
        "soil_texture": s_textures,
        "field_capacity_theta": fc_vals,
        "wilting_point_theta": wp_vals,
        "management_allowed_depletion_mad": [round((fc - wp) * p, 4) for fc, wp, p in zip(fc_vals, wp_vals, p_fractions)],
        "irrigation_method": ["drip" if c in ["tomato", "groundnut"] else "sprinkler" for c in c_names],
        "application_efficiency": [0.90 if c in ["tomato", "groundnut"] else 0.80 for c in c_names],
        "area_hectares": areas,
    })

    # -------------------------------------------------------------------------
    # DATASET 4: Satellite and Remote-Sensing Data (~10,000 rows)
    # -------------------------------------------------------------------------
    # SMAP retrievals & Optical remote sensing (NDVI, NDWI)
    smap_sm = np.clip(sm_surface + np.random.normal(0, 0.015, size=target_rows), 0.05, 0.50)
    ndvi = np.clip(0.45 + 0.25 * np.sin((day_of_year - 100) * 2 * np.pi / 365.25) + np.random.normal(0, 0.03, size=target_rows), 0.15, 0.88)
    ndwi = np.clip(0.10 + 0.15 * (sm_root - 0.25) + np.random.normal(0, 0.02, size=target_rows), -0.2, 0.45)
    veg_water_content = np.round(ndvi * 4.2 + np.random.normal(0, 0.2, size=target_rows), 2)
    smap_surface_temp = np.round(soil_temp_surf + np.random.normal(0, 1.2, size=target_rows), 2)
    
    satellite_df = pd.DataFrame({
        "timestamp_utc": [ts.isoformat() for ts in timestamps],
        "latitude": lats,
        "longitude": lons,
        "smap_soil_moisture_m3m3": np.round(smap_sm, 4),
        "smap_surface_temp_c": smap_surface_temp,
        "vegetation_water_content_kgm2": veg_water_content,
        "ndvi": np.round(ndvi, 4),
        "ndwi": np.round(ndwi, 4),
        "retrieval_qual_flag": np.random.choice([0, 1], size=target_rows, p=[0.92, 0.08]), # 0=recommended, 1=uncertain
        "orbit_pass": np.random.choice(["Ascending (6 PM)", "Descending (6 AM)"], size=target_rows),
        "satellite_product": "NASA SMAP SPL3SMP_E 9km & Sentinel-2",
        "source_type": "SATELLITE_DERIVED",
    })

    # -------------------------------------------------------------------------
    # Introduce Realistic Raw Data Imperfections (Duplicates, Nulls, Outliers)
    # -------------------------------------------------------------------------
    # 1. Null values (~1% in sensor and weather readings)
    null_idx_sm = np.random.choice(target_rows, size=100, replace=False)
    ground_df.loc[null_idx_sm[:50], "soil_moisture_7_to_28cm"] = np.nan
    ground_df.loc[null_idx_sm[50:], "soil_temperature_7_to_28cm"] = np.nan

    null_idx_weather = np.random.choice(target_rows, size=80, replace=False)
    weather_df.loc[null_idx_weather[:40], "relative_humidity_2m"] = np.nan
    weather_df.loc[null_idx_weather[40:], "wind_speed_10m"] = np.nan

    null_idx_sat = np.random.choice(target_rows, size=60, replace=False)
    satellite_df.loc[null_idx_sat, "smap_soil_moisture_m3m3"] = np.nan

    # 2. Outliers (e.g. sensor probe glitch reading -999.0 or 999.0, extreme spikes)
    outlier_idx_sm = np.random.choice(target_rows, size=15, replace=False)
    ground_df.loc[outlier_idx_sm[:5], "soil_moisture_7_to_28cm"] = -999.0  # probe wire disconnect error code
    ground_df.loc[outlier_idx_sm[5:10], "soil_moisture_7_to_28cm"] = 9.99   # decimal overflow glitch
    ground_df.loc[outlier_idx_sm[10:], "soil_temperature_0_to_7cm"] = 150.0 # thermal surge spike

    outlier_idx_weather = np.random.choice(target_rows, size=10, replace=False)
    weather_df.loc[outlier_idx_weather[:5], "temperature_2m"] = 85.0       # uncalibrated sensor spike
    weather_df.loc[outlier_idx_weather[5:], "relative_humidity_2m"] = -50.0 # negative humidity fault

    # 3. Duplicate rows (~30 duplicates)
    dup_indices = np.random.choice(target_rows, size=30, replace=False)
    ground_df = pd.concat([ground_df, ground_df.iloc[dup_indices]], ignore_index=True)
    weather_df = pd.concat([weather_df, weather_df.iloc[dup_indices]], ignore_index=True)
    crop_df = pd.concat([crop_df, crop_df.iloc[dup_indices]], ignore_index=True)
    satellite_df = pd.concat([satellite_df, satellite_df.iloc[dup_indices]], ignore_index=True)

    # Export the 4 Raw Datasets
    ground_probe_path = data_dir / "ground_probe_sensor_data.csv"
    weather_path = data_dir / "weather_data.csv"
    crop_path = data_dir / "crop_field_data.csv"
    satellite_path = data_dir / "satellite_remote_sensing_data.csv"

    ground_df.to_csv(ground_probe_path, index=False)
    weather_df.to_csv(weather_path, index=False)
    crop_df.to_csv(crop_path, index=False)
    satellite_df.to_csv(satellite_path, index=False)

    print(f"[OK] Saved {ground_probe_path} ({len(ground_df)} rows)")
    print(f"[OK] Saved {weather_path} ({len(weather_df)} rows)")
    print(f"[OK] Saved {crop_path} ({len(crop_df)} rows)")
    print(f"[OK] Saved {satellite_path} ({len(satellite_df)} rows)")

    # -------------------------------------------------------------------------
    # MERGE DATASETS ON LATITUDE AND LONGITUDE (and timestamp_utc)
    # -------------------------------------------------------------------------
    # Merge keys: latitude, longitude, timestamp_utc
    merge_keys = ["latitude", "longitude", "timestamp_utc"]
    
    # Prefix or handle duplicate column names (like source_type or field_id)
    ground_sub = ground_df.rename(columns={"source_type": "ground_source_type"})
    weather_sub = weather_df.rename(columns={"source_type": "weather_source_type", "provider": "weather_provider"})
    crop_sub = crop_df.drop(columns=["field_id"]) # avoid duplicate field_id
    satellite_sub = satellite_df.rename(columns={"source_type": "satellite_source_type"})

    # Perform multi-source merge
    merged_raw_df = ground_sub.merge(weather_sub, on=merge_keys, how="inner")
    merged_raw_df = merged_raw_df.merge(crop_sub, on=merge_keys, how="inner")
    merged_raw_df = merged_raw_df.merge(satellite_sub, on=merge_keys, how="inner")

    merged_raw_path = data_dir / "merged_raw_data.csv"
    merged_raw_df.to_csv(merged_raw_path, index=False)
    print(f"[OK] Saved {merged_raw_path} ({len(merged_raw_df)} rows, {len(merged_raw_df.columns)} columns)")

    # -------------------------------------------------------------------------
    # DATA CLEANING & PROCESSING PIPELINE
    # -------------------------------------------------------------------------
    print("\n--- Running Data Cleaning and Preprocessing ---")
    processed_df = merged_raw_df.copy()

    # Step 1: Duplicate handling
    initial_len = len(processed_df)
    processed_df.drop_duplicates(subset=merge_keys, keep="first", inplace=True)
    duplicates_removed = initial_len - len(processed_df)
    print(f"  [1] Removed {duplicates_removed} duplicate rows.")

    # Step 2: Outlier detection & remediation (Domain bounds + Statistical IQR)
    print("  [2] Outlier detection and domain bounds filtering:")
    
    # Physical domain constraints for precision agriculture
    # Soil moisture volumetric fraction must be in [0.02, 0.60] m3/m3
    sm_cols = ["soil_moisture_0_to_7cm", "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm", "smap_soil_moisture_m3m3"]
    for col in sm_cols:
        invalid_mask = (processed_df[col] < 0.02) | (processed_df[col] > 0.60)
        n_inv = invalid_mask.sum()
        if n_inv > 0:
            print(f"      - {col}: flagged and set {n_inv} impossible outliers to NaN (bounds [0.02, 0.60])")
            processed_df.loc[invalid_mask, col] = np.nan

    # Temperature bounds [-5°C, 55°C]
    temp_cols = ["temperature_2m", "soil_temperature_0_to_7cm", "soil_temperature_7_to_28cm", "smap_surface_temp_c"]
    for col in temp_cols:
        invalid_mask = (processed_df[col] < -5.0) | (processed_df[col] > 55.0)
        n_inv = invalid_mask.sum()
        if n_inv > 0:
            print(f"      - {col}: flagged and set {n_inv} thermal outliers to NaN (bounds [-5, 55] °C)")
            processed_df.loc[invalid_mask, col] = np.nan

    # Relative humidity [0, 100]%
    for col in ["relative_humidity_2m", "probe_humidity_pct"]:
        invalid_mask = (processed_df[col] < 0.0) | (processed_df[col] > 100.0)
        n_inv = invalid_mask.sum()
        if n_inv > 0:
            print(f"      - {col}: flagged and set {n_inv} humidity outliers to NaN (bounds [0, 100] %)")
            processed_df.loc[invalid_mask, col] = np.nan

    # Step 3: Missing Value / Null Imputation
    print("  [3] Missing value imputation:")
    nulls_before = processed_df.isna().sum().sum()
    print(f"      Total missing values before imputation: {nulls_before}")

    # Chronological forward/backward fill for time-series continuity within fields
    processed_df["dt"] = pd.to_datetime(processed_df["timestamp_utc"], utc=True)
    processed_df.sort_values(by=["field_id", "dt"], inplace=True)
    
    numeric_cols = processed_df.select_dtypes(include=[np.number]).columns
    # Grouped interpolation / ffill / bfill
    processed_df[numeric_cols] = processed_df.groupby("field_id")[numeric_cols].transform(
        lambda grp: grp.ffill().bfill()
    )
    # Global median fill as safety fallback
    for col in numeric_cols:
        if processed_df[col].isna().any():
            median_val = processed_df[col].median()
            processed_df[col].fillna(median_val, inplace=True)

    nulls_after = processed_df.isna().sum().sum()
    print(f"      Total missing values after imputation: {nulls_after}")

    # Step 4: Hydrological & Precision Irrigation Feature Engineering
    print("  [4] Precision irrigation & hydrological feature engineering:")
    
    # FAO-56 Available Water Capacity (AWC = FC - WP)
    processed_df["awc_theta"] = np.round(processed_df["field_capacity_theta"] - processed_df["wilting_point_theta"], 4)
    
    # Total Available Water in Root Zone: TAW (mm) = 1000 * (FC - WP) * Zr
    processed_df["taw_mm"] = np.round(1000.0 * processed_df["awc_theta"] * processed_df["root_depth_m"], 2)
    
    # Readily Available Water: RAW (mm) = p * TAW
    processed_df["raw_mm"] = np.round(processed_df["depletion_fraction_p"] * processed_df["taw_mm"], 2)
    
    # Current Root-Zone Depletion: Dr (mm) = 1000 * (FC - theta_root) * Zr
    processed_df["root_zone_depletion_dr_mm"] = np.round(
        np.maximum(0.0, 1000.0 * (processed_df["field_capacity_theta"] - processed_df["soil_moisture_7_to_28cm"]) * processed_df["root_depth_m"]),
        2
    )

    # Irrigation Stress Indicator: 1 if Dr > RAW, else 0
    processed_df["irrigation_needed_flag"] = (processed_df["root_zone_depletion_dr_mm"] > processed_df["raw_mm"]).astype(int)

    # Satellite-Ground Fusion Residual: Delta between SMAP and in-situ probe
    processed_df["smap_probe_sm_delta"] = np.round(processed_df["smap_soil_moisture_m3m3"] - processed_df["soil_moisture_0_to_7cm"], 4)

    # Autoregressive Lag Features for Model Training
    processed_df.sort_values(by="dt", inplace=True)
    processed_df.reset_index(drop=True, inplace=True)
    
    # Horizon 24h prediction target
    processed_df["target_24h"] = processed_df.groupby("field_id")["soil_moisture_7_to_28cm"].shift(-24)

    # 1h, 3h, 6h, 24h lags
    processed_df["sm_root_lag_1h"] = processed_df.groupby("field_id")["soil_moisture_7_to_28cm"].shift(1)
    processed_df["sm_root_lag_3h"] = processed_df.groupby("field_id")["soil_moisture_7_to_28cm"].shift(3)
    processed_df["sm_root_lag_6h"] = processed_df.groupby("field_id")["soil_moisture_7_to_28cm"].shift(6)
    processed_df["sm_root_lag_24h"] = processed_df.groupby("field_id")["soil_moisture_7_to_28cm"].shift(24)

    # Fill lag boundaries with current moisture
    for lag_col in ["sm_root_lag_1h", "sm_root_lag_3h", "sm_root_lag_6h", "sm_root_lag_24h"]:
        processed_df[lag_col].fillna(processed_df["soil_moisture_7_to_28cm"], inplace=True)
        processed_df[lag_col] = np.round(processed_df[lag_col], 4)

    # If target_24h is NaN at the end of the series, backward-fill with latest valid target
    processed_df["target_24h"].fillna(processed_df["soil_moisture_7_to_28cm"], inplace=True)
    processed_df["target_24h"] = np.round(processed_df["target_24h"], 4)

    # Rolling fluxes
    processed_df["et0_rolling_24h_sum_mm"] = processed_df.groupby("field_id")["et0_fao_evapotranspiration"].rolling(24, min_periods=1).sum().reset_index(drop=True)
    processed_df["precip_rolling_6h_sum_mm"] = processed_df.groupby("field_id")["precipitation"].rolling(6, min_periods=1).sum().reset_index(drop=True)
    processed_df["precip_rolling_24h_sum_mm"] = processed_df.groupby("field_id")["precipitation"].rolling(24, min_periods=1).sum().reset_index(drop=True)

    # Cyclical temporal encoding
    hours_arr = processed_df["dt"].dt.hour
    processed_df["hour_sin"] = np.round(np.sin(2 * np.pi * hours_arr / 24.0), 4)
    processed_df["hour_cos"] = np.round(np.cos(2 * np.pi * hours_arr / 24.0), 4)
    processed_df["day_of_year"] = np.round(processed_df["dt"].dt.dayofyear / 365.25, 4)

    # Drop temporary datetime column before saving
    processed_df.drop(columns=["dt"], inplace=True)

    # Step 5: Save Processed Dataset
    processed_path = data_dir / "processed_data.csv"
    processed_df.to_csv(processed_path, index=False)
    print(f"[OK] Saved {processed_path} ({len(processed_df)} rows, {len(processed_df.columns)} columns)")
    print("\nDataset generation and processing completed successfully!")

if __name__ == "__main__":
    generate_datasets()
