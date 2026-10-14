"""Pydantic Schemas for Soil Moisture Prediction APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PredictionTriggerRequest(BaseModel):
    """Payload to trigger a 24-hour forward soil moisture prediction for a field."""

    current_soil_moisture_m3m3: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override current moisture reading; defaults to latest field observation if omitted.",
    )
    hour_of_day: Optional[int] = Field(default=None, ge=0, le=23)
    day_of_year: Optional[int] = Field(default=None, ge=1, le=366)


class PredictionResponse(BaseModel):
    """Stored prediction DTO."""

    id: str
    field_id: str
    prediction_timestamp_utc: datetime
    target_timestamp_utc: datetime
    horizon_hours: int
    target_variable: str
    target_depth: str
    units: str

    current_moisture_m3m3: float
    predicted_moisture_m3m3: float
    projected_change_m3m3: float

    model_version: str
    model_name: str
    input_provenance: str
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}
