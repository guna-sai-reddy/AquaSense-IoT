"""Add password_reset_otps, irrigation_events, and email_broadcast_logs tables.

Revision ID: 002_add_otp_event_broadcast_tables
Revises: 001_initial_schema
Create Date: 2026-10-22 00:00:00.000000

These tables are used by:
- PasswordResetOTP: in-app 6-digit PIN-based password recovery
- IrrigationEventModel: post-irrigation execution audit log
- EmailBroadcastLog: administrative broadcast notification log

Fixed in this revision vs original draft:
  password_reset_otps:
    - Removed duplicate inline index=True on email column; use ONE named index
      matching SQLAlchemy auto-name: ix_password_reset_otps_email

  irrigation_events:
    - Added missing column: planned_volume_m3 (FLOAT nullable)
    - Added missing FK: recommendation_id -> irrigation_recommendations.id SET NULL
    - Corrected index name from ix_irrigation_events_timestamp to
      ix_irrigation_events_event_timestamp_utc (matches SQLAlchemy auto-name)

  email_broadcast_logs:
    - Completely rewritten to match EmailBroadcastLog model exactly:
        admin_id, admin_email, message, urgency, target_audience,
        recipient_count, recipients_summary, delivery_method
    - Removed columns that only existed in the old draft and are not in
        the model: recipient_email, body_preview, sent_at, status, error_message
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_add_otp_event_broadcast_tables"
down_revision: Union[str, Sequence[str], None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # 1. Password Reset OTPs                                               #
    #    Model: app.models.otp.PasswordResetOTP                           #
    #    Table: password_reset_otps                                        #
    # ------------------------------------------------------------------ #
    op.create_table(
        "password_reset_otps",
        sa.Column("id", sa.String(36), primary_key=True),
        # NOTE: do NOT set index=True here — the explicit create_index below
        # is the single authoritative index.  Passing both would create a
        # duplicate unnamed index on PostgreSQL.
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("otp_code", sa.String(6), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    # Name matches SQLAlchemy auto-generated name (ix_<tablename>_<column>)
    op.create_index(
        "ix_password_reset_otps_email", "password_reset_otps", ["email"]
    )

    # ------------------------------------------------------------------ #
    # 2. Irrigation Events                                                 #
    #    Model: app.models.event.IrrigationEventModel                     #
    #    Table: irrigation_events                                          #
    # ------------------------------------------------------------------ #
    op.create_table(
        "irrigation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "field_id",
            sa.String(36),
            sa.ForeignKey("fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # FK to irrigation_recommendations (SET NULL on delete so that
        # deleting a recommendation does not cascade-delete the event record)
        sa.Column(
            "recommendation_id",
            sa.String(36),
            sa.ForeignKey("irrigation_recommendations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "event_timestamp_utc",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # planned_volume_m3 was missing from the original draft
        sa.Column("planned_volume_m3", sa.Float(), nullable=True),
        sa.Column("actual_volume_m3", sa.Float(), nullable=False),
        sa.Column("actual_depth_mm", sa.Float(), nullable=False),
        sa.Column(
            "irrigation_method",
            sa.String(30),
            nullable=False,
            server_default="drip",
        ),
        sa.Column("pre_irrigation_sm", sa.Float(), nullable=True),
        sa.Column("post_irrigation_sm", sa.Float(), nullable=True),
        sa.Column(
            "execution_status",
            sa.String(30),
            nullable=False,
            server_default="COMPLETED",
        ),
        sa.Column("operator_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    # Index names match SQLAlchemy auto-generated names
    op.create_index(
        "ix_irrigation_events_field_id", "irrigation_events", ["field_id"]
    )
    op.create_index(
        "ix_irrigation_events_event_timestamp_utc",
        "irrigation_events",
        ["event_timestamp_utc"],
    )

    # ------------------------------------------------------------------ #
    # 3. Email Broadcast Logs                                              #
    #    Model: app.models.broadcast.EmailBroadcastLog                    #
    #    Table: email_broadcast_logs                                       #
    # ------------------------------------------------------------------ #
    op.create_table(
        "email_broadcast_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        # admin_id / admin_email — who sent the broadcast
        sa.Column("admin_id", sa.String(36), nullable=False),
        sa.Column("admin_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        # message is the full broadcast body (TEXT NOT NULL)
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "urgency", sa.String(32), nullable=False, server_default="normal"
        ),
        sa.Column(
            "target_audience",
            sa.String(64),
            nullable=False,
            server_default="all_users",
        ),
        sa.Column(
            "recipient_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("recipients_summary", sa.Text(), nullable=True),
        sa.Column(
            "delivery_method",
            sa.String(32),
            nullable=True,
            server_default="simulated_dev",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("email_broadcast_logs")
    op.drop_index(
        "ix_irrigation_events_event_timestamp_utc",
        table_name="irrigation_events",
    )
    op.drop_index(
        "ix_irrigation_events_field_id", table_name="irrigation_events"
    )
    op.drop_table("irrigation_events")
    op.drop_index(
        "ix_password_reset_otps_email", table_name="password_reset_otps"
    )
    op.drop_table("password_reset_otps")
