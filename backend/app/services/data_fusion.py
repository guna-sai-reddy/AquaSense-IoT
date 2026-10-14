"""AquaSense-IoT Multi-Source Spatiotemporal Data Fusion Engine.

Fuses:
1. Hourly Meteorological Reanalysis (Open-Meteo ERA5 Land - continuous 1h, ~9-25 km)
2. Satellite Passive Microwave Radiometry (NASA SMAP SPL3SMP_E - sparse 1-3 days, 9 km)
3. In-situ IoT Ground Probes (Continuous calibrated point measurements)

Rules:
- Enforces strict data provenance tags on every variable.
- Preserves discrete source columns rather than overwriting or collapsing differing observations.
- Matches each discrete observation to its single nearest hourly timestep without fabricating missing values.
- Never interpolates across unobserved satellite passes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Alignment Matching Thresholds
DEFAULT_SATELLITE_TIME_WINDOW_MINUTES = 180  # +/- 3 hours for instantaneous satellite pass
DEFAULT_SENSOR_TIME_WINDOW_MINUTES = 30       # +/- 30 minutes for hourly in-situ sensors


class FusionReport(BaseModel):
    """Diagnostic report documenting fusion coverage and matching metrics."""
    total_hourly_steps: int
    steps_with_satellite_match: int
    steps_with_ground_sensor_match: int
    steps_fully_fused: int
    satellite_coverage_pct: float
    sensor_coverage_pct: float
    unmatched_satellite_observations: int
    missing_value_summary: Dict[str, int]
    alignment_limitations: List[str]


class DataFusionEngine:
    """Spatiotemporally joins diverse hydrological data streams."""

    def __init__(
        self,
        satellite_time_window_mins: int = DEFAULT_SATELLITE_TIME_WINDOW_MINUTES,
        sensor_time_window_mins: int = DEFAULT_SENSOR_TIME_WINDOW_MINUTES,
    ):
        self.satellite_time_window = timedelta(minutes=satellite_time_window_mins)
        self.sensor_time_window = timedelta(minutes=sensor_time_window_mins)

    def fuse_datasets(
        self,
        weather_df: pd.DataFrame,
        satellite_df: Optional[pd.DataFrame] = None,
        ground_sensor_df: Optional[pd.DataFrame] = None,
    ) -> Tuple[pd.DataFrame, FusionReport]:
        """Aligns and fuses weather, satellite, and ground datasets into an analysis-ready matrix."""
        if weather_df.empty:
            raise ValueError("Base weather dataset cannot be empty for fusion.")

        # Ensure base weather dataframe has datetime index
        fused = weather_df.copy()
        if "timestamp_utc" not in fused.columns:
            raise ValueError("weather_df must contain 'timestamp_utc' column.")

        fused["dt"] = pd.to_datetime(fused["timestamp_utc"], utc=True)
        fused.sort_values(by="dt", inplace=True)
        fused.reset_index(drop=True, inplace=True)

        # Prefix weather columns to maintain explicit provenance
        rename_map = {}
        for col in [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "rain",
            "surface_pressure",
            "et0_fao_evapotranspiration",
            "shortwave_radiation_instant",
            "wind_speed_10m",
            "soil_temperature_0_to_7cm",
            "soil_temperature_7_to_28cm",
            "soil_moisture_0_to_7cm",
            "soil_moisture_7_to_28cm",
            "soil_moisture_28_to_100cm",
            "soil_moisture_100_to_255cm",
        ]:
            if col in fused.columns:
                rename_map[col] = f"weather_era5_{col}"
        fused.rename(columns=rename_map, inplace=True)

        # Initialize Satellite Columns with NaN / null (NO synthetic fabrication)
        fused["satellite_soil_moisture_smap_m3m3"] = np.nan
        fused["satellite_retrieval_qual_flag"] = np.nan
        fused["satellite_is_valid_quality"] = None
        fused["satellite_offset_minutes"] = np.nan
        fused["satellite_granule_id"] = None

        sat_matches = 0
        unmatched_sat_count = 0

        # 1. Align Satellite Observations: Each satellite pass matches to its SINGLE closest hourly timestep
        if satellite_df is not None and not satellite_df.empty:
            sat_work = satellite_df.copy()
            sat_work["dt"] = pd.to_datetime(sat_work["timestamp_utc"], utc=True)
            matched_sat_count = 0

            for _, sat_row in sat_work.iterrows():
                sat_time = sat_row["dt"]
                time_diffs = (fused["dt"] - sat_time).abs()
                min_diff_idx = time_diffs.idxmin()
                min_diff = time_diffs.loc[min_diff_idx]

                if min_diff <= self.satellite_time_window:
                    # Assign to the single nearest hourly timestep
                    fused.at[min_diff_idx, "satellite_soil_moisture_smap_m3m3"] = sat_row["soil_moisture_smap_m3m3"]
                    fused.at[min_diff_idx, "satellite_retrieval_qual_flag"] = sat_row["retrieval_qual_flag"]
                    fused.at[min_diff_idx, "satellite_is_valid_quality"] = sat_row.get("is_valid_quality", True)
                    fused.at[min_diff_idx, "satellite_offset_minutes"] = round(
                        (sat_time - fused.loc[min_diff_idx, "dt"]).total_seconds() / 60.0, 1
                    )
                    fused.at[min_diff_idx, "satellite_granule_id"] = sat_row.get("granule_id")
                    matched_sat_count += 1
                else:
                    unmatched_sat_count += 1

            sat_matches = fused["satellite_soil_moisture_smap_m3m3"].notna().sum()

        # 2. Align Ground Sensor Telemetry: Each sensor reading matches to its SINGLE closest hourly timestep
        fused["sensor_measured_soil_moisture_m3m3"] = np.nan
        fused["sensor_measured_soil_temperature_c"] = np.nan
        fused["sensor_measured_relative_humidity_pct"] = np.nan
        fused["sensor_measured_depth_cm"] = np.nan
        fused["sensor_device_id"] = None

        if ground_sensor_df is not None and not ground_sensor_df.empty:
            sensor_work = ground_sensor_df.copy()
            # Only fuse MEASURED readings (exclude test fixtures)
            if "source_type" in sensor_work.columns:
                sensor_work = sensor_work[sensor_work["source_type"] == "MEASURED"]

            if not sensor_work.empty:
                sensor_work["dt"] = pd.to_datetime(sensor_work["observation_timestamp_utc"], utc=True)
                for _, s_row in sensor_work.iterrows():
                    s_time = s_row["dt"]
                    time_diffs = (fused["dt"] - s_time).abs()
                    min_diff_idx = time_diffs.idxmin()
                    min_diff = time_diffs.loc[min_diff_idx]

                    if min_diff <= self.sensor_time_window:
                        fused.at[min_diff_idx, "sensor_measured_soil_moisture_m3m3"] = s_row["soil_moisture_m3m3"]
                        fused.at[min_diff_idx, "sensor_measured_soil_temperature_c"] = s_row["soil_temperature_c"]
                        fused.at[min_diff_idx, "sensor_measured_relative_humidity_pct"] = s_row["relative_humidity_pct"]
                        fused.at[min_diff_idx, "sensor_measured_depth_cm"] = s_row.get("depth_cm", 20.0)
                        fused.at[min_diff_idx, "sensor_device_id"] = s_row.get("device_id")

        sensor_matches = fused["sensor_measured_soil_moisture_m3m3"].notna().sum()

        # 3. Classify Fusion State
        def classify_status(row):
            has_sat = pd.notna(row["satellite_soil_moisture_smap_m3m3"])
            has_sensor = pd.notna(row["sensor_measured_soil_moisture_m3m3"])
            if has_sat and has_sensor:
                return "FULLY_FUSED"
            elif has_sat:
                return "WEATHER_AND_SATELLITE"
            elif has_sensor:
                return "WEATHER_AND_SENSOR"
            return "WEATHER_MODEL_ONLY"

        fused["fusion_status"] = fused.apply(classify_status, axis=1)
        fused.drop(columns=["dt"], inplace=True)

        total_steps = len(fused)
        fully_fused = (fused["fusion_status"] == "FULLY_FUSED").sum()

        missing_summary = {
            col: int(fused[col].isna().sum())
            for col in fused.columns
            if fused[col].isna().sum() > 0
        }

        limitations = [
            "Spatial scale divergence: Ground sensors represent point (~10 cm) measurements; "
            "NASA SMAP is a 9 km radiometer footprint; ERA5 Land is a 9 km reanalysis grid cell.",
            "Temporal cadence asymmetry: Weather model is continuous hourly (24 steps/day); "
            "SMAP satellite passes occur only once every 1 to 3 days at ~06:00 or ~18:00 local time.",
            "Soil depth discrepancy: Satellite SMAP measures top 0-5 cm surface skin moisture; "
            "root-zone irrigation decisions depend on deeper 0-100 cm root-zone profile.",
            "No interpolation applied: Gaps between sparse satellite passes are left as unobserved (NaN) "
            "to prevent training machine learning algorithms on synthetic artifacts.",
        ]

        report = FusionReport(
            total_hourly_steps=total_steps,
            steps_with_satellite_match=int(sat_matches),
            steps_with_ground_sensor_match=int(sensor_matches),
            steps_fully_fused=int(fully_fused),
            satellite_coverage_pct=round(sat_matches / total_steps * 100, 2) if total_steps else 0.0,
            sensor_coverage_pct=round(sensor_matches / total_steps * 100, 2) if total_steps else 0.0,
            unmatched_satellite_observations=unmatched_sat_count,
            missing_value_summary=missing_summary,
            alignment_limitations=limitations,
        )

        return fused, report
