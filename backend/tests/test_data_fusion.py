"""Tests for Data Fusion Engine: Spatiotemporal Alignment, Windowing, and Provenance."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.data_fusion import DataFusionEngine


@pytest.fixture
def sample_weather_df():
    """5-hour synthetic weather sequence for testing alignment logic."""
    return pd.DataFrame({
        "timestamp_utc": [
            "2024-01-01T04:00:00Z",
            "2024-01-01T05:00:00Z",
            "2024-01-01T06:00:00Z",
            "2024-01-01T07:00:00Z",
            "2024-01-01T08:00:00Z",
        ],
        "temperature_2m": [18.0, 19.5, 21.0, 23.0, 25.0],
        "relative_humidity_2m": [80.0, 75.0, 70.0, 65.0, 60.0],
        "precipitation": [0.0, 0.0, 0.0, 0.0, 0.0],
        "et0_fao_evapotranspiration": [0.02, 0.05, 0.10, 0.15, 0.20],
        "soil_moisture_0_to_7cm": [0.20, 0.20, 0.20, 0.19, 0.19],
    })


@pytest.fixture
def sample_satellite_df():
    """Single satellite pass occurring at 05:45 UTC (15 mins from 06:00)."""
    return pd.DataFrame({
        "timestamp_utc": ["2024-01-01T05:45:00Z"],
        "soil_moisture_smap_m3m3": [0.185],
        "retrieval_qual_flag": [0],
        "is_valid_quality": [True],
        "quality_assessment": ["RECOMMENDED_QUALITY"],
        "granule_id": ["SMAP_TEST_GRANULE.h5"],
    })


@pytest.fixture
def sample_ground_sensor_df():
    """Ground sensor observation at 06:05 UTC (5 mins from 06:00)."""
    return pd.DataFrame({
        "observation_timestamp_utc": ["2024-01-01T06:05:00Z"],
        "soil_moisture_m3m3": [0.192],
        "soil_temperature_c": [20.5],
        "relative_humidity_pct": [68.0],
        "depth_cm": [20.0],
        "device_id": ["KURNOOL_NODE_01"],
        "source_type": ["MEASURED"],
    })


def test_spatiotemporal_fusion_alignment(sample_weather_df, sample_satellite_df, sample_ground_sensor_df):
    """Verify satellite and sensor observations correctly fuse to nearest weather timestep."""
    engine = DataFusionEngine(satellite_time_window_mins=180, sensor_time_window_mins=30)
    fused_df, report = engine.fuse_datasets(
        weather_df=sample_weather_df,
        satellite_df=sample_satellite_df,
        ground_sensor_df=sample_ground_sensor_df,
    )

    assert len(fused_df) == 5

    # Timestep 06:00 (index 2) must be FULLY_FUSED
    fused_row = fused_df.loc[2]
    assert fused_row["timestamp_utc"] == "2024-01-01T06:00:00Z"
    assert fused_row["fusion_status"] == "FULLY_FUSED"
    assert fused_row["satellite_soil_moisture_smap_m3m3"] == 0.185
    assert fused_row["sensor_measured_soil_moisture_m3m3"] == 0.192
    assert fused_row["weather_era5_soil_moisture_0_to_7cm"] == 0.20
    assert abs(fused_row["satellite_offset_minutes"]) == 15.0

    # Timestep 04:00 (index 0) must remain WEATHER_MODEL_ONLY with NaN for unobserved
    row_0 = fused_df.loc[0]
    assert row_0["fusion_status"] == "WEATHER_MODEL_ONLY"
    assert pd.isna(row_0["satellite_soil_moisture_smap_m3m3"])
    assert pd.isna(row_0["sensor_measured_soil_moisture_m3m3"])


def test_zero_interpolation_guarantee(sample_weather_df, sample_satellite_df):
    """Unobserved satellite hours must remain NaN without interpolation or synthetic backfilling."""
    engine = DataFusionEngine()
    fused_df, _ = engine.fuse_datasets(
        weather_df=sample_weather_df,
        satellite_df=sample_satellite_df,
    )

    # Indices 0, 1, 3, 4 should not have satellite data
    nan_indices = [0, 1, 3, 4]
    for idx in nan_indices:
        assert pd.isna(fused_df.loc[idx, "satellite_soil_moisture_smap_m3m3"])


def test_satellite_time_window_rejection(sample_weather_df):
    """Satellite passes outside the maximum window (e.g. 5 hours away) must NOT be matched."""
    late_sat_df = pd.DataFrame({
        "timestamp_utc": ["2024-01-01T15:00:00Z"],  # 7 hours after last weather row
        "soil_moisture_smap_m3m3": [0.17],
        "retrieval_qual_flag": [0],
        "is_valid_quality": [True],
        "granule_id": ["LATE_GRANULE.h5"],
    })
    engine = DataFusionEngine(satellite_time_window_mins=120)  # 2 hours max
    fused_df, report = engine.fuse_datasets(
        weather_df=sample_weather_df,
        satellite_df=late_sat_df,
    )

    assert report.steps_with_satellite_match == 0
    assert report.unmatched_satellite_observations == 1
    assert all(pd.isna(fused_df["satellite_soil_moisture_smap_m3m3"]))


def test_fusion_report_diagnostics(sample_weather_df, sample_satellite_df, sample_ground_sensor_df):
    """Verify diagnostic metrics in FusionReport."""
    engine = DataFusionEngine()
    _, report = engine.fuse_datasets(
        weather_df=sample_weather_df,
        satellite_df=sample_satellite_df,
        ground_sensor_df=sample_ground_sensor_df,
    )

    assert report.total_hourly_steps == 5
    assert report.steps_with_satellite_match == 1
    assert report.steps_with_ground_sensor_match == 1
    assert report.steps_fully_fused == 1
    assert len(report.alignment_limitations) >= 3
