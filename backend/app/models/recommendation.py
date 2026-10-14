"""SQLAlchemy Irrigation Recommendation ORM Model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecommendationModel(Base):
    """Irrigation scheduling decisions, calculated water volumes, and explanations."""

    __tablename__ = "irrigation_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fields.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prediction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True
    )
    generated_at_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )

    action: Mapped[str] = mapped_column(String(30), nullable=False)  # IRRIGATE_RECOMMENDED, IRRIGATION_DEFERRED, INDETERMINATE

    net_irrigation_depth_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_irrigation_depth_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_volume_m3: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_volume_liters: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Hydraulic States (FAO-56)
    total_available_water_taw_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    readily_available_water_raw_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_depletion_dr_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_depletion_fraction: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_rainfall_considered_mm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    crop_evapotranspiration_etc_mm: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Explanations, Warnings, Baseline serialized as JSON strings
    explanations_json: Mapped[str] = mapped_column(Text, nullable=False)
    warnings_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    baseline_comparison_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_timing_window: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    field = relationship("FieldModel", back_populates="recommendations")
    prediction = relationship("PredictionModel", back_populates="recommendations")
