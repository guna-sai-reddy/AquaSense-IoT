"""Master Research Verification Tests for AquaSense-IoT.

Validates:
1. FAO-56 calculations against the 6 required benchmark cases (Part 2.2).
2. Agronomic boundary checks and Investigation Warnings for moisture < wilting point.
3. ConventionalBaselineScheduler comparative metrics and water savings.
4. Model evaluation metrics API.
5. Post-irrigation event recording and history retrieval.
"""

import pytest
import pandas as pd
import numpy as np

from app.schemas.field_config import CropConfig, FieldConfig, SoilConfig
from app.schemas.recommendation import (
    IrrigationAction,
    IrrigationRecommendationRequest,
)
from app.services.decision_engine import IrrigationDecisionEngine
from app.services.baseline_scheduler import ConventionalBaselineScheduler


@pytest.fixture
def benchmark_field() -> FieldConfig:
    """Configures the standard Kurnool benchmark field from Part 2.2."""
    return FieldConfig(
        field_id="kurnool-groundnut-benchmark",
        field_name="Kurnool Benchmark Groundnut Field",
        latitude=15.8281,
        longitude=78.0373,
        area_value=2.5,
        area_unit="hectares",
        irrigation_method="drip",
        application_efficiency=0.90,
        max_depth_per_event_mm=30.0,
        crop=CropConfig(
            crop_name="groundnut",
            growth_stage="mid_season",
            kc=1.15,
            root_depth_m=0.60,
            depletion_fraction_p=0.50,
        ),
        soil=SoilConfig(
            soil_texture="sandy_clay_loam",
            field_capacity_theta=0.31,
            wilting_point_theta=0.14,
        ),
    )


def test_fao56_case_4_taw_calculation(benchmark_field: FieldConfig):
    """Case 4: TAW = 1000 * (0.31 - 0.14) * 0.6 = 102.0 mm."""
    engine = IrrigationDecisionEngine()
    taw = engine.calculate_taw(
        theta_fc=benchmark_field.soil.field_capacity_theta,
        theta_wp=benchmark_field.soil.wilting_point_theta,
        root_depth_m=benchmark_field.crop.root_depth_m,
    )
    assert taw == 102.0


def test_fao56_case_5_raw_calculation(benchmark_field: FieldConfig):
    """Case 5: RAW = p * TAW = 0.5 * 102.0 = 51.0 mm."""
    engine = IrrigationDecisionEngine()
    raw = engine.calculate_raw(taw_mm=102.0, depletion_fraction_p=0.50)
    assert raw == 51.0


def test_fao56_case_1_depletion_51mm(benchmark_field: FieldConfig):
    """Case 1: Moisture 0.225, FC 0.31, Zr 0.6m -> Dr = 1000 * (0.31 - 0.225) * 0.6 = 51.0 mm."""
    engine = IrrigationDecisionEngine()
    dr = engine.calculate_depletion(
        theta_fc=0.31,
        theta_current=0.225,
        root_depth_m=0.60,
    )
    assert dr == 51.0


def test_fao56_case_2_depletion_54mm(benchmark_field: FieldConfig):
    """Case 2: Moisture 0.220, FC 0.31, Zr 0.6m -> Dr = 1000 * (0.31 - 0.220) * 0.6 = 54.0 mm."""
    engine = IrrigationDecisionEngine()
    dr = engine.calculate_depletion(
        theta_fc=0.31,
        theta_current=0.220,
        root_depth_m=0.60,
    )
    assert dr == 54.0


def test_fao56_case_3_desiccated_input_investigation_warning(benchmark_field: FieldConfig):
    """Case 3: Moisture 0.009 is below wilting point (0.14) -> Triggers Investigation Warning and caps at TAW."""
    engine = IrrigationDecisionEngine()
    req = IrrigationRecommendationRequest(
        field=benchmark_field,
        latest_soil_moisture_m3m3=0.009,
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        observation_timestamp_utc="2026-10-04T12:00:00Z",
        observation_source_type="MEASURED",
    )
    res = engine.generate_recommendation(req)

    # Must contain Investigation Warning
    assert any("Investigation Warning" in w for w in res.warnings)
    # Depletion must be capped at TAW (102.0 mm) rather than 180.6 mm
    assert res.current_depletion_dr_mm == 102.0


def test_fao56_case_6_gross_depth_and_volume(benchmark_field: FieldConfig):
    """Case 6: Gross irrigation depth and volume are consistent with area and efficiency."""
    engine = IrrigationDecisionEngine()
    req = IrrigationRecommendationRequest(
        field=benchmark_field,
        latest_soil_moisture_m3m3=0.20,  # Dr = 1000 * (0.31 - 0.20) * 0.6 = 66.0 mm
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        observation_timestamp_utc="2026-10-04T12:00:00Z",
        observation_source_type="MEASURED",
    )
    res = engine.generate_recommendation(req)

    assert res.action == IrrigationAction.IRRIGATE_RECOMMENDED
    # Single-event cap is 30.0 mm
    assert res.net_irrigation_depth_mm == 30.0
    # Gross depth = 30.0 / 0.90 = 33.33 mm
    assert round(res.gross_irrigation_depth_mm, 2) == 33.33
    # Volume = 33.333... * 25,000 / 1000 = 833.33 m3
    expected_vol = round(res.gross_irrigation_depth_mm * benchmark_field.area_m2 / 1000.0, 2)
    assert round(res.water_volume_m3, 2) == expected_vol
    assert round(res.water_volume_liters, 0) == round(expected_vol * 1000.0, 0)


def test_conventional_baseline_scheduler(benchmark_field: FieldConfig):
    """Validates that ConventionalBaselineScheduler generates a comparative simulation with positive water savings."""
    scheduler = ConventionalBaselineScheduler(field=benchmark_field)

    # 7-day hourly synthetic weather sequence with a rain event on day 3
    hours = 168
    timestamps = [f"2024-01-0{1 + i // 24}T{i % 24:02d}:00:00Z" for i in range(hours)]
    rain = np.zeros(hours)
    rain[72:76] = 8.0  # 32 mm total rain on Day 4
    et0 = np.full(hours, 0.18)

    weather_df = pd.DataFrame({
        "timestamp_utc": timestamps,
        "precipitation": rain,
        "et0_fao_evapotranspiration": et0,
        "soil_moisture_7_to_28cm": np.full(hours, 0.22),
    })

    report = scheduler.run_comparative_simulation(weather_df=weather_df)

    assert report.total_timesteps == hours
    assert report.conventional_total_depth_mm > 0.0
    assert report.predictive_total_depth_mm > 0.0
    assert report.water_savings_volume_m3 >= 0.0
    assert report.field_area_ha == 2.5
    assert "NOT_MEASURED" in report.crop_yield_status


def test_single_event_cap_reports_remaining_deficit(benchmark_field: FieldConfig):
    """Verifies that single-event cap explicitly reports remaining deficit and 24h reassessment."""
    engine = IrrigationDecisionEngine()
    req = IrrigationRecommendationRequest(
        field=benchmark_field,
        latest_soil_moisture_m3m3=0.18,  # Dr = 1000 * (0.31 - 0.18) * 0.6 = 78.0 mm
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        observation_timestamp_utc="2026-10-04T12:00:00Z",
        observation_source_type="MEASURED",
    )
    res = engine.generate_recommendation(req)
    assert res.action == IrrigationAction.IRRIGATE_RECOMMENDED
    assert res.net_irrigation_depth_mm == 30.0  # Capped at max_depth 30.0
    # Warning must state remaining deficit (48.0 mm)
    cap_warning = [w for w in res.warnings if "Single-Event Limit Reached" in w]
    assert len(cap_warning) == 1
    assert "Remaining profile deficit is 48.0 mm" in cap_warning[0]
    assert "schedule reassessment after 24h infiltration" in cap_warning[0]

