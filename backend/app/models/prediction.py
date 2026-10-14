"""SQLAlchemy Soil Moisture Prediction ORM Model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PredictionModel(Base):
    """Machine learning root-zone soil moisture forecasts and metadata."""

    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fields.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prediction_timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    target_timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    horizon_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    target_variable: Mapped[str] = mapped_column(String(50), default="soil_moisture_7_to_28cm", nullable=False)
    target_depth: Mapped[str] = mapped_column(String(50), default="7-28 cm (Root Zone)", nullable=False)
    units: Mapped[str] = mapped_column(String(20), default="m3/m3", nullable=False)

    current_moisture_m3m3: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_moisture_m3m3: Mapped[float] = mapped_column(Float, nullable=False)
    projected_change_m3m3: Mapped[float] = mapped_column(Float, nullable=False)

    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(50), default="RandomForest", nullable=False)
    input_provenance: Mapped[str] = mapped_column(String(50), default="WEATHER_MODEL_DERIVED", nullable=False)
    features_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    field = relationship("FieldModel", back_populates="predictions")
    recommendations = relationship("RecommendationModel", back_populates="prediction")
