"""Unit and Integration Tests for Open-Meteo Ingestion Service.

All tests utilize mocked HTTP responses to test failure modes, edge cases,
schema validation, timestamp alignment, and deduplication.
Mocked test data is isolated in temporary fixtures and never stored in production data stores.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pandas as pd
import pytest

from app.services.open_meteo import (
    OpenMeteoClient,
    OpenMeteoAPIError,
    OpenMeteoRateLimitError,
    OpenMeteoValidationError,
    normalize_historical_dataset,
    normalize_forecast_dataset,
    save_ingested_dataset,
)


@pytest.fixture
def mock_valid_historical_payload():
    """A realistic 3-hour sample historical payload."""
    return {
        "latitude": 15.8281,
        "longitude": 78.0373,
        "generationtime_ms": 0.5,
        "utc_offset_seconds": 0,
        "timezone": "UTC",
        "timezone_abbreviation": "UTC",
        "elevation": 280.0,
        "hourly_units": {
            "time": "iso8601",
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "precipitation": "mm",
            "et0_fao_evapotranspiration": "mm",
            "soil_moisture_0_to_7cm": "m³/m³",
            "soil_temperature_0_to_7cm": "°C",
        },
        "hourly": {
            "time": [
                "2024-01-01T00:00",
                "2024-01-01T01:00",
                "2024-01-01T02:00",
            ],
            "temperature_2m": [22.4, 21.8, 21.2],
            "relative_humidity_2m": [65.0, 68.0, 70.0],
            "precipitation": [0.0, 0.0, 0.5],
            "et0_fao_evapotranspiration": [0.05, 0.04, 0.04],
            "soil_moisture_0_to_7cm": [0.18, 0.18, 0.19],
            "soil_temperature_0_to_7cm": [20.1, 19.8, 19.5],
        },
    }


@pytest.fixture
def mock_valid_forecast_payload():
    """A realistic 3-hour sample forecast payload."""
    return {
        "latitude": 15.8281,
        "longitude": 78.0373,
        "elevation": 280.0,
        "hourly_units": {
            "time": "iso8601",
            "temperature_2m": "°C",
            "precipitation_probability": "%",
            "precipitation": "mm",
            "soil_moisture_0_to_1cm": "m³/m³",
        },
        "hourly": {
            "time": [
                "2024-06-01T00:00",
                "2024-06-01T01:00",
                "2024-06-01T02:00",
            ],
            "temperature_2m": [28.5, 27.9, 27.2],
            "precipitation_probability": [10, 25, 60],
            "precipitation": [0.0, 0.1, 1.2],
            "soil_moisture_0_to_1cm": [0.12, 0.12, 0.15],
        },
    }


def test_fetch_historical_success_mocked(mock_valid_historical_payload):
    """Verify that a valid HTTP 200 response passes schema checks and returns data."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = mock_valid_historical_payload

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.return_value = mock_response

    client = OpenMeteoClient(http_client=mock_client)
    payload = client.fetch_historical(
        latitude=15.8281,
        longitude=78.0373,
        start_date="2024-01-01",
        end_date="2024-01-01",
        variables=[
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "et0_fao_evapotranspiration",
            "soil_moisture_0_to_7cm",
            "soil_temperature_0_to_7cm",
        ],
    )

    assert payload["latitude"] == 15.8281
    assert len(payload["hourly"]["time"]) == 3


def test_fetch_forecast_success_mocked(mock_valid_forecast_payload):
    """Verify forecast fetching with mocked HTTP response."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = mock_valid_forecast_payload

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.return_value = mock_response

    client = OpenMeteoClient(http_client=mock_client)
    payload = client.fetch_forecast(
        latitude=15.8281,
        longitude=78.0373,
        forecast_days=3,
        variables=[
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "soil_moisture_0_to_1cm",
        ],
    )
    assert len(payload["hourly"]["time"]) == 3
    assert "precipitation_probability" in payload["hourly"]


def test_validation_missing_variable(mock_valid_historical_payload):
    """Validation must raise OpenMeteoValidationError if a requested variable is missing."""
    client = OpenMeteoClient()
    # Requesting variable not present in payload
    with pytest.raises(OpenMeteoValidationError, match="missing from Open-Meteo response"):
        client.validate_response(
            mock_valid_historical_payload,
            expected_variables=["non_existent_soil_var"],
        )


def test_validation_mismatched_array_lengths(mock_valid_historical_payload):
    """Validation must fail if array lengths diverge from time dimension."""
    client = OpenMeteoClient()
    bad_payload = dict(mock_valid_historical_payload)
    bad_payload["hourly"] = dict(mock_valid_historical_payload["hourly"])
    # Truncate one array
    bad_payload["hourly"]["temperature_2m"] = [22.4]

    with pytest.raises(OpenMeteoValidationError, match="Mismatched array length"):
        client.validate_response(
            bad_payload,
            expected_variables=["temperature_2m", "precipitation"],
        )


def test_validation_empty_or_malformed_payload():
    """Validation must reject empty or missing hourly sections."""
    client = OpenMeteoClient()
    with pytest.raises(OpenMeteoValidationError, match="Missing required 'hourly' field"):
        client.validate_response({}, expected_variables=["temperature_2m"])


def test_api_failure_500_mocked():
    """Verify HTTP 500 error raises OpenMeteoAPIError with status code."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_response.json.side_effect = Exception("No JSON")

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.return_value = mock_response

    client = OpenMeteoClient(http_client=mock_client, max_retries=0)
    with pytest.raises(OpenMeteoAPIError) as exc_info:
        client.fetch_historical(
            start_date="2024-01-01",
            end_date="2024-01-02",
            variables=["temperature_2m"],
        )
    assert exc_info.value.status_code == 500


def test_rate_limit_429_mocked():
    """Verify HTTP 429 triggers retry and raises OpenMeteoRateLimitError when exhausted."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 429
    mock_response.text = "Daily API request limit exceeded"
    mock_response.headers = {"Retry-After": "0.01"}

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.return_value = mock_response

    client = OpenMeteoClient(http_client=mock_client, max_retries=1, backoff_factor=0.01)
    with pytest.raises(OpenMeteoRateLimitError) as exc_info:
        client.fetch_historical(
            start_date="2024-01-01",
            end_date="2024-01-02",
            variables=["temperature_2m"],
        )
    assert exc_info.value.status_code == 429


def test_network_timeout_mocked():
    """Verify network timeout raises OpenMeteoError after retry attempts."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.side_effect = httpx.TimeoutException("Connection timed out")

    client = OpenMeteoClient(http_client=mock_client, max_retries=1, backoff_factor=0.01)
    with pytest.raises(Exception, match="Failed to fetch data"):
        client.fetch_historical(
            start_date="2024-01-01",
            end_date="2024-01-02",
            variables=["temperature_2m"],
        )


def test_timestamp_normalization_and_metadata(mock_valid_historical_payload):
    """Verify timestamps are normalized to ISO UTC and metadata is preserved."""
    df, metadata = normalize_historical_dataset(mock_valid_historical_payload)

    # Check timestamps normalized with 'Z'
    assert all(t.endswith("Z") for t in df["timestamp_utc"])
    assert metadata.record_count == 3
    assert metadata.source_type == "WEATHER_MODEL_DERIVED"
    assert metadata.latitude == 15.8281
    assert "precipitation" in metadata.variables_retrieved


def test_missing_values_preserved_without_fabrication(mock_valid_historical_payload):
    """Missing observations (None) in API payload must be preserved as NaN without fake values."""
    payload = dict(mock_valid_historical_payload)
    payload["hourly"] = dict(mock_valid_historical_payload["hourly"])
    # Introduce an authentic missing observation in precipitation
    payload["hourly"]["precipitation"] = [0.0, None, 0.5]

    df, metadata = normalize_historical_dataset(payload)
    # Row 1 must be null/NaN
    assert pd.isna(df.loc[1, "precipitation"])
    assert metadata.missing_value_counts["precipitation"] == 1


def test_deduplication_safety_on_repeated_ingestion(tmp_path, mock_valid_historical_payload):
    """Saving overlapping records must safely deduplicate and not multiply rows."""
    raw_dir = tmp_path / "raw"
    proc_dir = tmp_path / "proc"

    df1, meta1 = normalize_historical_dataset(mock_valid_historical_payload)
    save_ingested_dataset(
        raw_payload=mock_valid_historical_payload,
        df_normalized=df1,
        metadata=meta1,
        raw_output_dir=raw_dir,
        processed_output_dir=proc_dir,
        file_prefix="test_historical",
    )

    csv_file = proc_dir / "test_historical_dataset.csv"
    assert csv_file.exists()
    initial_len = len(pd.read_csv(csv_file))
    assert initial_len == 3

    # Re-ingest the exact same 3 records (or an overlapping batch)
    save_ingested_dataset(
        raw_payload=mock_valid_historical_payload,
        df_normalized=df1,
        metadata=meta1,
        raw_output_dir=raw_dir,
        processed_output_dir=proc_dir,
        file_prefix="test_historical",
    )

    deduped_df = pd.read_csv(csv_file)
    assert len(deduped_df) == 3, "Duplicate records were incorrectly added to the dataset!"


def test_forecast_isolation_from_historical(mock_valid_forecast_payload):
    """Forecast dataset must store valid_time_utc and horizon hours separately from ground truth."""
    df, meta = normalize_forecast_dataset(mock_valid_forecast_payload)
    assert "valid_time_utc" in df.columns
    assert "forecast_horizon_hours" in df.columns
    assert "timestamp_utc" not in df.columns  # Must not use observation timestamp
    assert df.loc[0, "forecast_horizon_hours"] == 0
    assert df.loc[1, "forecast_horizon_hours"] == 1
