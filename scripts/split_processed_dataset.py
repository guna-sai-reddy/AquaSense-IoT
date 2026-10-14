"""AquaSense-IoT Dataset Splitting Utility.

Divides data/processed_data.csv (63 columns) into two distinct files:
1. data/processed_dataset.csv: The base cleaned multi-source telemetry & observation records (46 columns).
2. data/features_columns.csv: The engineered hydrological, autoregressive lag, rolling flux, and cyclical time features (17 columns).
Also outputs data/features_data.csv: The engineered features with primary key alignment columns (timestamp_utc, field_id, latitude, longitude) for relational joining.
"""

from pathlib import Path
import pandas as pd

def split_processed_dataset():
    data_dir = Path("data")
    processed_file = data_dir / "processed_data.csv"

    if not processed_file.exists():
        raise FileNotFoundError(f"Source processed dataset not found at {processed_file}")

    print(f"Loading {processed_file}...")
    df = pd.read_csv(processed_file)
    print(f"Total rows: {len(df):,}, Total columns: {len(df.columns)}")

    # 46 base processed observation columns
    base_cols = [
        "timestamp_utc", "latitude", "longitude", "field_id", "device_id",
        "soil_moisture_0_to_7cm", "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm",
        "soil_temperature_0_to_7cm", "soil_temperature_7_to_28cm", "probe_humidity_pct",
        "probe_depth_cm", "battery_level_pct", "signal_rssi_dbm", "ground_source_type",
        "temperature_2m", "relative_humidity_2m", "precipitation", "rain", "surface_pressure",
        "et0_fao_evapotranspiration", "shortwave_radiation_instant", "wind_speed_10m",
        "weather_source_type", "weather_provider", "crop_name", "growth_stage",
        "crop_coefficient_kc", "root_depth_m", "depletion_fraction_p", "soil_texture",
        "field_capacity_theta", "wilting_point_theta", "management_allowed_depletion_mad",
        "irrigation_method", "application_efficiency", "area_hectares",
        "smap_soil_moisture_m3m3", "smap_surface_temp_c", "vegetation_water_content_kgm2",
        "ndvi", "ndwi", "retrieval_qual_flag", "orbit_pass", "satellite_product",
        "satellite_source_type"
    ]

    # 17 engineered feature columns
    feature_cols = [
        "awc_theta", "taw_mm", "raw_mm", "root_zone_depletion_dr_mm",
        "irrigation_needed_flag", "smap_probe_sm_delta", "target_24h",
        "sm_root_lag_1h", "sm_root_lag_3h", "sm_root_lag_6h", "sm_root_lag_24h",
        "et0_rolling_24h_sum_mm", "precip_rolling_6h_sum_mm", "precip_rolling_24h_sum_mm",
        "hour_sin", "hour_cos", "day_of_year"
    ]

    # Verification
    assert set(base_cols + feature_cols) == set(df.columns), "Column sets do not match processed_data.csv exactly"

    # 1. Base Processed Dataset
    processed_df = df[base_cols]
    processed_out = data_dir / "processed_dataset.csv"
    processed_df.to_csv(processed_out, index=False)
    print(f"[OK] Saved base processed dataset to: {processed_out} ({len(processed_df)} rows, {len(processed_df.columns)} columns)")

    # 2. Features Columns Dataset (Pure features)
    features_cols_df = df[feature_cols]
    features_cols_out = data_dir / "features_columns.csv"
    features_cols_df.to_csv(features_cols_out, index=False)
    print(f"[OK] Saved feature columns dataset to: {features_cols_out} ({len(features_cols_df)} rows, {len(features_cols_df.columns)} columns)")

    # 3. Features with Alignment Keys (timestamp_utc, field_id, latitude, longitude + features)
    key_cols = ["timestamp_utc", "field_id", "latitude", "longitude"]
    features_with_keys_df = df[key_cols + feature_cols]
    features_data_out = data_dir / "features_data.csv"
    features_with_keys_df.to_csv(features_data_out, index=False)
    print(f"[OK] Saved features with keys dataset to: {features_data_out} ({len(features_with_keys_df)} rows, {len(features_with_keys_df.columns)} columns)")

if __name__ == "__main__":
    split_processed_dataset()
