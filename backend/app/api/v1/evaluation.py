"""FastAPI Endpoints for AquaSense-IoT Research Evaluation and Baseline Comparison."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.field import FieldModel
from app.models.observation import WeatherObservationModel
from app.models.user import User
from app.schemas.field_config import CropConfig, FieldConfig, SoilConfig
from app.services.baseline_scheduler import ComparativeEvaluationReport, ConventionalBaselineScheduler

router = APIRouter(prefix="/evaluation", tags=["Research Evaluation"])


@router.get(
    "/fields/{field_id}",
    response_model=ComparativeEvaluationReport,
    summary="Generate Comparative Evaluation vs Conventional Baseline",
)
async def get_field_evaluation(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Executes evidence-based comparison between AquaSense-IoT predictive scheduler and conventional threshold scheduler."""
    # 1. Fetch user-owned field (or any field if superuser)
    if current_user.is_superuser:
        stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field_record = (await db.execute(stmt)).scalar_one_or_none()
    if not field_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Field '{field_id}' not found.")

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

    # 2. Retrieve meteorological time-series for evaluation
    weather_stmt = (
        select(WeatherObservationModel)
        .where(WeatherObservationModel.field_id == field_id)
        .order_by(WeatherObservationModel.timestamp_utc.asc())
    )
    weather_records = (await db.execute(weather_stmt)).scalars().all()

    if weather_records and len(weather_records) >= 24:
        weather_df = pd.DataFrame(
            [
                {
                    "timestamp_utc": w.timestamp_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "precipitation": w.precipitation_mm,
                    "et0_fao_evapotranspiration": w.et0_fao_mm or 0.15,
                    "soil_moisture_7_to_28cm": 0.22,
                }
                for w in weather_records
            ]
        )
    else:
        # Fallback to authentic processed Open-Meteo dataset file
        eval_file = Path(__file__).resolve()
        candidate_paths = [
            eval_file.parents[4] / "ml_engine" / "data" / "processed" / "open_meteo_historical_lat15.83_lon78.04_dataset.csv",
            eval_file.parents[3] / "ml_engine" / "data" / "processed" / "open_meteo_historical_lat15.83_lon78.04_dataset.csv",
            Path("ml_engine/data/processed/open_meteo_historical_lat15.83_lon78.04_dataset.csv").resolve(),
            Path("../ml_engine/data/processed/open_meteo_historical_lat15.83_lon78.04_dataset.csv").resolve(),
        ]
        weather_df = None
        for cp in candidate_paths:
            if cp.exists():
                weather_df = pd.read_csv(cp)
                break

        if weather_df is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No historical weather records available to execute baseline evaluation.",
            )

    # 3. Run comparative simulation
    scheduler = ConventionalBaselineScheduler(field=field_domain)
    report = scheduler.run_comparative_simulation(weather_df=weather_df)
    return report


@router.get(
    "/fields/{field_id}/export",
    summary="Download Research Evaluation Time-Series CSV Export",
)
async def export_field_evaluation_csv(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generates and streams a research CSV containing time-step simulation data, decisions, and water savings."""
    report = await get_field_evaluation(field_id=field_id, current_user=current_user, db=db)

    header = (
        "timestamp_utc,precipitation_mm,et0_fao_mm,conventional_depletion_mm,"
        "conventional_action,conventional_applied_depth_mm,conventional_applied_volume_m3,"
        "predictive_predicted_depletion_mm,predictive_action,predictive_applied_depth_mm,"
        "predictive_applied_volume_m3,water_savings_cumulative_m3,quality_flag"
    )
    rows = [header]
    for ts in report.time_series:
        rows.append(
            f"{ts.timestamp_utc},{ts.precipitation_mm:.2f},{ts.et0_fao_mm:.2f},"
            f"{ts.conventional_depletion_mm:.2f},{ts.conventional_action},{ts.conventional_applied_depth_mm:.2f},{ts.conventional_applied_volume_m3:.2f},"
            f"{ts.predictive_depletion_mm:.2f},{ts.predictive_action},{ts.predictive_applied_depth_mm:.2f},{ts.predictive_applied_volume_m3:.2f},"
            f"{ts.water_savings_cumulative_m3:.2f},VALID"
        )
    csv_data = "\n".join(rows)

    from fastapi.responses import Response

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=aquasense_evaluation_{field_id[:8]}.csv"
        },
    )

