"""FastAPI Agricultural Field Management Endpoints."""

from __future__ import annotations

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.field import FieldModel
from app.models.user import User
from app.schemas.field import FieldCreateRequest, FieldResponse, FieldUpdateRequest

router = APIRouter(prefix="/fields", tags=["Field Management"])


@router.post(
    "",
    response_model=FieldResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Agricultural Field",
)
async def create_field(
    field_in: FieldCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Creates a new field record with crop and soil configurations owned by current user."""
    # Compute normalized square meters
    area_m2 = field_in.area_value * 10_000.0 if field_in.area_unit == "hectares" else field_in.area_value

    field = FieldModel(
        user_id=current_user.id,
        name=field_in.name,
        latitude=field_in.latitude,
        longitude=field_in.longitude,
        area_value=field_in.area_value,
        area_unit=field_in.area_unit,
        area_m2=area_m2,
        irrigation_method=field_in.irrigation_method,
        application_efficiency=field_in.application_efficiency,
        max_depth_per_event_mm=field_in.max_depth_per_event_mm,
        max_volume_m3=field_in.max_volume_m3,
        crop_name=field_in.crop.crop_name,
        growth_stage=field_in.crop.growth_stage,
        kc=field_in.crop.kc,
        root_depth_m=field_in.crop.root_depth_m,
        depletion_fraction_p=field_in.crop.depletion_fraction_p,
        soil_texture=field_in.soil.soil_texture,
        field_capacity_theta=field_in.soil.field_capacity_theta,
        wilting_point_theta=field_in.soil.wilting_point_theta,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.get(
    "",
    response_model=List[FieldResponse],
    summary="List User's Agricultural Fields",
)
async def list_fields(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns all fields. For administrators, returns all platform fields; for standard operators, returns user-owned fields."""
    if current_user.is_superuser:
        stmt = select(FieldModel).order_by(FieldModel.created_at.desc())
    else:
        stmt = select(FieldModel).where(FieldModel.user_id == current_user.id).order_by(FieldModel.created_at.desc())
    result = await db.execute(stmt)
    fields = result.scalars().all()
    return fields


@router.get(
    "/{field_id}",
    response_model=FieldResponse,
    summary="Get Field Details",
)
async def get_field(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieves a single field by ID. Enforces ownership authorization unless administrator."""
    if current_user.is_superuser:
        stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with ID '{field_id}' not found.",
        )
    return field


@router.patch(
    "/{field_id}",
    response_model=FieldResponse,
    summary="Update Field Configuration",
)
async def update_field(
    field_id: str,
    field_update: FieldUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Updates field parameters such as crop growth stage, Kc, or irrigation limits."""
    if current_user.is_superuser:
        stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with ID '{field_id}' not found.",
        )

    update_data = field_update.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(field, field_name, value)

    await db.commit()
    await db.refresh(field)
    return field


@router.delete(
    "/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Field",
)
async def delete_field(
    field_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Deletes an agricultural field and all associated telemetry/predictions."""
    if current_user.is_superuser:
        stmt = select(FieldModel).where(FieldModel.id == field_id)
    else:
        stmt = select(FieldModel).where(FieldModel.id == field_id, FieldModel.user_id == current_user.id)
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with ID '{field_id}' not found.",
        )

    await db.delete(field)
    await db.commit()
    return None
