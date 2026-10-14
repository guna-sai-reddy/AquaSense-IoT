"""SQLAlchemy Admin Email Broadcast Model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailBroadcastLog(Base):
    """Tracks administrative announcements dispatched to personal email addresses."""

    __tablename__ = "email_broadcast_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id: Mapped[str] = mapped_column(String(36), nullable=False)
    admin_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    urgency: Mapped[str] = mapped_column(String(32), default="normal", nullable=False)
    target_audience: Mapped[str] = mapped_column(String(64), default="all_users", nullable=False)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recipients_summary: Mapped[str] = mapped_column(Text, nullable=True)
    delivery_method: Mapped[str] = mapped_column(String(32), default="simulated_dev", nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
