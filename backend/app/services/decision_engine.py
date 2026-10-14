"""AquaSense-IoT Irrigation Decision Engine.

Combines FAO-56 hydrological water-balance dynamics with machine learning soil moisture
predictions and numerical weather forecasts to schedule precision irrigation.

References:
- Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998).
  Crop evapotranspiration-Guidelines for computing crop water requirements.
  FAO Irrigation and Drainage Paper 56, Rome, 300(9), D05109.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import pandas as pd

from app.schemas.field_config import FieldConfig
from app.schemas.recommendation import (
    BaselineComparison,
    IrrigationAction,
    IrrigationRecommendationRequest,
    IrrigationRecommendationResponse,
)

logger = logging.getLogger(__name__)

# Maximum allowable age for soil moisture telemetry before marked stale
MAX_TELEMETRY_AGE_HOURS = 48.0


class IrrigationDecisionEngine:
    """Standalone, testable agronomic decision engine for precision irrigation."""

    def __init__(self, stale_telemetry_threshold_hours: float = MAX_TELEMETRY_AGE_HOURS):
        self.stale_threshold_hours = stale_telemetry_threshold_hours

    @staticmethod
    def calculate_taw(theta_fc: float, theta_wp: float, root_depth_m: float) -> float:
        """Calculates Total Available Water (TAW) in the root zone in millimeters.

        Equation (FAO-56 Eq. 82):
            TAW = 1000 * (theta_FC - theta_WP) * Zr
        """
        if theta_fc <= theta_wp:
            raise ValueError(f"Field Capacity ({theta_fc}) must exceed Wilting Point ({theta_wp}).")
        if root_depth_m <= 0:
            raise ValueError(f"Root depth ({root_depth_m} m) must be positive.")
        return round(1000.0 * (theta_fc - theta_wp) * root_depth_m, 2)

    @staticmethod
    def calculate_raw(taw_mm: float, depletion_fraction_p: float) -> float:
        """Calculates Readily Available Water (RAW) in millimeters.

        Equation (FAO-56 Eq. 83):
            RAW = p * TAW
        """
        if not (0.0 < depletion_fraction_p <= 1.0):
            raise ValueError(f"Depletion fraction p ({depletion_fraction_p}) must be in (0, 1].")
        return round(depletion_fraction_p * taw_mm, 2)

    @staticmethod
    def calculate_depletion(
        theta_fc: float,
        theta_current: float,
        root_depth_m: float,
    ) -> float:
        """Calculates current root-zone soil water depletion (Dr) in millimeters.

        Equation (FAO-56 Eq. 84):
            Dr = 1000 * (theta_FC - theta_current) * Zr
        Note:
            If soil moisture is at or above Field Capacity, Dr = 0 (no depletion).
        """
        if theta_current >= theta_fc:
            return 0.0
        return round(1000.0 * (theta_fc - theta_current) * root_depth_m, 2)

    @staticmethod
    def calculate_effective_rainfall(
        forecast_rain_mm: Optional[float],
        rain_probability_pct: Optional[float],
        current_depletion_dr_mm: float,
    ) -> Tuple[float, str]:
        """Calculates effective rainfall (Peff) infiltrable into root zone.

        Documented Agronomic Method:
        - Light showers (< 2.0 mm) are lost to canopy interception and soil skin evaporation: Peff = 0.
        - Low-probability rain (< 40%) is excluded to maintain deficit safety.
        - For P >= 2.0 mm with prob >= 40%, Peff is 80% of rainfall, capped at current soil depletion deficit.
        """
        if forecast_rain_mm is None or forecast_rain_mm <= 0:
            return 0.0, "No forecast rainfall expected."

        prob = rain_probability_pct if rain_probability_pct is not None else 100.0
        if prob < 40.0:
            return 0.0, f"Forecast rain ({forecast_rain_mm:.1f} mm) discounted due to low probability ({prob:.0f}% < 40%)."

        if forecast_rain_mm < 2.0:
            return 0.0, f"Light rain ({forecast_rain_mm:.1f} mm) discounted due to canopy interception and rapid surface evaporation."

        # Infiltrable depth capped at current depletion
        infiltrable = forecast_rain_mm * 0.80
        peff = min(infiltrable, current_depletion_dr_mm)
        explanation = (
            f"Forecast rain of {forecast_rain_mm:.1f} mm (prob: {prob:.0f}%) provides "
            f"{peff:.1f} mm effective root-zone recharge (capped at soil deficit)."
        )
        return round(peff, 2), explanation

    def generate_recommendation(
        self,
        request: IrrigationRecommendationRequest,
    ) -> IrrigationRecommendationResponse:
        """Evaluates hydrological state, predictions, and field parameters to produce an advisory."""
        gen_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        rec_id = str(uuid.uuid4())
        field = request.field

        missing_inputs: List[str] = []
        warnings: List[str] = []
        explanations: List[str] = []
        factors: Dict[str, str] = {}

        # 1. Input Completeness & Validity Auditing
        if request.latest_soil_moisture_m3m3 is None:
            missing_inputs.append("latest_soil_moisture_m3m3")

        # Incompatible depth check: surface skin cannot substitute for root zone
        if request.latest_soil_moisture_depth_stratum == "surface_0_to_7cm":
            missing_inputs.append(
                "Root-zone moisture (7-28 cm). Provided stratum is 'surface_0_to_7cm', "
                "which cannot be used directly to calculate root-zone depletion (FAO-56)."
            )

        # Check telemetry staleness
        if request.observation_timestamp_utc:
            try:
                obs_dt = pd.to_datetime(request.observation_timestamp_utc, utc=True)
                age_hours = (pd.Timestamp.now(tz="UTC") - obs_dt).total_seconds() / 3600.0
                if age_hours > self.stale_threshold_hours:
                    warnings.append(
                        f"Soil moisture reading is stale ({age_hours:.1f} hours old > {self.stale_threshold_hours}h limit)."
                    )
            except Exception:
                warnings.append("Could not parse observation timestamp to verify staleness.")

        # Return INDETERMINATE if required telemetry is absent or incompatible
        if missing_inputs:
            return IrrigationRecommendationResponse(
                recommendation_id=rec_id,
                field_id=field.field_id,
                generated_at_utc=gen_time_utc,
                action=IrrigationAction.INDETERMINATE,
                missing_inputs=missing_inputs,
                warnings=warnings,
                explanations=[
                    "Recommendation cannot be calculated reliably because essential inputs are missing or incompatible."
                ],
                factors_considered={"status": "INDETERMINATE due to missing/incompatible inputs"},
            )

        sm_current = request.latest_soil_moisture_m3m3
        crop = field.crop
        soil = field.soil

        # 2. Hydraulic Capacity Calculations (FAO-56)
        taw_mm = self.calculate_taw(
            theta_fc=soil.field_capacity_theta,
            theta_wp=soil.wilting_point_theta,
            root_depth_m=crop.root_depth_m,
        )
        raw_mm = self.calculate_raw(taw_mm=taw_mm, depletion_fraction_p=crop.depletion_fraction_p)
        uncapped_dr_mm = self.calculate_depletion(
            theta_fc=soil.field_capacity_theta,
            theta_current=sm_current,
            root_depth_m=crop.root_depth_m,
        )

        # Agronomic Boundary Validation
        if sm_current < soil.wilting_point_theta:
            warnings.append(
                f"Investigation Warning: Input soil moisture ({sm_current:.3f} m3/m3) is below configured "
                f"wilting point ({soil.wilting_point_theta:.3f} m3/m3). Severe crop water stress or sensor miscalibration suspected."
            )
            dr_mm = taw_mm
            warnings.append(
                f"Mathematical depletion ({uncapped_dr_mm:.1f} mm) exceeded Total Available Water ({taw_mm:.1f} mm). "
                f"Capped at TAW ({taw_mm:.1f} mm) because moisture below wilting point is physically unextractable by crops."
            )
        elif sm_current > 0.55:
            warnings.append(
                f"Data Quality Warning: Input soil moisture ({sm_current:.3f} m3/m3) indicates near-saturation or waterlogging (> 0.55 m3/m3)."
            )
            dr_mm = uncapped_dr_mm
        else:
            dr_mm = uncapped_dr_mm

        depletion_frac = round(dr_mm / taw_mm, 3) if taw_mm > 0 else 0.0

        factors["soil_status"] = (
            f"Current root moisture: {sm_current:.3f} m3/m3 | Depletion Dr: {dr_mm:.1f} mm "
            f"({depletion_frac * 100:.1f}% of TAW {taw_mm:.1f} mm | RAW threshold: {raw_mm:.1f} mm)"
        )

        # 3. Weather & Crop Evapotranspiration
        et0_24h = request.forecast_et0_next_24h_mm or 0.0
        etc_24h = round(crop.kc * et0_24h, 2)
        peff_mm, rain_expl = self.calculate_effective_rainfall(
            forecast_rain_mm=request.forecast_rainfall_next_24h_mm,
            rain_probability_pct=request.forecast_rain_probability_pct,
            current_depletion_dr_mm=dr_mm,
        )
        factors["weather_influence"] = f"{rain_expl} | Forecast 24h crop evapotranspiration ETc: {etc_24h:.1f} mm."

        # 4. Projected 24-Hour Depletion (Using ML Prediction if available)
        sm_pred_24h = request.predicted_soil_moisture_24h_m3m3
        if sm_pred_24h is not None:
            dr_projected_mm = self.calculate_depletion(
                theta_fc=soil.field_capacity_theta,
                theta_current=sm_pred_24h,
                root_depth_m=crop.root_depth_m,
            )
            factors["ml_forecast"] = (
                f"ML model forecasts 24h root moisture at {sm_pred_24h:.3f} m3/m3 "
                f"(projected depletion: {dr_projected_mm:.1f} mm)."
            )
        else:
            # Fallback to hydrological continuity: Dr_proj = Dr + ETc - Peff
            dr_projected_mm = max(0.0, dr_mm + etc_24h - peff_mm)
            factors["ml_forecast"] = (
                f"ML forecast absent. Hydrological continuity projects 24h depletion at {dr_projected_mm:.1f} mm."
            )

        # 5. Core Decision Logic
        action = IrrigationAction.IRRIGATION_DEFERRED
        net_depth_mm = 0.0
        timing_window = "No irrigation needed over the next 24-48 hours."

        # Condition 1: Imminent or Current Water Stress (Dr >= RAW)
        if dr_mm >= raw_mm:
            # Check if high-probability forecast rain will recharge root zone
            if peff_mm >= dr_mm and (request.forecast_rain_probability_pct or 0) >= 70.0:
                action = IrrigationAction.IRRIGATION_DEFERRED
                explanations.append(
                    f"Soil depletion ({dr_mm:.1f} mm) exceeds RAW ({raw_mm:.1f} mm), but imminent high-probability "
                    f"rainfall ({peff_mm:.1f} mm) is forecast to recharge the root zone. Irrigation DEFERRED to avoid runoff."
                )
            else:
                action = IrrigationAction.IRRIGATE_RECOMMENDED
                # Net requirement: replenish depletion minus any effective rain
                net_depth_mm = max(0.0, dr_mm - peff_mm)
                timing_window = "Immediate (within next 4-6 hours, preferred early morning or evening)."
                explanations.append(
                    f"Current soil moisture ({sm_current:.3f} m3/m3) has depleted {dr_mm:.1f} mm, "
                    f"exceeding allowable stress threshold RAW ({raw_mm:.1f} mm). Irrigation is REQUIRED."
                )

        # Condition 2: Pre-emptive Predictive Scheduling (Current Dr < RAW, but Projected Dr >= RAW)
        elif dr_projected_mm >= raw_mm:
            if peff_mm >= dr_projected_mm and (request.forecast_rain_probability_pct or 0) >= 60.0:
                action = IrrigationAction.IRRIGATION_DEFERRED
                explanations.append(
                    f"Projected 24h depletion ({dr_projected_mm:.1f} mm) reaches RAW ({raw_mm:.1f} mm), "
                    f"but upcoming rainfall ({peff_mm:.1f} mm) will recharge the profile. Irrigation DEFERRED."
                )
            else:
                action = IrrigationAction.IRRIGATE_RECOMMENDED
                net_depth_mm = max(0.0, dr_projected_mm - peff_mm)
                timing_window = "Anticipatory (schedule within next 12-18 hours before stress threshold is crossed)."
                explanations.append(
                    f"Current soil moisture ({sm_current:.3f} m3/m3) is above stress threshold, but forward "
                    f"prediction indicates root zone will cross stress threshold ({raw_mm:.1f} mm) within 24 hours. "
                    f"Anticipatory irrigation recommended."
                )

        # Condition 3: Soil moisture comfortably within available range
        else:
            action = IrrigationAction.IRRIGATION_DEFERRED
            explanations.append(
                f"Soil moisture ({sm_current:.3f} m3/m3) is sufficient. Depletion ({dr_mm:.1f} mm) is well below "
                f"management allowed threshold ({raw_mm:.1f} mm). Irrigation DEFERRED."
            )

        # 6. Water Volume Calculations (if recommended)
        gross_depth_mm = None
        vol_m3 = None
        vol_liters = None

        if action == IrrigationAction.IRRIGATE_RECOMMENDED and net_depth_mm > 0:
            # Apply maximum application depth limit
            max_depth = field.max_irrigation_depth_per_event_mm
            if net_depth_mm > max_depth:
                uncapped_depth_mm = net_depth_mm
                remaining_deficit_mm = round(uncapped_depth_mm - max_depth, 2)
                warnings.append(
                    f"Single-Event Limit Reached: Calculated net requirement ({uncapped_depth_mm:.1f} mm) exceeded "
                    f"maximum application limit ({max_depth:.1f} mm). Capped at {max_depth:.1f} mm to prevent deep "
                    f"percolation and nutrient leaching. Remaining profile deficit is {remaining_deficit_mm:.1f} mm. "
                    f"A multi-event split application is required; schedule reassessment after 24h infiltration."
                )
                net_depth_mm = max_depth

            # Account for application efficiency (gross depth = net depth / eta)
            eff = field.application_efficiency
            gross_depth_mm = round(net_depth_mm / eff, 2)

            # Volume = (gross_depth_mm / 1000) * area_m2
            area_m2 = field.area_m2
            vol_m3 = round((gross_depth_mm / 1000.0) * area_m2, 2)

            # Check maximum volume cap if configured
            if field.max_irrigation_volume_m3 and vol_m3 > field.max_irrigation_volume_m3:
                warnings.append(
                    f"Calculated volume ({vol_m3:.1f} m3) exceeded field water budget limit "
                    f"({field.max_irrigation_volume_m3:.1f} m3). Capped at limit."
                )
                vol_m3 = field.max_irrigation_volume_m3
                gross_depth_mm = round((vol_m3 * 1000.0) / area_m2, 2)
                net_depth_mm = round(gross_depth_mm * eff, 2)

            vol_liters = round(vol_m3 * 1000.0, 1)

        # 7. Conventional Baseline Comparison (Phase 4)
        baseline_comp = self._evaluate_baseline(
            field=field,
            current_dr_mm=dr_mm,
            raw_mm=raw_mm,
            predictive_action=action,
            predictive_vol_m3=vol_m3 or 0.0,
            forecast_rain_mm=request.forecast_rainfall_next_24h_mm or 0.0,
            predictive_gross_depth_mm=gross_depth_mm or 0.0,
        )

        return IrrigationRecommendationResponse(
            recommendation_id=rec_id,
            field_id=field.field_id,
            generated_at_utc=gen_time_utc,
            action=action,
            net_irrigation_depth_mm=round(net_depth_mm, 2) if net_depth_mm > 0 else None,
            gross_irrigation_depth_mm=gross_depth_mm,
            water_volume_m3=vol_m3,
            water_volume_liters=vol_liters,
            total_available_water_taw_mm=taw_mm,
            readily_available_water_raw_mm=raw_mm,
            current_depletion_dr_mm=dr_mm,
            current_depletion_fraction=depletion_frac,
            effective_rainfall_considered_mm=peff_mm,
            crop_evapotranspiration_etc_mm=etc_24h,
            factors_considered=factors,
            explanations=explanations,
            warnings=warnings,
            missing_inputs=missing_inputs,
            baseline_comparison=baseline_comp,
            suggested_timing_window=timing_window,
        )

    def _evaluate_baseline(
        self,
        field: FieldConfig,
        current_dr_mm: float,
        raw_mm: float,
        predictive_action: IrrigationAction,
        predictive_vol_m3: float,
        forecast_rain_mm: float,
        predictive_gross_depth_mm: float,
    ) -> BaselineComparison:
        """Simulates a conventional static MAD threshold controller that ignores forward weather."""
        area_m2 = field.area_m2
        eff = field.application_efficiency

        # Baseline triggers whenever current Dr >= RAW
        if current_dr_mm >= raw_mm:
            base_action = IrrigationAction.IRRIGATE_RECOMMENDED
            base_net = min(current_dr_mm, field.max_irrigation_depth_per_event_mm)
            base_gross = round(base_net / eff, 2)
            base_vol = round((base_gross / 1000.0) * area_m2, 2)
        else:
            base_action = IrrigationAction.IRRIGATION_DEFERRED
            base_gross = 0.0
            base_vol = 0.0

        vol_diff = round(base_vol - predictive_vol_m3, 2)

        if base_action == IrrigationAction.IRRIGATE_RECOMMENDED and predictive_action == IrrigationAction.IRRIGATION_DEFERRED:
            expl = (
                f"Conventional threshold controller would apply {base_vol:.1f} m3 ({base_gross:.1f} mm) immediately. "
                f"Predictive engine deferred irrigation due to upcoming rainfall ({forecast_rain_mm:.1f} mm), "
                f"saving {vol_diff:.1f} m3 and avoiding over-irrigation."
            )
        elif base_action == IrrigationAction.IRRIGATION_DEFERRED and predictive_action == IrrigationAction.IRRIGATE_RECOMMENDED:
            expl = (
                f"Conventional controller deferred because current moisture is above threshold. "
                f"Predictive engine scheduled anticipatory application ({predictive_vol_m3:.1f} m3) "
                f"to prevent crop stress before the 24h deficit crosses RAW."
            )
        elif base_action == IrrigationAction.IRRIGATE_RECOMMENDED and predictive_action == IrrigationAction.IRRIGATE_RECOMMENDED:
            expl = (
                f"Both controllers recommend irrigation. Predictive engine adjusted volume by accounting for "
                f"effective rainfall (volume difference: {vol_diff:+.1f} m3)."
            )
        else:
            expl = "Both controllers agree that soil moisture is sufficient; irrigation deferred."

        return BaselineComparison(
            baseline_action=base_action,
            baseline_gross_depth_mm=base_gross,
            baseline_volume_m3=base_vol,
            predictive_action=predictive_action,
            predictive_gross_depth_mm=predictive_gross_depth_mm,
            predictive_volume_m3=predictive_vol_m3,
            volume_difference_m3=vol_diff,
            explanation=expl,
        )
