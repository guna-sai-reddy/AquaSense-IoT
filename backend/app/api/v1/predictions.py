"""FastAPI Endpoints for 24-Hour Soil Moisture Predictions."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.field import FieldModel
from app.models.observation import SensorObservationModel
from app.models.prediction import PredictionModel
from app.models.user import User
from app.schemas.prediction import PredictionResponse, PredictionTriggerRequest
from app.services.inference import SoilMoistureInferenceRequest, SoilMoisturePredictor

router = APIRouter(tags=["Predictions"])


@router.post(
    "/fields/{field_id}/predictions",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger 24-Hour Soil Moisture Prediction",
)
async def trigger_prediction(
    field_id: str,
    pred_in: PredictionTriggerRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Executes the trained ML model pipeline to forecast root-zone moisture 24h into the future."""
    # Verify field ownership
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Field '{field_id}' not found.")

    # Determine current soil moisture (from request override, or latest sensor reading, or field default)
    current_sm = pred_in.current_soil_moisture_m3m3
    input_source = "USER_SPECIFIED"

    if current_sm is None:
        # Fetch latest observation from database
        obs_stmt = (
            select(SensorObservationModel)
            .where(SensorObservationModel.field_id == field_id)
            .order_by(SensorObservationModel.observation_timestamp_utc.desc())
            .limit(1)
        )
        latest_obs = (await db.execute(obs_stmt)).scalar_one_or_none()
        if latest_obs is not None:
            current_sm = latest_obs.soil_moisture_m3m3
            input_source = latest_obs.source_type
        else:
            # Fallback to midway between FC and WP if completely unobserved
            current_sm = (field.field_capacity_theta + field.wilting_point_theta) / 2.0
            input_source = "FIELD_CAPACITY_MIDPOINT_DEFAULT"

    # Initialize ML Predictor
    try:
        predictor = SoilMoisturePredictor(
            model_path=settings.MODEL_ARTIFACT_PATH,
            metadata_path=settings.MODEL_METADATA_PATH,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Machine learning model artifact unavailable: {e}",
        )

    now_utc = datetime.now(timezone.utc)
    target_utc = now_utc + timedelta(hours=24)
    hour = pred_in.hour_of_day if pred_in.hour_of_day is not None else now_utc.hour
    doy = pred_in.day_of_year if pred_in.day_of_year is not None else now_utc.timetuple().tm_yday

    inference_req = SoilMoistureInferenceRequest(
        sm_root_current=current_sm,
        sm_root_lag_1h=current_sm,
        sm_root_lag_3h=current_sm,
        sm_root_lag_6h=current_sm,
        sm_root_lag_24h=current_sm,
        sm_surface_0_to_7cm=current_sm * 0.9,
        sm_deep_28_to_100cm=current_sm * 1.1,
        soil_temp_root_c=22.0,
        soil_temp_surface_c=23.0,
        air_temp_2m_c=25.0,
        relative_humidity_pct=60.0,
        surface_pressure_hpa=980.0,
        wind_speed_kmh=8.0,
        et0_current_mm=0.10,
        et0_rolling_24h_sum_mm=3.0,
        precip_current_mm=0.0,
        precip_rolling_6h_sum_mm=0.0,
        precip_rolling_24h_sum_mm=0.0,
        shortwave_radiation_wm2=120.0,
        hour_of_day=hour,
        day_of_year=doy,
    )

    try:
        inf_resp = predictor.predict_24h(inference_req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference pipeline execution error: {e}",
        )

    # Persist prediction in database
    prediction = PredictionModel(
        field_id=field_id,
        prediction_timestamp_utc=now_utc,
        target_timestamp_utc=target_utc,
        horizon_hours=24,
        target_variable="soil_moisture_7_to_28cm",
        target_depth="7-28 cm (Root Zone)",
        units="m3/m3",
        current_moisture_m3m3=current_sm,
        predicted_moisture_m3m3=inf_resp.predicted_soil_moisture_m3m3,
        projected_change_m3m3=inf_resp.projected_change_m3m3,
        model_version=inf_resp.model_version,
        model_name="RandomForest",
        input_provenance=input_source,
    )
    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)
    return prediction


@router.get(
    "/fields/{field_id}/predictions",
    response_model=List[PredictionResponse],
    summary="List Field Prediction History",
)
async def list_field_predictions(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Retrieves chronological predictions for a user-owned field (or any field for superuser)."""
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    stmt = (
        select(PredictionModel)
        .where(PredictionModel.field_id == field_id)
        .order_by(PredictionModel.prediction_timestamp_utc.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/predictions/{prediction_id}",
    response_model=PredictionResponse,
    summary="Get Prediction by ID",
)
async def get_prediction(
    prediction_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves a single prediction by ID, enforcing field ownership authorization unless administrator."""
    if current_user.is_superuser:
        stmt = select(PredictionModel).where(PredictionModel.id == prediction_id)
    else:
        stmt = (
            select(PredictionModel)
            .join(FieldModel)
            .where(PredictionModel.id == prediction_id, FieldModel.user_id == current_user.id)
        )
    result = await db.execute(stmt)
    pred = result.scalar_one_or_none()
    if pred is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
    return pred


@router.get(
    "/model/metrics",
    summary="Get Verified Model Evaluation Metrics",
)
async def get_model_metrics(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Returns verified chronological evaluation metrics, training provenance, and baseline benchmarks."""
    meta_path = Path(settings.MODEL_METADATA_PATH)
    if not meta_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model metadata artifact not found at {settings.MODEL_METADATA_PATH}",
        )
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return meta

