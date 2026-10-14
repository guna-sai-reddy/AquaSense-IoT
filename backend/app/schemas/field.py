"""Pydantic Schemas for Agricultural Field CRUD Operations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.field_config import CropConfig, SoilConfig


class FieldCreateRequest(BaseModel):
    """Payload to create a new agricultural field."""

    name: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    area_unit: Literal["square_meters", "hectares"] = "hectares"
    area_value: float = Field(..., gt=0.0)

    irrigation_method: Literal["drip", "sprinkler", "furrow", "flood", "subsurface_drip"] = "drip"
    application_efficiency: float = Field(default=0.90, ge=0.30, le=0.98)
    max_depth_per_event_mm: float = Field(default=30.0, ge=5.0, le=100.0)
    max_volume_m3: Optional[float] = Field(default=None, gt=0.0)

    crop: CropConfig
    soil: SoilConfig


class FieldUpdateRequest(BaseModel):
    """Payload to update an existing field's crop stage or irrigation limits."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    growth_stage: Optional[Literal["initial", "development", "mid_season", "late_season"]] = None
    kc: Optional[float] = Field(default=None, ge=0.15, le=1.45)
    root_depth_m: Optional[float] = Field(default=None, ge=0.10, le=3.0)
    depletion_fraction_p: Optional[float] = Field(default=None, ge=0.10, le=0.85)
    application_efficiency: Optional[float] = Field(default=None, ge=0.30, le=0.98)
    max_depth_per_event_mm: Optional[float] = Field(default=None, ge=5.0, le=100.0)
    max_volume_m3: Optional[float] = Field(default=None, gt=0.0)


class FieldResponse(BaseModel):
    """Complete field response representation."""

    id: str
    user_id: str
    name: str
    latitude: float
    longitude: float
    area_value: float
    area_unit: str
    area_m2: float
    irrigation_method: str
    application_efficiency: float
    max_depth_per_event_mm: float
    max_volume_m3: Optional[float] = None

    crop_name: str
    growth_stage: str
    kc: float
    root_depth_m: float
    depletion_fraction_p: float

    soil_texture: str
    field_capacity_theta: float
    wilting_point_theta: float

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
