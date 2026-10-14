"""FastAPI Administrative Endpoints for AquaSense-IoT Platform Management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_superuser
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.event import IrrigationEventModel
from app.models.field import FieldModel
from app.models.observation import SensorObservationModel, WeatherObservationModel
from app.models.prediction import PredictionModel
from app.models.recommendation import RecommendationModel
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["Platform Administration"])


class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: str
    fields_count: int


class AdminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False


class AdminUserStatusUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class AdminOverviewStats(BaseModel):
    total_users: int
    total_fields: int
    total_sensor_observations: int
    total_weather_observations: int
    total_predictions: int
    total_recommendations: int
    total_irrigation_events: int
    server_time_utc: str


@router.get("/stats", response_model=AdminOverviewStats, summary="System-Wide Statistical Metrics")
async def get_admin_stats(
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregates platform-wide telemetry, user base, and execution counters for admin monitoring."""
    u_cnt = (await db.execute(select(func.count(User.id)))).scalar() or 0
    f_cnt = (await db.execute(select(func.count(FieldModel.id)))).scalar() or 0
    obs_cnt = (await db.execute(select(func.count(SensorObservationModel.id)))).scalar() or 0
    w_cnt = (await db.execute(select(func.count(WeatherObservationModel.id)))).scalar() or 0
    p_cnt = (await db.execute(select(func.count(PredictionModel.id)))).scalar() or 0
    rec_cnt = (await db.execute(select(func.count(RecommendationModel.id)))).scalar() or 0
    ev_cnt = (await db.execute(select(func.count(IrrigationEventModel.id)))).scalar() or 0

    return AdminOverviewStats(
        total_users=u_cnt,
        total_fields=f_cnt,
        total_sensor_observations=obs_cnt,
        total_weather_observations=w_cnt,
        total_predictions=p_cnt,
        total_recommendations=rec_cnt,
        total_irrigation_events=ev_cnt,
        server_time_utc=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/users", response_model=List[AdminUserResponse], summary="List All Registered Users")
async def list_users_admin(
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves all user accounts with their field counts and role configurations."""
    stmt = select(User).order_by(User.created_at.desc())
    users = (await db.execute(stmt)).scalars().all()

    response: List[AdminUserResponse] = []
    for u in users:
        # Count owned fields
        f_count_stmt = select(func.count(FieldModel.id)).where(FieldModel.user_id == u.id)
        f_count = (await db.execute(f_count_stmt)).scalar() or 0
        response.append(
            AdminUserResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                is_active=u.is_active,
                is_superuser=u.is_superuser,
                created_at=u.created_at.isoformat() if u.created_at else "",
                fields_count=f_count,
            )
        )
    return response


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED, summary="Create New User")
async def create_user_admin(
    payload: AdminUserCreateRequest,
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin provisioning of new operator or research administrator accounts."""
    check_stmt = select(User).where(User.email == payload.email)
    existing = (await db.execute(check_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    new_user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        is_active=payload.is_active,
        is_superuser=payload.is_superuser,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return AdminUserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        is_superuser=new_user.is_superuser,
        created_at=new_user.created_at.isoformat(),
        fields_count=0,
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserResponse, summary="Modify User Privileges or Status")
async def update_user_status_admin(
    user_id: str,
    payload: AdminUserStatusUpdateRequest,
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enables/disables user accounts or promotes/demotes administrator privileges."""
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Guard against self-deactivation
    if target_user.id == admin_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own administrator account.",
        )

    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    if payload.is_superuser is not None:
        target_user.is_superuser = payload.is_superuser

    await db.commit()
    await db.refresh(target_user)

    f_count_stmt = select(func.count(FieldModel.id)).where(FieldModel.user_id == target_user.id)
    f_count = (await db.execute(f_count_stmt)).scalar() or 0

    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        is_active=target_user.is_active,
        is_superuser=target_user.is_superuser,
        created_at=target_user.created_at.isoformat(),
        fields_count=f_count,
    )


@router.get("/fields", summary="List All Registered Agricultural Fields Platform-Wide")
async def list_all_fields_admin(
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves all agricultural plots registered across all operators with ownership mapping."""
    stmt = select(FieldModel).order_by(FieldModel.created_at.desc())
    fields = (await db.execute(stmt)).scalars().all()

    results: List[Dict[str, Any]] = []
    for f in fields:
        owner_stmt = select(User.email, User.full_name).where(User.id == f.user_id)
        owner = (await db.execute(owner_stmt)).first()

        # Latest observation
        obs_stmt = (
            select(SensorObservationModel.soil_moisture_m3m3, SensorObservationModel.observation_timestamp_utc)
            .where(SensorObservationModel.field_id == f.id)
            .order_by(SensorObservationModel.observation_timestamp_utc.desc())
            .limit(1)
        )
        latest_obs = (await db.execute(obs_stmt)).first()

        results.append(
            {
                "id": f.id,
                "name": f.name,
                "owner_email": owner.email if owner else "Unknown",
                "owner_name": owner.full_name if owner else "Unknown",
                "crop_name": f.crop_name,
                "growth_stage": f.growth_stage,
                "area_value": f.area_value,
                "area_unit": f.area_unit,
                "area_m2": f.area_m2,
                "irrigation_method": f.irrigation_method,
                "latitude": f.latitude,
                "longitude": f.longitude,
                "field_capacity_theta": f.field_capacity_theta,
                "wilting_point_theta": f.wilting_point_theta,
                "latest_moisture": latest_obs[0] if latest_obs else None,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
        )
    return results


@router.get("/events", summary="List All Post-Irrigation Executed Events Platform-Wide")
async def list_all_events_admin(
    admin_user: Annotated[User, Depends(get_current_superuser)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=500),
):
    """Retrieves chronological execution audit events across all fields."""
    stmt = (
        select(IrrigationEventModel)
        .order_by(IrrigationEventModel.event_timestamp_utc.desc())
        .limit(limit)
    )
    events = (await db.execute(stmt)).scalars().all()

    results = []
    for ev in events:
        field_stmt = select(FieldModel.name, FieldModel.crop_name).where(FieldModel.id == ev.field_id)
        f_info = (await db.execute(field_stmt)).first()
        results.append(
            {
                "id": ev.id,
                "field_id": ev.field_id,
                "field_name": f_info.name if f_info else "Unknown",
                "crop_name": f_info.crop_name if f_info else "Unknown",
                "event_timestamp_utc": ev.event_timestamp_utc.isoformat() if hasattr(ev.event_timestamp_utc, "isoformat") else str(ev.event_timestamp_utc),
                "actual_volume_m3": ev.actual_volume_m3,
                "actual_depth_mm": ev.actual_depth_mm,
                "irrigation_method": ev.irrigation_method,
                "pre_irrigation_sm": ev.pre_irrigation_sm,
                "post_irrigation_sm": ev.post_irrigation_sm,
                "execution_status": ev.execution_status,
                "operator_notes": ev.operator_notes,
            }
        )
    return results

