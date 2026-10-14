"""FastAPI REST Endpoints for In-situ Ground Sensor Telemetry."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.sensor import GroundSensorReadingCreate, GroundSensorReadingResponse
from app.services.ground_sensors import (
    GroundSensorService,
    UnauthorizedDeviceError,
    DuplicateReadingError,
)

router = APIRouter(prefix="/telemetry", tags=["Ground Telemetry"])

# Global singleton service for this phase
_sensor_service = GroundSensorService()


def get_sensor_service() -> GroundSensorService:
    return _sensor_service


@router.post(
    "/ingest",
    response_model=GroundSensorReadingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest In-situ Ground Sensor Telemetry",
    description="Endpoint for physical IoT gateways or probes sending calibrated soil moisture, temperature, and humidity readings.",
)
async def ingest_sensor_telemetry(
    reading: GroundSensorReadingCreate,
    service: GroundSensorService = Depends(get_sensor_service),
):
    try:
        response = service.ingest_reading(reading)
        return response
    except UnauthorizedDeviceError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DuplicateReadingError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/history",
    response_model=List[GroundSensorReadingResponse],
    summary="Get Telemetry History",
    description="Query chronological sensor telemetry by field or device ID.",
)
async def get_telemetry_history(
    field_id: Optional[str] = Query(None, description="Filter by field ID"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    include_simulated: bool = Query(False, description="Include test fixtures"),
    service: GroundSensorService = Depends(get_sensor_service),
):
    history = service.get_history(field_id=field_id, device_id=device_id, include_simulated=include_simulated)
    return history
