"""Tests for Ground Sensor Telemetry Ingestion, Validation, and Storage."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.main import app
from app.schemas.sensor import GroundSensorReadingCreate
from app.services.ground_sensors import (
    GroundSensorService,
    UnauthorizedDeviceError,
    DuplicateReadingError,
)


@pytest.fixture
def temp_sensor_service(tmp_path):
    """Provides a fresh isolated sensor service for tests."""
    raw_dir = tmp_path / "raw_sensors"
    proc_dir = tmp_path / "proc_sensors"
    return GroundSensorService(
        raw_storage_dir=raw_dir,
        processed_storage_dir=proc_dir,
        authorized_devices={"KURNOOL_NODE_01", "TEST_NODE_01"},
    )


def test_sensor_payload_unit_normalization_percent():
    """Verify soil moisture in percentage (e.g. 24.5%) is normalized to 0.245 m3/m3."""
    reading = GroundSensorReadingCreate(
        device_id="KURNOOL_NODE_01",
        field_id="FIELD_ALPHA",
        observation_timestamp_utc="2024-01-01T10:00:00Z",
        soil_moisture=24.5,
        soil_moisture_unit="percent",
        soil_temperature=22.0,
        relative_humidity=60.0,
    )
    assert reading.soil_moisture == 0.245


def test_sensor_payload_temperature_fahrenheit_normalization():
    """Verify soil temperature in Fahrenheit is converted to Celsius."""
    reading = GroundSensorReadingCreate(
        device_id="KURNOOL_NODE_01",
        field_id="FIELD_ALPHA",
        observation_timestamp_utc="2024-01-01T10:00:00Z",
        soil_moisture=0.22,
        soil_temperature=68.0,
        soil_temperature_unit="fahrenheit",
        relative_humidity=55.0,
    )
    assert reading.soil_temperature == 20.0


def test_physical_bounds_validation():
    """Unrealistic sensor values must be strictly rejected by validation."""
    # Negative moisture
    with pytest.raises(ValidationError):
        GroundSensorReadingCreate(
            device_id="KURNOOL_NODE_01",
            field_id="FIELD_ALPHA",
            observation_timestamp_utc="2024-01-01T10:00:00Z",
            soil_moisture=-0.05,
            soil_temperature=20.0,
            relative_humidity=50.0,
        )

    # Moisture > 1.0 m3/m3
    with pytest.raises(ValidationError):
        GroundSensorReadingCreate(
            device_id="KURNOOL_NODE_01",
            field_id="FIELD_ALPHA",
            observation_timestamp_utc="2024-01-01T10:00:00Z",
            soil_moisture=1.45,
            soil_temperature=20.0,
            relative_humidity=50.0,
        )

    # Humidity > 100%
    with pytest.raises(ValidationError):
        GroundSensorReadingCreate(
            device_id="KURNOOL_NODE_01",
            field_id="FIELD_ALPHA",
            observation_timestamp_utc="2024-01-01T10:00:00Z",
            soil_moisture=0.20,
            soil_temperature=20.0,
            relative_humidity=105.0,
        )


def test_unauthorized_device_rejection(temp_sensor_service):
    """Telemetry from unauthenticated devices must be rejected."""
    unauthorized_reading = GroundSensorReadingCreate(
        device_id="ROGUE_DEVICE_999",
        field_id="FIELD_ALPHA",
        observation_timestamp_utc="2024-01-01T10:00:00Z",
        soil_moisture=0.22,
        soil_temperature=21.0,
        relative_humidity=50.0,
    )
    with pytest.raises(UnauthorizedDeviceError, match="not an authorized sensor node"):
        temp_sensor_service.ingest_reading(unauthorized_reading)


def test_duplicate_reading_rejection(temp_sensor_service):
    """Same device and observation timestamp must be rejected to prevent duplicate rows."""
    reading = GroundSensorReadingCreate(
        device_id="KURNOOL_NODE_01",
        field_id="FIELD_ALPHA",
        observation_timestamp_utc="2024-01-01T10:00:00Z",
        soil_moisture=0.22,
        soil_temperature=21.0,
        relative_humidity=50.0,
    )
    # First ingest succeeds
    resp = temp_sensor_service.ingest_reading(reading)
    assert resp.status == "ACCEPTED"

    # Second ingest of exact same reading must raise DuplicateReadingError
    with pytest.raises(DuplicateReadingError, match="has already been ingested"):
        temp_sensor_service.ingest_reading(reading)


def test_test_fixture_isolation_as_simulated(temp_sensor_service):
    """Test fixtures must be tagged SIMULATED and never saved in real measured files."""
    test_fixture = GroundSensorReadingCreate(
        device_id="KURNOOL_NODE_01",
        field_id="FIELD_ALPHA",
        observation_timestamp_utc="2024-01-01T12:00:00Z",
        soil_moisture=0.24,
        soil_temperature=22.5,
        relative_humidity=52.0,
        is_test_fixture=True,
    )
    resp = temp_sensor_service.ingest_reading(test_fixture)
    assert resp.source_type == "SIMULATED"

    # Check that measured CSV does not contain this reading
    assert not temp_sensor_service.measured_csv.exists()
    assert temp_sensor_service.simulated_csv.exists()


@pytest.mark.asyncio
async def test_fastapi_telemetry_endpoint_integration():
    """Verify HTTP API endpoint POST /api/v1/telemetry/ingest."""
    payload = {
        "device_id": "KURNOOL_NODE_01",
        "field_id": "FIELD_ALPHA",
        "observation_timestamp_utc": "2024-01-01T15:00:00Z",
        "soil_moisture": 0.23,
        "soil_moisture_unit": "m3/m3",
        "soil_temperature": 24.0,
        "soil_temperature_unit": "celsius",
        "relative_humidity": 45.0,
        "relative_humidity_unit": "percent",
        "depth_cm": 20.0,
        "is_test_fixture": True,  # Isolated as test fixture
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/v1/telemetry/ingest", json=payload)

    # 201 Created or 409 Conflict if already run
    assert response.status_code in [201, 409]
    if response.status_code == 201:
        data = response.json()
        assert data["device_id"] == "KURNOOL_NODE_01"
        assert data["source_type"] == "SIMULATED"
