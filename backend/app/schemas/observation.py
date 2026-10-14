"""Pydantic Schemas for Sensor and Weather Observation APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.sensor import GroundSensorReadingCreate


class ObservationIngestRequest(GroundSensorReadingCreate):
    """Payload to ingest physical in-situ sensor telemetry through API."""
    pass


class SensorObservationResponse(BaseModel):
    """Sensor observation DTO."""

    id: str
    field_id: str
    device_id: str
    observation_timestamp_utc: datetime
    soil_moisture_m3m3: float
    soil_temperature_c: float
    relative_humidity_pct: float
    depth_cm: float
    source_type: str
    battery_level_pct: Optional[float] = None
    signal_rssi_dbm: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WeatherObservationResponse(BaseModel):
    """Weather reanalysis observation DTO."""

    id: str
    field_id: str
    timestamp_utc: datetime
    temperature_2m_c: float
    relative_humidity_pct: float
    precipitation_mm: float
    rain_mm: float
    surface_pressure_hpa: Optional[float] = None
    et0_fao_mm: Optional[float] = None
    shortwave_radiation_wm2: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    source_type: str
    provider: str
    created_at: datetime

    model_config = {"from_attributes": True}
