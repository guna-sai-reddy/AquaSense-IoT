"""Tests for ML Feature Engineering, Metric Evaluation, Artifact Loading, and Inference."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

from app.services.inference import (
    SoilMoistureInferenceRequest,
    SoilMoisturePredictor,
)

ROOT_DIR = Path(__file__).resolve().parents[2]


def test_compute_metrics_accuracy():
    """Verify compute_metrics mathematically returns accurate RMSE, MAE, R2, and ubRMSE."""
    import sys
    sys.path.insert(0, str(ROOT_DIR / "ml_engine"))
    from src.evaluate import compute_metrics

    y_true = np.array([0.20, 0.22, 0.24, 0.26])
    y_pred = np.array([0.21, 0.23, 0.25, 0.27])  # Constant +0.01 bias

    m = compute_metrics(y_true, y_pred)
    assert abs(m["mae"] - 0.01) < 1e-5
    assert abs(m["rmse"] - 0.01) < 1e-5
    assert abs(m["bias_mbe"] - 0.01) < 1e-5
    # Since error is entirely systematic bias, unbiased RMSE should be 0.0!
    assert abs(m["ubrmse"] - 0.0) < 1e-5


def test_feature_engineering_drop_edges():
    """Verify feature engineering drops edge rows where lags or forward targets are unavailable."""
    import sys
    sys.path.insert(0, str(ROOT_DIR / "ml_engine"))
    from src.feature_engineering import prepare_features_and_target

    # Create dummy 48-hour sequence
    times = pd.date_range("2024-01-01", periods=60, freq="1h", tz="UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    dummy_df = pd.DataFrame({
        "timestamp_utc": times,
        "soil_moisture_7_to_28cm": np.linspace(0.20, 0.25, 60),
        "soil_moisture_0_to_7cm": np.linspace(0.18, 0.22, 60),
        "soil_moisture_28_to_100cm": np.linspace(0.28, 0.30, 60),
        "soil_temperature_7_to_28cm": np.ones(60) * 22.0,
        "soil_temperature_0_to_7cm": np.ones(60) * 23.0,
        "temperature_2m": np.ones(60) * 25.0,
        "relative_humidity_2m": np.ones(60) * 60.0,
        "surface_pressure": np.ones(60) * 980.0,
        "wind_speed_10m": np.ones(60) * 10.0,
        "et0_fao_evapotranspiration": np.ones(60) * 0.1,
        "precipitation": np.zeros(60),
        "shortwave_radiation_instant": np.ones(60) * 100.0,
    })

    X, y, feat_names, timestamps = prepare_features_and_target(dummy_df, horizon_hours=24)

    # 60 total rows - 24 lag hours - 24 target hours = 12 valid rows
    assert len(X) == 12
    assert len(y) == 12

    assert "sm_root_current" in feat_names
    assert "precip_rolling_24h_sum_mm" in feat_names


def test_model_artifact_and_metadata_exist():
    """Verify serialized model artifact and metadata JSON exist on disk."""
    model_path = ROOT_DIR / "ml_engine" / "models" / "root_zone_model.joblib"
    meta_path = ROOT_DIR / "ml_engine" / "models" / "model_metadata.json"
    comp_path = ROOT_DIR / "ml_engine" / "models" / "model_comparison.csv"

    assert model_path.exists(), f"Model artifact missing at {model_path}"
    assert meta_path.exists(), f"Metadata JSON missing at {meta_path}"
    assert comp_path.exists(), f"Comparison CSV missing at {comp_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
        assert meta["target"]["variable"] == "soil_moisture_7_to_28cm"
        assert meta["target"]["horizon_hours"] == 24
        assert "evaluation_metrics" in meta


def test_inference_predictor_execution():
    """Test loading the trained artifact and making a valid 24-hour prediction."""
    model_path = ROOT_DIR / "ml_engine" / "models" / "root_zone_model.joblib"
    meta_path = ROOT_DIR / "ml_engine" / "models" / "model_metadata.json"

    predictor = SoilMoisturePredictor(model_path=model_path, metadata_path=meta_path)

    req = SoilMoistureInferenceRequest(
        sm_root_current=0.231,
        sm_root_lag_1h=0.231,
        sm_root_lag_3h=0.232,
        sm_root_lag_6h=0.232,
        sm_root_lag_24h=0.233,
        sm_surface_0_to_7cm=0.169,
        sm_deep_28_to_100cm=0.314,
        soil_temp_root_c=20.5,
        soil_temp_surface_c=21.0,
        air_temp_2m_c=24.0,
        relative_humidity_pct=65.0,
        surface_pressure_hpa=982.0,
        wind_speed_kmh=8.0,
        et0_current_mm=0.08,
        et0_rolling_24h_sum_mm=2.5,
        precip_current_mm=0.0,
        precip_rolling_6h_sum_mm=0.0,
        precip_rolling_24h_sum_mm=0.0,
        shortwave_radiation_wm2=150.0,
        hour_of_day=14,
        day_of_year=10,
    )

    resp = predictor.predict_24h(req)
    assert resp.horizon_hours == 24
    assert 0.0 <= resp.predicted_soil_moisture_m3m3 <= 1.0
    assert resp.source_type == "PREDICTED"
    assert resp.units == "m3/m3"


def test_inference_input_validation_rejection():
    """Verify SoilMoistureInferenceRequest rejects physical impossibility."""
    # Negative moisture
    with pytest.raises(ValidationError):
        SoilMoistureInferenceRequest(
            sm_root_current=-0.05,
            sm_root_lag_1h=0.20,
            sm_root_lag_3h=0.20,
            sm_root_lag_6h=0.20,
            sm_root_lag_24h=0.20,
            sm_surface_0_to_7cm=0.15,
            sm_deep_28_to_100cm=0.25,
            soil_temp_root_c=20.0,
            soil_temp_surface_c=21.0,
            air_temp_2m_c=22.0,
            relative_humidity_pct=50.0,
        )

    # Moisture > 1.0
    with pytest.raises(ValidationError):
        SoilMoistureInferenceRequest(
            sm_root_current=1.35,
            sm_root_lag_1h=0.20,
            sm_root_lag_3h=0.20,
            sm_root_lag_6h=0.20,
            sm_root_lag_24h=0.20,
            sm_surface_0_to_7cm=0.15,
            sm_deep_28_to_100cm=0.25,
            soil_temp_root_c=20.0,
            soil_temp_surface_c=21.0,
            air_temp_2m_c=22.0,
            relative_humidity_pct=50.0,
        )
