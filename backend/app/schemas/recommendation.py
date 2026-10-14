"""Schemas for Irrigation Scheduling Recommendations & Decision Engine Interfaces."""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.field_config import FieldConfig


class IrrigationAction(str, Enum):
    """Categorical irrigation scheduling advisory."""
    IRRIGATE_RECOMMENDED = "IRRIGATE_RECOMMENDED"
    IRRIGATION_DEFERRED = "IRRIGATION_DEFERRED"
    INDETERMINATE = "INDETERMINATE"


class BaselineComparison(BaseModel):
    """Comparison between Predictive Decision Engine and Conventional Static Threshold Controller."""
    baseline_controller_name: str = "Conventional Static MAD Threshold Controller"
    baseline_action: IrrigationAction
    baseline_gross_depth_mm: float
    baseline_volume_m3: float

    predictive_action: IrrigationAction
    predictive_gross_depth_mm: float
    predictive_volume_m3: float

    volume_difference_m3: float = Field(
        ...,
        description="Positive indicates water saved by predictive deferral; negative indicates anticipatory pre-irrigation.",
    )
    explanation: str


class IrrigationRecommendationRequest(BaseModel):
    """Input payload to calculate precision irrigation scheduling."""

    field: FieldConfig

    # Soil Moisture Observation
    latest_soil_moisture_m3m3: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Most recent observed soil moisture (m3/m3)",
    )
    latest_soil_moisture_depth_stratum: Literal[
        "root_zone_7_to_28cm",
        "deep_root_28_to_100cm",
        "surface_0_to_7cm",
        "unknown",
    ] = Field(
        default="root_zone_7_to_28cm",
        description="Depth stratum of the observation. Surface moisture cannot be used directly as root zone!",
    )
    observation_timestamp_utc: Optional[str] = Field(
        default=None,
        description="ISO-8601 observation timestamp of the soil reading",
    )
    observation_source_type: Literal[
        "MEASURED",
        "WEATHER_MODEL_DERIVED",
        "SATELLITE_DERIVED",
        "SIMULATED",
    ] = Field(
        default="WEATHER_MODEL_DERIVED",
        description="Explicit provenance of the current moisture reading",
    )

    # 24-Hour Forward Forecasts & Predictions
    predicted_soil_moisture_24h_m3m3: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Machine learning 24-hour forward predicted root-zone moisture (m3/m3)",
    )
    forecast_rainfall_next_24h_mm: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Numerical weather prediction cumulative rain over next 24 hours (mm)",
    )
    forecast_rain_probability_pct: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Rainfall probability (%) from NWP forecast",
    )
    forecast_et0_next_24h_mm: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Forecast cumulative Reference Evapotranspiration over next 24 hours (mm)",
    )


class IrrigationRecommendationResponse(BaseModel):
    """Complete, transparent decision advisory with agronomic explanations and volumes."""

    recommendation_id: str
    field_id: str
    generated_at_utc: str
    action: IrrigationAction

    # Depth & Volumes (None if INDETERMINATE or DEFERRED)
    net_irrigation_depth_mm: Optional[float] = None
    gross_irrigation_depth_mm: Optional[float] = None
    water_volume_m3: Optional[float] = None
    water_volume_liters: Optional[float] = None

    # FAO-56 Hydrological Diagnostic State
    total_available_water_taw_mm: Optional[float] = None
    readily_available_water_raw_mm: Optional[float] = None
    current_depletion_dr_mm: Optional[float] = None
    current_depletion_fraction: Optional[float] = None
    effective_rainfall_considered_mm: float = 0.0
    crop_evapotranspiration_etc_mm: Optional[float] = None

    # Decision Provenance & Explainability
    factors_considered: Dict[str, str] = Field(default_factory=dict)
    explanations: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    missing_inputs: List[str] = Field(default_factory=list)

    # Baseline Comparison
    baseline_comparison: Optional[BaselineComparison] = None

    # Operational Advisory
    suggested_timing_window: Optional[str] = None
    valve_actuation_status: str = "MANUAL_CONFIRMATION_REQUIRED (Hardware actuation disabled)"
