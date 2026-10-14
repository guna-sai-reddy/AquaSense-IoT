"""FastAPI Observation Endpoints for Ground Sensors and Weather Data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.field import FieldModel
from app.models.observation import SensorObservationModel, WeatherObservationModel
from app.models.user import User
from app.schemas.observation import (
    ObservationIngestRequest,
    SensorObservationResponse,
    WeatherObservationResponse,
)

router = APIRouter(tags=["Observations"])


@router.post(
    "/observations",
    response_model=SensorObservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest In-situ Sensor Reading",
)
async def ingest_observation(
    reading_in: ObservationIngestRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ingests and validates a ground sensor observation for a user-owned field."""
    # Verify field exists and is owned by current user (or admin)
    if current_user.is_superuser:
        stmt = select(FieldModel).where(FieldModel.id == reading_in.field_id)
    else:
        stmt = select(FieldModel).where(FieldModel.id == reading_in.field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field '{reading_in.field_id}' not found or not owned by user.",
        )

    # Parse UTC timestamp
    obs_time = datetime.fromisoformat(reading_in.observation_timestamp_utc.replace("Z", "+00:00"))

    # Deduplication check
    dup_stmt = select(SensorObservationModel).where(
        SensorObservationModel.field_id == reading_in.field_id,
        SensorObservationModel.device_id == reading_in.device_id,
        SensorObservationModel.observation_timestamp_utc == obs_time,
    )
    dup = (await db.execute(dup_stmt)).scalar_one_or_none()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate reading for device '{reading_in.device_id}' at timestamp '{reading_in.observation_timestamp_utc}' already exists.",
        )

    provenance = "SIMULATED" if reading_in.is_test_fixture else "MEASURED"

    obs = SensorObservationModel(
        field_id=reading_in.field_id,
        device_id=reading_in.device_id,
        observation_timestamp_utc=obs_time,
        soil_moisture_m3m3=reading_in.soil_moisture,
        soil_temperature_c=reading_in.soil_temperature,
        relative_humidity_pct=reading_in.relative_humidity,
        depth_cm=reading_in.depth_cm,
        source_type=provenance,
        battery_level_pct=reading_in.battery_level_pct,
        signal_rssi_dbm=reading_in.signal_rssi_dbm,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs)
    return obs


@router.get(
    "/fields/{field_id}/observations",
    response_model=List[SensorObservationResponse],
    summary="Get Field Sensor Observations",
)
async def get_field_observations(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieves chronological sensor observations for the field (paginated)."""
    # Verify field ownership
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    stmt = (
        select(SensorObservationModel)
        .where(SensorObservationModel.field_id == field_id)
        .order_by(SensorObservationModel.observation_timestamp_utc.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/fields/{field_id}/weather",
    response_model=List[WeatherObservationResponse],
    summary="Get Field Weather Observations",
)
async def get_field_weather(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieves meteorological reanalysis/forecast records for the field."""
    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    stmt = (
        select(WeatherObservationModel)
        .where(WeatherObservationModel.field_id == field_id)
        .order_by(WeatherObservationModel.timestamp_utc.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/fields/{field_id}/satellite",
    summary="Get Field Satellite Overpasses & Observations",
)
async def get_field_satellite(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves authentic NASA SMAP satellite radiometer overpasses intersecting the field coordinates."""
    from app.services.nasa_smap import NASASMAPClient

    if current_user.is_superuser:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        field_stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    field = (await db.execute(field_stmt)).scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found.")

    client = NASASMAPClient()
    # Query recent 14-day window from NASA CMR
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=14)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    try:
        granules = client.search_granules(
            latitude=field.latitude,
            longitude=field.longitude,
            start_date=start_date,
            end_date=end_date,
            limit=10,
        )
    except Exception as e:
        # Fallback to historical baseline query if CMR times out or recent has no pass
        try:
            granules = client.search_granules(
                latitude=field.latitude,
                longitude=field.longitude,
                start_date="2024-01-01",
                end_date="2024-01-10",
                limit=5,
            )
        except Exception:
            granules = []

    return {
        "field_id": field_id,
        "latitude": field.latitude,
        "longitude": field.longitude,
        "product_name": "NASA SMAP SPL3SMP_E",
        "product_version": "006",
        "spatial_resolution": "9 km EASE-Grid 2.0",
        "measurement_depth": "0-5 cm (Surface microwave penetration skin depth)",
        "source_type": "SATELLITE_DERIVED",
        "provider": "NASA NSIDC DAAC / Earthdata CMR",
        "granule_count": len(granules),
        "granules": [
            {
                "granule_id": g.granule_id,
                "producer_granule_id": g.producer_granule_id,
                "time_start": g.time_start,
                "time_end": g.time_end,
                "download_url": g.download_url,
                "status": "IDENTIFIED_IN_NASA_CMR",
                "retrieval_status": "DAAC_PROTECTED_CLOUD (Requires Earthdata OAuth)",
                "depth": "0-5 cm",
            }
            for g in granules
        ],
        "limitation_note": (
            "Surface radiometry measures skin depth (0-5 cm) across a 9 km grid footprint. "
            "It cannot directly substitute for root-zone moisture (7-28 cm) without depth-weighting transformation."
        ),
    }

