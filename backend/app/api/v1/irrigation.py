"""FastAPI Endpoints for Irrigation Decision Engine Advisories."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.event import IrrigationEventModel
from app.models.field import FieldModel
from app.models.observation import SensorObservationModel
from app.models.prediction import PredictionModel
from app.models.recommendation import RecommendationModel
from app.models.user import User
from app.schemas.field_config import CropConfig, FieldConfig, SoilConfig
from app.schemas.recommendation import (
    BaselineComparison,
    IrrigationAction,
    IrrigationRecommendationRequest,
    IrrigationRecommendationResponse,
)
from app.services.decision_engine import IrrigationDecisionEngine

router = APIRouter(tags=["Irrigation Recommendations"])


class IrrigationTriggerPayload(BaseModel):
    """Optional overrides when requesting an irrigation recommendation."""

    soil_moisture_m3m3: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override current soil moisture; defaults to latest field observation if omitted.",
    )
    forecast_rainfall_next_24h_mm: Optional[float] = Field(default=0.0, ge=0.0)
    forecast_rain_probability_pct: Optional[float] = Field(default=10.0, ge=0.0, le=100.0)
    forecast_et0_next_24h_mm: Optional[float] = Field(default=3.5, ge=0.0)


@router.post(
    "/fields/{field_id}/irrigation/recommendations",
    response_model=IrrigationRecommendationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Precision Irrigation Advisory",
)
async def generate_irrigation_recommendation(
    field_id: str,
    payload: IrrigationTriggerPayload,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Executes the FAO-56 decision engine combining latest observations, ML forecasts, and weather."""
    # 1. Verify field ownership
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field_record = (await db.execute(field_stmt)).scalar_one_or_none()
    if field_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Field '{field_id}' not found.")

    # 2. Build domain FieldConfig from database record
    field_domain = FieldConfig(
        field_id=field_record.id,
        field_name=field_record.name,
        latitude=field_record.latitude,
        longitude=field_record.longitude,
        area_value=field_record.area_value,
        area_unit=field_record.area_unit,
        irrigation_method=field_record.irrigation_method,
        application_efficiency=field_record.application_efficiency,
        max_depth_per_event_mm=field_record.max_depth_per_event_mm,
        max_volume_m3=field_record.max_volume_m3,
        crop=CropConfig(
            crop_name=field_record.crop_name,
            growth_stage=field_record.growth_stage,
            kc=field_record.kc,
            root_depth_m=field_record.root_depth_m,
            depletion_fraction_p=field_record.depletion_fraction_p,
        ),
        soil=SoilConfig(
            soil_texture=field_record.soil_texture,
            field_capacity_theta=field_record.field_capacity_theta,
            wilting_point_theta=field_record.wilting_point_theta,
        ),
    )

    # 3. Resolve Current Soil Moisture & Timestamps
    current_sm = payload.soil_moisture_m3m3
    obs_time_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    source_type = "USER_SPECIFIED"

    if current_sm is not None:
        if not (0.01 <= current_sm <= 0.65):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Soil moisture {current_sm} m³/m³ is physically unrealistic (valid range: 0.01 - 0.65 m³/m³).",
            )
    else:
        obs_stmt = (
            select(SensorObservationModel)
            .where(SensorObservationModel.field_id == field_id)
            .order_by(SensorObservationModel.observation_timestamp_utc.desc())
            .limit(1)
        )
        latest_obs = (await db.execute(obs_stmt)).scalar_one_or_none()
        if latest_obs is not None:
            current_sm = latest_obs.soil_moisture_m3m3
            obs_time_str = latest_obs.observation_timestamp_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            source_type = latest_obs.source_type
        else:
            # Fallback to midpoint default with explicit provisional provenance
            current_sm = (field_record.field_capacity_theta + field_record.wilting_point_theta) / 2.0
            source_type = "PROVISIONAL_DEFAULT_MIDPOINT"

    # 4. Resolve latest ML prediction if available
    pred_stmt = (
        select(PredictionModel)
        .where(PredictionModel.field_id == field_id)
        .order_by(PredictionModel.prediction_timestamp_utc.desc())
        .limit(1)
    )
    latest_pred = (await db.execute(pred_stmt)).scalar_one_or_none()
    predicted_sm = latest_pred.predicted_moisture_m3m3 if latest_pred else None
    prediction_id = latest_pred.id if latest_pred else None

    # 5. Build Decision Engine Request
    rec_request = IrrigationRecommendationRequest(
        field=field_domain,
        latest_soil_moisture_m3m3=current_sm,
        latest_soil_moisture_depth_stratum="root_zone_7_to_28cm",
        observation_timestamp_utc=obs_time_str,
        observation_source_type=source_type if source_type in ["MEASURED", "SIMULATED", "WEATHER_MODEL_DERIVED"] else "WEATHER_MODEL_DERIVED",
        predicted_soil_moisture_24h_m3m3=predicted_sm,
        forecast_rainfall_next_24h_mm=payload.forecast_rainfall_next_24h_mm,
        forecast_rain_probability_pct=payload.forecast_rain_probability_pct,
        forecast_et0_next_24h_mm=payload.forecast_et0_next_24h_mm,
    )

    engine = IrrigationDecisionEngine()
    rec_response = engine.generate_recommendation(rec_request)

    # 6. Persist Recommendation Record in PostgreSQL
    now_utc = datetime.now(timezone.utc)
    rec_db = RecommendationModel(
        id=rec_response.recommendation_id,
        field_id=field_id,
        prediction_id=prediction_id,
        generated_at_utc=now_utc,
        action=rec_response.action.value,
        net_irrigation_depth_mm=rec_response.net_irrigation_depth_mm,
        gross_irrigation_depth_mm=rec_response.gross_irrigation_depth_mm,
        water_volume_m3=rec_response.water_volume_m3,
        water_volume_liters=rec_response.water_volume_liters,
        total_available_water_taw_mm=rec_response.total_available_water_taw_mm,
        readily_available_water_raw_mm=rec_response.readily_available_water_raw_mm,
        current_depletion_dr_mm=rec_response.current_depletion_dr_mm,
        current_depletion_fraction=rec_response.current_depletion_fraction,
        effective_rainfall_considered_mm=rec_response.effective_rainfall_considered_mm,
        crop_evapotranspiration_etc_mm=rec_response.crop_evapotranspiration_etc_mm,
        explanations_json=json.dumps(rec_response.explanations),
        warnings_json=json.dumps(rec_response.warnings) if rec_response.warnings else None,
        baseline_comparison_json=json.dumps(rec_response.baseline_comparison.model_dump()) if rec_response.baseline_comparison else None,
        suggested_timing_window=rec_response.suggested_timing_window,
    )
    db.add(rec_db)
    await db.commit()

    return rec_response


@router.get(
    "/fields/{field_id}/irrigation/recommendations",
    summary="List Field Irrigation Recommendations",
)
async def list_field_recommendations(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Retrieves chronological recommendation history for a field."""
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    stmt = (
        select(RecommendationModel)
        .where(RecommendationModel.field_id == field_id)
        .order_by(RecommendationModel.generated_at_utc.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # Format list
    output = []
    for r in records:
        output.append({
            "id": r.id,
            "recommendation_id": r.id,
            "field_id": r.field_id,
            "generated_at_utc": r.generated_at_utc,
            "action": r.action,
            "net_irrigation_depth_mm": r.net_irrigation_depth_mm,
            "gross_irrigation_depth_mm": r.gross_irrigation_depth_mm,
            "water_volume_m3": r.water_volume_m3,
            "water_volume_liters": r.water_volume_liters,
            "total_available_water_taw_mm": r.total_available_water_taw_mm,
            "readily_available_water_raw_mm": r.readily_available_water_raw_mm,
            "current_depletion_dr_mm": r.current_depletion_dr_mm,
            "current_depletion_fraction": r.current_depletion_fraction,
            "effective_rainfall_considered_mm": r.effective_rainfall_considered_mm,
            "crop_evapotranspiration_etc_mm": r.crop_evapotranspiration_etc_mm,
            "explanations": json.loads(r.explanations_json) if r.explanations_json else [],
            "warnings": json.loads(r.warnings_json) if r.warnings_json else [],
            "baseline_comparison": json.loads(r.baseline_comparison_json) if r.baseline_comparison_json else None,
            "suggested_timing_window": r.suggested_timing_window,
        })
    return output


@router.get(
    "/irrigation/recommendations/{recommendation_id}",
    summary="Get Recommendation by ID",
)
async def get_recommendation_by_id(
    recommendation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves a single irrigation recommendation, enforcing ownership unless administrator."""
    if current_user.is_superuser:
        stmt = select(RecommendationModel).where(RecommendationModel.id == recommendation_id)
    else:
        stmt = (
            select(RecommendationModel)
            .join(FieldModel)
            .where(RecommendationModel.id == recommendation_id, FieldModel.user_id == current_user.id)
        )
    result = await db.execute(stmt)
    rec = result.scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")

    return {
        "id": rec.id,
        "field_id": rec.field_id,
        "generated_at_utc": rec.generated_at_utc,
        "action": rec.action,
        "net_irrigation_depth_mm": rec.net_irrigation_depth_mm,
        "gross_irrigation_depth_mm": rec.gross_irrigation_depth_mm,
        "water_volume_m3": rec.water_volume_m3,
        "water_volume_liters": rec.water_volume_liters,
        "total_available_water_taw_mm": rec.total_available_water_taw_mm,
        "readily_available_water_raw_mm": rec.readily_available_water_raw_mm,
        "current_depletion_dr_mm": rec.current_depletion_dr_mm,
        "effective_rainfall_considered_mm": rec.effective_rainfall_considered_mm,
        "explanations": json.loads(rec.explanations_json) if rec.explanations_json else [],
        "warnings": json.loads(rec.warnings_json) if rec.warnings_json else [],
        "baseline_comparison": json.loads(rec.baseline_comparison_json) if rec.baseline_comparison_json else None,
        "suggested_timing_window": rec.suggested_timing_window,
    }


class IrrigationEventCreate(BaseModel):
    """Payload to log an executed or planned irrigation application."""
    recommendation_id: Optional[str] = None
    actual_volume_m3: float = Field(..., gt=0.0, description="Volume of water delivered in m3")
    actual_depth_mm: float = Field(..., gt=0.0, description="Equivalent depth delivered in mm")
    irrigation_method: str = Field(default="drip", description="Irrigation method (drip, sprinkler, furrow)")
    pre_irrigation_sm: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    post_irrigation_sm: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    execution_status: str = Field(default="COMPLETED", description="COMPLETED, PARTIAL, or CANCELLED")
    operator_notes: Optional[str] = None


@router.post(
    "/fields/{field_id}/events",
    status_code=status.HTTP_201_CREATED,
    summary="Log Executed Irrigation Event",
)
async def log_irrigation_event(
    field_id: str,
    event_in: IrrigationEventCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Records an executed or planned irrigation application for research tracking and water-use accounting."""
    # Records an executed or planned irrigation application
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    now_utc = datetime.now(timezone.utc)
    event_db = IrrigationEventModel(
        field_id=field_id,
        recommendation_id=event_in.recommendation_id,
        event_timestamp_utc=now_utc,
        actual_volume_m3=round(event_in.actual_volume_m3, 2),
        actual_depth_mm=round(event_in.actual_depth_mm, 2),
        irrigation_method=event_in.irrigation_method,
        pre_irrigation_sm=round(event_in.pre_irrigation_sm, 3) if event_in.pre_irrigation_sm is not None else None,
        post_irrigation_sm=round(event_in.post_irrigation_sm, 3) if event_in.post_irrigation_sm is not None else None,
        execution_status=event_in.execution_status,
        operator_notes=event_in.operator_notes,
    )
    db.add(event_db)
    await db.commit()
    await db.refresh(event_db)
    return {
        "id": event_db.id,
        "field_id": event_db.field_id,
        "recommendation_id": event_db.recommendation_id,
        "event_timestamp_utc": event_db.event_timestamp_utc,
        "actual_volume_m3": event_db.actual_volume_m3,
        "actual_depth_mm": event_db.actual_depth_mm,
        "irrigation_method": event_db.irrigation_method,
        "pre_irrigation_sm": event_db.pre_irrigation_sm,
        "post_irrigation_sm": event_db.post_irrigation_sm,
        "execution_status": event_db.execution_status,
        "operator_notes": event_db.operator_notes,
    }


@router.get(
    "/fields/{field_id}/events",
    summary="Get Logged Irrigation Events",
)
async def list_irrigation_events(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=500),
):
    """Retrieves chronological history of executed irrigation events for the field."""
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    stmt = (
        select(IrrigationEventModel)
        .where(IrrigationEventModel.field_id == field_id)
        .order_by(IrrigationEventModel.event_timestamp_utc.desc())
        .limit(limit)
    )
    events = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": ev.id,
            "field_id": ev.field_id,
            "recommendation_id": ev.recommendation_id,
            "event_timestamp_utc": ev.event_timestamp_utc,
            "actual_volume_m3": ev.actual_volume_m3,
            "actual_depth_mm": ev.actual_depth_mm,
            "irrigation_method": ev.irrigation_method,
            "pre_irrigation_sm": ev.pre_irrigation_sm,
            "post_irrigation_sm": ev.post_irrigation_sm,
            "execution_status": ev.execution_status,
            "operator_notes": ev.operator_notes,
        }
        for ev in events
    ]

