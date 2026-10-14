"""Initial schema creation for users, fields, observations, predictions, and recommendations.

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-10-04 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users Table
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # 2. Fields Table
    op.create_table(
        "fields",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("area_value", sa.Float(), nullable=False),
        sa.Column("area_unit", sa.String(20), nullable=False, default="hectares"),
        sa.Column("area_m2", sa.Float(), nullable=False),
        sa.Column("irrigation_method", sa.String(30), nullable=False, default="drip"),
        sa.Column("application_efficiency", sa.Float(), nullable=False, default=0.90),
        sa.Column("max_depth_per_event_mm", sa.Float(), nullable=False, default=30.0),
        sa.Column("max_volume_m3", sa.Float(), nullable=True),
        sa.Column("crop_name", sa.String(50), nullable=False),
        sa.Column("growth_stage", sa.String(30), nullable=False),
        sa.Column("kc", sa.Float(), nullable=False),
        sa.Column("root_depth_m", sa.Float(), nullable=False),
        sa.Column("depletion_fraction_p", sa.Float(), nullable=False, default=0.50),
        sa.Column("soil_texture", sa.String(30), nullable=False),
        sa.Column("field_capacity_theta", sa.Float(), nullable=False),
        sa.Column("wilting_point_theta", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fields_user_id", "fields", ["user_id"])

    # 3. Sensor Observations Table
    op.create_table(
        "sensor_observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("field_id", sa.String(36), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.String(64), nullable=False),
        sa.Column("observation_timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("soil_moisture_m3m3", sa.Float(), nullable=False),
        sa.Column("soil_temperature_c", sa.Float(), nullable=False),
        sa.Column("relative_humidity_pct", sa.Float(), nullable=False),
        sa.Column("depth_cm", sa.Float(), nullable=False, default=20.0),
        sa.Column("source_type", sa.String(30), nullable=False, default="MEASURED"),
        sa.Column("battery_level_pct", sa.Float(), nullable=True),
        sa.Column("signal_rssi_dbm", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sensor_obs_field_id", "sensor_observations", ["field_id"])
    op.create_index("ix_sensor_obs_timestamp", "sensor_observations", ["observation_timestamp_utc"])
    op.create_index("ix_sensor_obs_device_id", "sensor_observations", ["device_id"])

    # 4. Weather Observations Table
    op.create_table(
        "weather_observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("field_id", sa.String(36), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_2m_c", sa.Float(), nullable=False),
        sa.Column("relative_humidity_pct", sa.Float(), nullable=False),
        sa.Column("precipitation_mm", sa.Float(), nullable=False),
        sa.Column("rain_mm", sa.Float(), nullable=False, default=0.0),
        sa.Column("surface_pressure_hpa", sa.Float(), nullable=True),
        sa.Column("et0_fao_mm", sa.Float(), nullable=True),
        sa.Column("shortwave_radiation_wm2", sa.Float(), nullable=True),
        sa.Column("wind_speed_kmh", sa.Float(), nullable=True),
        sa.Column("source_type", sa.String(30), nullable=False, default="WEATHER_MODEL_DERIVED"),
        sa.Column("provider", sa.String(60), nullable=False, default="Open-Meteo ERA5 Reanalysis"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_weather_obs_field_id", "weather_observations", ["field_id"])
    op.create_index("ix_weather_obs_timestamp", "weather_observations", ["timestamp_utc"])

    # 5. Soil Moisture Predictions Table
    op.create_table(
        "predictions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("field_id", sa.String(36), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_hours", sa.Integer(), nullable=False, default=24),
        sa.Column("target_variable", sa.String(50), nullable=False, default="soil_moisture_7_to_28cm"),
        sa.Column("target_depth", sa.String(50), nullable=False, default="7-28 cm (Root Zone)"),
        sa.Column("units", sa.String(20), nullable=False, default="m3/m3"),
        sa.Column("current_moisture_m3m3", sa.Float(), nullable=False),
        sa.Column("predicted_moisture_m3m3", sa.Float(), nullable=False),
        sa.Column("projected_change_m3m3", sa.Float(), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("model_name", sa.String(50), nullable=False, default="RandomForest"),
        sa.Column("input_provenance", sa.String(50), nullable=False, default="WEATHER_MODEL_DERIVED"),
        sa.Column("features_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_predictions_field_id", "predictions", ["field_id"])
    op.create_index("ix_predictions_timestamp", "predictions", ["prediction_timestamp_utc"])

    # 6. Irrigation Recommendations Table
    op.create_table(
        "irrigation_recommendations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("field_id", sa.String(36), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_id", sa.String(36), sa.ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("generated_at_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("net_irrigation_depth_mm", sa.Float(), nullable=True),
        sa.Column("gross_irrigation_depth_mm", sa.Float(), nullable=True),
        sa.Column("water_volume_m3", sa.Float(), nullable=True),
        sa.Column("water_volume_liters", sa.Float(), nullable=True),
        sa.Column("total_available_water_taw_mm", sa.Float(), nullable=True),
        sa.Column("readily_available_water_raw_mm", sa.Float(), nullable=True),
        sa.Column("current_depletion_dr_mm", sa.Float(), nullable=True),
        sa.Column("current_depletion_fraction", sa.Float(), nullable=True),
        sa.Column("effective_rainfall_considered_mm", sa.Float(), nullable=False, default=0.0),
        sa.Column("crop_evapotranspiration_etc_mm", sa.Float(), nullable=True),
        sa.Column("explanations_json", sa.Text(), nullable=False),
        sa.Column("warnings_json", sa.Text(), nullable=True),
        sa.Column("baseline_comparison_json", sa.Text(), nullable=True),
        sa.Column("suggested_timing_window", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_recommendations_field_id", "irrigation_recommendations", ["field_id"])
    op.create_index("ix_recommendations_generated_at", "irrigation_recommendations", ["generated_at_utc"])


def downgrade() -> None:
    op.drop_table("irrigation_recommendations")
    op.drop_table("predictions")
    op.drop_table("weather_observations")
    op.drop_table("sensor_observations")
    op.drop_table("fields")
    op.drop_table("users")
