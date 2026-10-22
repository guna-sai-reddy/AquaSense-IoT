"""Add password_reset_otps, irrigation_events, and email_broadcast_logs tables.

Revision ID: 002_add_otp_event_broadcast_tables
Revises: 001_initial_schema
Create Date: 2026-10-22 00:00:00.000000

These tables are used by:
- PasswordResetOTP: in-app 6-digit PIN-based password recovery
- IrrigationEventModel: post-irrigation execution audit log
- EmailBroadcastLog: outbound notification tracking
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_add_otp_event_broadcast_tables"
down_revision: Union[str, Sequence[str], None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Password Reset OTPs Table
    op.create_table(
        "password_reset_otps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("otp_code", sa.String(6), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_otp_email", "password_reset_otps", ["email"])

    # 2. Irrigation Events Table
    op.create_table(
        "irrigation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("field_id", sa.String(36), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommendation_id", sa.String(36), nullable=True),
        sa.Column("event_timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_volume_m3", sa.Float(), nullable=False),
        sa.Column("actual_depth_mm", sa.Float(), nullable=False),
        sa.Column("irrigation_method", sa.String(30), nullable=False, default="drip"),
        sa.Column("pre_irrigation_sm", sa.Float(), nullable=True),
        sa.Column("post_irrigation_sm", sa.Float(), nullable=True),
        sa.Column("execution_status", sa.String(30), nullable=False, default="COMPLETED"),
        sa.Column("operator_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_irrigation_events_field_id", "irrigation_events", ["field_id"])
    op.create_index("ix_irrigation_events_timestamp", "irrigation_events", ["event_timestamp_utc"])

    # 3. Email Broadcast Logs Table
    op.create_table(
        "email_broadcast_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body_preview", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("email_broadcast_logs")
    op.drop_table("irrigation_events")
    op.drop_index("ix_otp_email", table_name="password_reset_otps")
    op.drop_table("password_reset_otps")
