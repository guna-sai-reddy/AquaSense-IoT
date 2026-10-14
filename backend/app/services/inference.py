"""AquaSense-IoT Machine Learning Inference Service.

Loads serialized model artifacts and executes 24-hour root-zone soil moisture forecasting.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

import joblib
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_MODEL_PATH = Path("ml_engine/models/root_zone_model.joblib")
DEFAULT_METADATA_PATH = Path("ml_engine/models/model_metadata.json")


class SoilMoistureInferenceRequest(BaseModel):
    """Features required to execute a 24-hour soil moisture prediction."""

    sm_root_current: float = Field(..., ge=0.0, le=1.0, description="Current root-zone soil moisture (m3/m3)")
    sm_root_lag_1h: float = Field(..., ge=0.0, le=1.0, description="Root-zone moisture 1h ago")
    sm_root_lag_3h: float = Field(..., ge=0.0, le=1.0, description="Root-zone moisture 3h ago")
    sm_root_lag_6h: float = Field(..., ge=0.0, le=1.0, description="Root-zone moisture 6h ago")
    sm_root_lag_24h: float = Field(..., ge=0.0, le=1.0, description="Root-zone moisture 24h ago")
    sm_surface_0_to_7cm: float = Field(..., ge=0.0, le=1.0, description="Current surface moisture (m3/m3)")
    sm_deep_28_to_100cm: float = Field(..., ge=0.0, le=1.0, description="Current deep root moisture (m3/m3)")
    soil_temp_root_c: float = Field(..., ge=-20.0, le=60.0, description="Soil temp at root depth (°C)")
    soil_temp_surface_c: float = Field(..., ge=-20.0, le=65.0, description="Surface soil temp (°C)")
    air_temp_2m_c: float = Field(..., ge=-20.0, le=55.0, description="Air temperature at 2m (°C)")
    relative_humidity_pct: float = Field(..., ge=0.0, le=100.0, description="Relative humidity (%)")
    surface_pressure_hpa: float = Field(default=980.0, ge=800.0, le=1100.0)
    wind_speed_kmh: float = Field(default=5.0, ge=0.0, le=150.0)
    et0_current_mm: float = Field(default=0.1, ge=0.0, le=20.0)
    et0_rolling_24h_sum_mm: float = Field(default=3.0, ge=0.0, le=100.0)
    precip_current_mm: float = Field(default=0.0, ge=0.0, le=300.0)
    precip_rolling_6h_sum_mm: float = Field(default=0.0, ge=0.0, le=500.0)
    precip_rolling_24h_sum_mm: float = Field(default=0.0, ge=0.0, le=1000.0)
    shortwave_radiation_wm2: float = Field(default=0.0, ge=0.0, le=1500.0)
    hour_of_day: int = Field(default=12, ge=0, le=23)
    day_of_year: int = Field(default=15, ge=1, le=366)


class SoilMoistureInferenceResponse(BaseModel):
    """Predicted root-zone soil moisture at t + 24 hours."""

    model_config = {"protected_namespaces": ()}

    horizon_hours: int = 24
    predicted_soil_moisture_m3m3: float
    current_soil_moisture_m3m3: float
    projected_change_m3m3: float
    model_version: str
    target_depth: str
    units: str
    source_type: str = "PREDICTED"



class SoilMoisturePredictor:
    """Loads trained model artifacts and performs real-time inference."""

    def __init__(
        self,
        model_path: Path | str = DEFAULT_MODEL_PATH,
        metadata_path: Path | str = DEFAULT_METADATA_PATH,
    ):
        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path)
        self._pipeline = None
        self._metadata = None
        self._load()

    def _load(self) -> None:
        if not self.model_path.exists():
            root_path = Path(__file__).resolve().parents[3] / self.model_path
            if root_path.exists():
                self.model_path = root_path
            elif (Path("..") / self.model_path).exists():
                self.model_path = Path("..") / self.model_path
            else:
                raise FileNotFoundError(f"Model artifact not found at {self.model_path}")

        self._pipeline = joblib.load(self.model_path)

        if not self.metadata_path.exists():
            root_meta = Path(__file__).resolve().parents[3] / self.metadata_path
            if root_meta.exists():
                self.metadata_path = root_meta
            elif (Path("..") / self.metadata_path).exists():
                self.metadata_path = Path("..") / self.metadata_path

        if self.metadata_path.exists():
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)

    @property
    def feature_names(self) -> List[str]:
        if self._metadata and "features" in self._metadata:
            return self._metadata["features"]["feature_names"]
        return [
            "sm_root_current",
            "sm_root_lag_1h",
            "sm_root_lag_3h",
            "sm_root_lag_6h",
            "sm_root_lag_24h",
            "sm_surface_0_to_7cm",
            "sm_deep_28_to_100cm",
            "soil_temp_root_c",
            "soil_temp_surface_c",
            "air_temp_2m_c",
            "relative_humidity_pct",
            "surface_pressure_hpa",
            "wind_speed_kmh",
            "et0_current_mm",
            "et0_rolling_24h_sum_mm",
            "precip_current_mm",
            "precip_rolling_6h_sum_mm",
            "precip_rolling_24h_sum_mm",
            "shortwave_radiation_wm2",
            "hour_sin",
            "hour_cos",
            "day_of_year",
        ]

    def predict_24h(self, req: SoilMoistureInferenceRequest) -> SoilMoistureInferenceResponse:
        """Executes 24-hour forward inference for given state."""
        # Compute cyclical hour features
        h_sin = np.sin(2 * np.pi * req.hour_of_day / 24.0)
        h_cos = np.cos(2 * np.pi * req.hour_of_day / 24.0)
        d_norm = req.day_of_year / 365.25

        feature_dict = {
            "sm_root_current": req.sm_root_current,
            "sm_root_lag_1h": req.sm_root_lag_1h,
            "sm_root_lag_3h": req.sm_root_lag_3h,
            "sm_root_lag_6h": req.sm_root_lag_6h,
            "sm_root_lag_24h": req.sm_root_lag_24h,
            "sm_surface_0_to_7cm": req.sm_surface_0_to_7cm,
            "sm_deep_28_to_100cm": req.sm_deep_28_to_100cm,
            "soil_temp_root_c": req.soil_temp_root_c,
            "soil_temp_surface_c": req.soil_temp_surface_c,
            "air_temp_2m_c": req.air_temp_2m_c,
            "relative_humidity_pct": req.relative_humidity_pct,
            "surface_pressure_hpa": req.surface_pressure_hpa,
            "wind_speed_kmh": req.wind_speed_kmh,
            "et0_current_mm": req.et0_current_mm,
            "et0_rolling_24h_sum_mm": req.et0_rolling_24h_sum_mm,
            "precip_current_mm": req.precip_current_mm,
            "precip_rolling_6h_sum_mm": req.precip_rolling_6h_sum_mm,
            "precip_rolling_24h_sum_mm": req.precip_rolling_24h_sum_mm,
            "shortwave_radiation_wm2": req.shortwave_radiation_wm2,
            "hour_sin": h_sin,
            "hour_cos": h_cos,
            "day_of_year": d_norm,
        }

        # Build single-row DataFrame aligned with training features
        X = pd.DataFrame([feature_dict])[self.feature_names]

        # Predict using pipeline
        pred_val = float(self._pipeline.predict(X)[0])
        # Physical clipping [0.0, 1.0]
        clipped_pred = max(0.0, min(1.0, pred_val))
        change = clipped_pred - req.sm_root_current

        model_ver = "v1.0"
        if self._metadata:
            model_ver = f"{self._metadata.get('selected_best_model', 'RandomForest')}_v1"

        return SoilMoistureInferenceResponse(
            horizon_hours=24,
            predicted_soil_moisture_m3m3=round(clipped_pred, 4),
            current_soil_moisture_m3m3=round(req.sm_root_current, 4),
            projected_change_m3m3=round(change, 4),
            model_version=model_ver,
            target_depth="7-28 cm (Root Zone)",
            units="m3/m3",
            source_type="PREDICTED",
        )
