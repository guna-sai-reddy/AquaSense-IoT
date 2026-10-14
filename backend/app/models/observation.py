"""SQLAlchemy Sensor & Weather Observation ORM Models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SensorObservationModel(Base):
    """In-situ physical ground probe telemetry."""

    __tablename__ = "sensor_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fields.id", ondelete="CASCADE"), index=True, nullable=False
    )
    device_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    observation_timestamp_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)

    soil_moisture_m3m3: Mapped[float] = mapped_column(Float, nullable=False)
    soil_temperature_c: Mapped[float] = mapped_column(Float, nullable=False)
    relative_humidity_pct: Mapped[float] = mapped_column(Float, nullable=False)
    depth_cm: Mapped[float] = mapped_column(Float, default=20.0, nullable=False)

    source_type: Mapped[str] = mapped_column(String(30), default="MEASURED", nullable=False)
    battery_level_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal_rssi_dbm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    field = relationship("FieldModel", back_populates="sensor_observations")


class WeatherObservationModel(Base):
    """Meteorological observations and numerical weather forecasts."""

    __tablename__ = "weather_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fields.id", ondelete="CASCADE"), index=True, nullable=False
    )
    timestamp_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)

    temperature_2m_c: Mapped[float] = mapped_column(Float, nullable=False)
    relative_humidity_pct: Mapped[float] = mapped_column(Float, nullable=False)
    precipitation_mm: Mapped[float] = mapped_column(Float, nullable=False)
    rain_mm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    surface_pressure_hpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    et0_fao_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    shortwave_radiation_wm2: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_type: Mapped[str] = mapped_column(String(30), default="WEATHER_MODEL_DERIVED", nullable=False)
    provider: Mapped[str] = mapped_column(String(60), default="Open-Meteo ERA5 Reanalysis", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    field = relationship("FieldModel", back_populates="weather_observations")
