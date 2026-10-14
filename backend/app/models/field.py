"""SQLAlchemy Agricultural Field ORM Model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FieldModel(Base):
    """Agricultural field configuration with crop parameters, soil hydraulics, and boundaries."""

    __tablename__ = "fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Geometry & Infrastructure
    area_value: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(20), default="hectares", nullable=False)
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    irrigation_method: Mapped[str] = mapped_column(String(30), default="drip", nullable=False)
    application_efficiency: Mapped[float] = mapped_column(Float, default=0.90, nullable=False)
    max_depth_per_event_mm: Mapped[float] = mapped_column(Float, default=30.0, nullable=False)
    max_volume_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Crop Parameters (FAO-56)
    crop_name: Mapped[str] = mapped_column(String(50), nullable=False)
    growth_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    kc: Mapped[float] = mapped_column(Float, nullable=False)
    root_depth_m: Mapped[float] = mapped_column(Float, nullable=False)
    depletion_fraction_p: Mapped[float] = mapped_column(Float, default=0.50, nullable=False)

    # Soil Hydraulic Parameters (FAO-56)
    soil_texture: Mapped[str] = mapped_column(String(30), nullable=False)
    field_capacity_theta: Mapped[float] = mapped_column(Float, nullable=False)
    wilting_point_theta: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner = relationship("User", back_populates="fields")
    sensor_observations = relationship("SensorObservationModel", back_populates="field", cascade="all, delete-orphan")
    weather_observations = relationship("WeatherObservationModel", back_populates="field", cascade="all, delete-orphan")
    predictions = relationship("PredictionModel", back_populates="field", cascade="all, delete-orphan")
    recommendations = relationship("RecommendationModel", back_populates="field", cascade="all, delete-orphan")
    irrigation_events = relationship("IrrigationEventModel", back_populates="field", cascade="all, delete-orphan")
