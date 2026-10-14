"""SQLAlchemy Post-Irrigation Event ORM Model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class IrrigationEventModel(Base):
    """Execution records for physical or logged irrigation applications."""

    __tablename__ = "irrigation_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fields.id", ondelete="CASCADE"), index=True, nullable=False
    )
    recommendation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("irrigation_recommendations.id", ondelete="SET NULL"), nullable=True
    )
    event_timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    planned_volume_m3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_volume_m3: Mapped[float] = mapped_column(Float, nullable=False)
    actual_depth_mm: Mapped[float] = mapped_column(Float, nullable=False)
    irrigation_method: Mapped[str] = mapped_column(String(30), default="drip", nullable=False)

    pre_irrigation_sm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    post_irrigation_sm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    execution_status: Mapped[str] = mapped_column(String(30), default="COMPLETED", nullable=False)
    operator_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    field = relationship("FieldModel", back_populates="irrigation_events")
    recommendation = relationship("RecommendationModel")
