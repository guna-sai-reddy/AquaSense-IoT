"""Tests for FAO-56 Irrigation Decision Engine, Unit Conversions, Limits, and Logic."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.field_config import (
    CropConfig,
    FieldConfig,
    SoilConfig,
    EXAMPLE_GROUNDNUT_LOAM_FIELD,
    EXAMPLE_COTTON_CLAY_FIELD,
)
from app.schemas.recommendation import (
    IrrigationAction,
    IrrigationRecommendationRequest,
)
from app.services.decision_engine import IrrigationDecisionEngine


@pytest.fixture
def decision_engine():
    return IrrigationDecisionEngine()


def test_unit_conversions_area_and_volume():
    """Verify area conversion (ha to m2) and volume calculation (mm and m2 to m3 and liters)."""
    # 1.5 hectares = 15,000 m2
    field = EXAMPLE_GROUNDNUT_LOAM_FIELD
    assert field.area_m2 == 15_000.0
    assert field.area_hectares == 1.5

    # 10 mm on 15,000 m2:
    # Volume (m3) = (10 mm / 1000) * 15000 m2 = 150 m3
    # Volume (Liters) = 150 * 1000 = 150,000 Liters
    depth_mm = 10.0
    vol_m3 = (depth_mm / 1000.0) * field.area_m2
    vol_liters = vol_m3 * 1000.0
    assert vol_m3 == 150.0
    assert vol_liters == 150_000.0


def test_soil_hydraulic_consistency_validation():
    """Field capacity must strictly exceed permanent wilting point."""
    with pytest.raises(ValidationError):
        SoilConfig(
            soil_texture="loam",
            field_capacity_theta=0.15,
            wilting_point_theta=0.20,  # Impossible: WP > FC
        )

    with pytest.raises(ValidationError):
        SoilConfig(
            soil_texture="loam",
            field_capacity_theta=0.20,
            wilting_point_theta=0.20,  # Impossible: FC == WP
        )


def test_irrigation_efficiency_limits():
    """Application efficiency must be bounded within plausible engineering ranges (0.30 - 0.98)."""
    with pytest.raises(ValidationError):
        FieldConfig(
            field_id="FIELD_BAD_EFF",
            field_name="Bad Efficiency Field",
            latitude=15.8281,
            longitude=78.0373,
            area_value=1.0,
            application_efficiency=0.15,  # Unrealistic (< 0.30)
            crop=EXAMPLE_GROUNDNUT_LOAM_FIELD.crop,
            soil=EXAMPLE_GROUNDNUT_LOAM_FIELD.soil,
        )

    with pytest.raises(ValidationError):
        FieldConfig(
            field_id="FIELD_BAD_EFF",
            field_name="Bad Efficiency Field",
            latitude=15.8281,
            longitude=78.0373,
            area_value=1.0,
            application_efficiency=1.05,  # Impossible (> 0.98)
            crop=EXAMPLE_GROUNDNUT_LOAM_FIELD.crop,
            soil=EXAMPLE_GROUNDNUT_LOAM_FIELD.soil,
        )


def test_moisture_below_threshold_triggers_irrigate(decision_engine):
    """When soil moisture drops below RAW (Dr >= RAW), IRRIGATE_RECOMMENDED is triggered."""
    # Field: FC = 0.28, WP = 0.14, Zr = 0.45m, p = 0.50
    # TAW = 1000 * (0.28 - 0.14) * 0.45 = 63.0 mm
    # RAW = 0.50 * 63.0 = 31.5 mm
    # Stress moisture threshold = 0.28 - (31.5 / 450) = 0.210 m3/m3
    # If current moisture is 0.190 m3/m3 -> Dr = 1000 * (0.28 - 0.190) * 0.45 = 40.5 mm (> RAW 31.5 mm)
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.190,
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        forecast_rainfall_next_24h_mm=0.0,
        forecast_et0_next_24h_mm=4.0,
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.IRRIGATE_RECOMMENDED
    assert resp.total_available_water_taw_mm == 63.0
    assert resp.readily_available_water_raw_mm == 31.5
    assert resp.current_depletion_dr_mm == 40.5
    # Capped at max_irrigation_depth_per_event_mm (30.0 mm)
    assert resp.net_irrigation_depth_mm == 30.0
    # Gross depth = 30.0 / 0.90 = 33.33 mm
    assert resp.gross_irrigation_depth_mm == 33.33
    # Volume = 33.33 / 1000 * 15000 = 499.95 m3
    assert resp.water_volume_m3 is not None
    assert resp.water_volume_m3 > 450.0


def test_moisture_sufficient_defers_irrigation(decision_engine):
    """When soil moisture is comfortably above RAW, IRRIGATION_DEFERRED is issued."""
    # Moisture at 0.250 m3/m3 -> Dr = 1000 * (0.28 - 0.25) * 0.45 = 13.5 mm (< RAW 31.5 mm)
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.250,
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        forecast_rainfall_next_24h_mm=0.0,
        forecast_et0_next_24h_mm=3.5,
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.IRRIGATION_DEFERRED
    assert resp.net_irrigation_depth_mm is None
    assert resp.water_volume_m3 is None
    assert "Soil moisture" in resp.explanations[0]


def test_rainfall_forecast_defers_irrigation_preventing_waste(decision_engine):
    """When soil deficit requires water, but heavy rain is forecast, irrigation is deferred."""
    # Dr = 40.5 mm (stress state), but forecast rain is 45.0 mm at 85% probability
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.190,
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        forecast_rainfall_next_24h_mm=55.0,
        forecast_rain_probability_pct=85.0,
        forecast_et0_next_24h_mm=2.0,
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.IRRIGATION_DEFERRED
    assert "imminent high-probability rainfall" in resp.explanations[0]
    # Check baseline comparison proves water saving
    assert resp.baseline_comparison is not None
    assert resp.baseline_comparison.baseline_action == IrrigationAction.IRRIGATE_RECOMMENDED
    assert resp.baseline_comparison.predictive_action == IrrigationAction.IRRIGATION_DEFERRED
    assert resp.baseline_comparison.volume_difference_m3 > 0


def test_surface_moisture_incompatibility_rejected(decision_engine):
    """Surface skin moisture (0-7cm) must NOT be silently used as root zone."""
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.150,
        latest_soil_moisture_depth_stratum="surface_0_to_7cm",  # Incompatible stratum!
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.INDETERMINATE
    assert any("surface_0_to_7cm" in m for m in resp.missing_inputs)


def test_missing_observation_returns_indeterminate(decision_engine):
    """Missing soil moisture reading must return INDETERMINATE rather than fake data."""
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=None,  # Missing observation
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.INDETERMINATE
    assert "latest_soil_moisture_m3m3" in resp.missing_inputs


def test_stale_telemetry_generates_warning(decision_engine):
    """Observation older than 48 hours must generate a staleness warning."""
    stale_timestamp = "2020-01-01T00:00:00Z"
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.230,
        observation_timestamp_utc=stale_timestamp,
    )
    resp = decision_engine.generate_recommendation(req)
    assert any("stale" in w.lower() for w in resp.warnings)


def test_maximum_volume_budget_capping(decision_engine):
    """If field has max_irrigation_volume_m3, calculated volume must be capped."""
    custom_field = EXAMPLE_GROUNDNUT_LOAM_FIELD.model_copy(deep=True)
    custom_field.max_irrigation_volume_m3 = 200.0  # Cap volume to 200 m3

    req = IrrigationRecommendationRequest(
        field=custom_field,
        latest_soil_moisture_m3m3=0.180,  # High deficit
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.IRRIGATE_RECOMMENDED
    assert resp.water_volume_m3 == 200.0
    assert any("water budget limit" in w for w in resp.warnings)


def test_predictive_anticipatory_irrigation(decision_engine):
    """Current moisture is above threshold, but ML forecast shows it crossing stress threshold in 24h."""
    # Current moisture = 0.220 m3/m3 (Dr = 27.0 mm < RAW 31.5 mm, no stress now)
    # Predicted 24h moisture = 0.200 m3/m3 (Dr = 36.0 mm > RAW 31.5 mm, stress imminent)
    req = IrrigationRecommendationRequest(
        field=EXAMPLE_GROUNDNUT_LOAM_FIELD,
        latest_soil_moisture_m3m3=0.220,
        predicted_soil_moisture_24h_m3m3=0.200,
        forecast_rainfall_next_24h_mm=0.0,
        forecast_et0_next_24h_mm=4.0,
    )
    resp = decision_engine.generate_recommendation(req)

    assert resp.action == IrrigationAction.IRRIGATE_RECOMMENDED
    assert "Anticipatory" in resp.suggested_timing_window or "Anticipatory" in resp.explanations[0]
    assert resp.baseline_comparison.baseline_action == IrrigationAction.IRRIGATION_DEFERRED
    assert resp.baseline_comparison.predictive_action == IrrigationAction.IRRIGATE_RECOMMENDED
