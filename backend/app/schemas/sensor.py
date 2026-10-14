"""Pydantic Schemas for Ground Sensor Telemetry Ingestion & Validation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator


class GroundSensorReadingCreate(BaseModel):
    """Payload received from an in-situ IoT sensor probe or LoRaWAN gateway."""

    device_id: str = Field(..., min_length=3, max_length=64, description="Unique hardware identifier")
    field_id: str = Field(..., min_length=3, max_length=64, description="Target field boundary ID")
    observation_timestamp_utc: str = Field(
        ...,
        description="ISO-8601 observation timestamp in UTC (e.g. 2024-01-01T10:00:00Z)",
    )
    soil_moisture_unit: Literal["m3/m3", "percent", "fraction"] = "m3/m3"
    soil_moisture: float = Field(..., description="Soil moisture reading (volumetric fraction or percent)")

    soil_temperature_unit: Literal["celsius", "fahrenheit"] = "celsius"
    soil_temperature: float = Field(..., description="Soil temperature at sensor depth")

    relative_humidity_unit: Literal["percent"] = "percent"
    relative_humidity: float = Field(..., description="Ambient air relative humidity")

    depth_cm: float = Field(default=20.0, ge=1.0, le=300.0, description="Sensor insertion depth in centimeters")
    battery_level_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    signal_rssi_dbm: Optional[int] = Field(default=None, ge=-140, le=0)
    is_test_fixture: bool = Field(default=False, description="Explicit flag for automated software test fixtures")

    @model_validator(mode="after")
    def validate_and_normalize(self) -> GroundSensorReadingCreate:
        """Validates physical bounds, formats timestamps, and normalizes all units."""
        # 1. Timestamp validation & ISO UTC normalization
        clean_v = self.observation_timestamp_utc.replace(" ", "T")
        try:
            if clean_v.endswith("Z"):
                dt = datetime.fromisoformat(clean_v[:-1] + "+00:00")
            else:
                dt = datetime.fromisoformat(clean_v)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = dt.astimezone(timezone.utc)
            self.observation_timestamp_utc = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception as e:
            raise ValueError(
                f"Invalid ISO-8601 timestamp '{self.observation_timestamp_utc}'. Error: {e}"
            )

        # 2. Soil Moisture Unit Normalization & Physical Bounds (0.0 to 1.0 m3/m3)
        sm = self.soil_moisture
        if self.soil_moisture_unit == "percent":
            if not (0.0 <= sm <= 100.0):
                raise ValueError(f"Soil moisture {sm}% is out of physical bounds (must be 0-100%).")
            self.soil_moisture = round(sm / 100.0, 4)
        else:
            if not (0.0 <= sm <= 1.0):
                raise ValueError(f"Soil moisture {sm} m3/m3 is out of physical bounds (0.0 - 1.0 m3/m3).")
            self.soil_moisture = round(sm, 4)

        # 3. Soil Temperature Normalization & Physical Bounds (-30°C to +70°C)
        st = self.soil_temperature
        if self.soil_temperature_unit == "fahrenheit":
            st = (st - 32.0) * 5.0 / 9.0

        if not (-30.0 <= st <= 70.0):
            raise ValueError(f"Soil temperature {st:.1f}°C is physically impossible for agricultural soils.")
        self.soil_temperature = round(st, 2)

        # 4. Relative Humidity Physical Bounds (0% to 100%)
        rh = self.relative_humidity
        if not (0.0 <= rh <= 100.0):
            raise ValueError(f"Relative humidity {rh}% is out of physical bounds (0-100%).")
        self.relative_humidity = round(rh, 2)

        return self


class GroundSensorReadingResponse(BaseModel):
    """Standardized response schema for stored ground telemetry."""

    id: str
    device_id: str
    field_id: str
    observation_timestamp_utc: str
    ingestion_timestamp_utc: str
    soil_moisture_m3m3: float
    soil_temperature_c: float
    relative_humidity_pct: float
    depth_cm: float
    source_type: Literal["MEASURED", "SIMULATED"]
    battery_level_pct: Optional[float] = None
    signal_rssi_dbm: Optional[int] = None
    status: str = "ACCEPTED"
