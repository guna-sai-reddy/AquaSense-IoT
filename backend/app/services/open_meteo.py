"""AquaSense-IoT Open-Meteo Ingestion Service.

Fetches, validates, and normalizes historical reanalysis (ERA5) and synoptic forecast
meteorological and soil-moisture datasets without synthetic data generation.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import pandas as pd
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

# Default Research Field Coordinates (near Kurnool, Andhra Pradesh, India)
DEFAULT_LATITUDE = 15.8281
DEFAULT_LONGITUDE = 78.0373

# Base URLs (Can be overridden via environment or class constructor)
DEFAULT_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
DEFAULT_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Standard Historical Hourly Variables (ERA5 / ECMWF Land)
DEFAULT_HISTORICAL_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "rain",
    "surface_pressure",
    "et0_fao_evapotranspiration",
    "shortwave_radiation_instant",
    "wind_speed_10m",
    "soil_temperature_0_to_7cm",
    "soil_temperature_7_to_28cm",
    "soil_moisture_0_to_7cm",
    "soil_moisture_7_to_28cm",
    "soil_moisture_28_to_100cm",
    "soil_moisture_100_to_255cm",
]

# Standard Forecast Hourly Variables (NWP ECMWF IFS / GFS)
DEFAULT_FORECAST_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "et0_fao_evapotranspiration",
    "surface_pressure",
    "wind_speed_10m",
    "soil_moisture_0_to_1cm",
    "soil_moisture_1_to_3cm",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
    "soil_moisture_27_to_81cm",
]


class OpenMeteoError(Exception):
    """Base exception for Open-Meteo operations."""
    pass


class OpenMeteoAPIError(OpenMeteoError):
    """Raised when the Open-Meteo API returns an HTTP error status."""
    def __init__(self, status_code: int, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(f"Open-Meteo API error {status_code}: {message}")
        self.status_code = status_code
        self.details = details or {}


class OpenMeteoRateLimitError(OpenMeteoAPIError):
    """Raised when API rate limits (HTTP 429) are encountered."""
    pass


class OpenMeteoValidationError(OpenMeteoError):
    """Raised when API payload fails structural or numerical validation."""
    pass


class IngestionMetadata(BaseModel):
    """Metadata tracking data provenance and retrieval parameters."""
    source_type: str = "WEATHER_MODEL_DERIVED"
    provider: str
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    retrieval_timestamp_utc: str
    record_count: int
    variables_retrieved: List[str]
    units: Dict[str, str]
    missing_value_counts: Dict[str, int]


class OpenMeteoClient:
    """Robust client for Open-Meteo Historical Weather and Forecast APIs."""

    def __init__(
        self,
        historical_base_url: str = DEFAULT_HISTORICAL_URL,
        forecast_base_url: str = DEFAULT_FORECAST_URL,
        timeout_seconds: float = 20.0,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
        http_client: Optional[httpx.Client] = None,
    ):
        self.historical_base_url = historical_base_url
        self.forecast_base_url = forecast_base_url
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._http_client = http_client

    def _get_client(self) -> httpx.Client:
        if self._http_client is not None:
            return self._http_client
        return httpx.Client(
            timeout=httpx.Timeout(self.timeout_seconds),
            headers={"User-Agent": "AquaSense-IoT/1.0 (Research precision irrigation framework)"},
        )

    def _execute_request_with_retry(
        self,
        url: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Executes GET request with bounded retries and exponential backoff."""
        client = self._get_client()
        attempt = 0
        last_exception = None

        while attempt <= self.max_retries:
            try:
                logger.debug(f"Requesting Open-Meteo [attempt {attempt + 1}/{self.max_retries + 1}]: {url} params={params}")
                response = client.get(url, params=params)

                # Rate limiting
                if response.status_code == 429:
                    error_text = response.text
                    retry_after = response.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after else (self.backoff_factor ** attempt) + 1.0
                    logger.warning(f"Rate limited by Open-Meteo (429). Backing off for {sleep_time:.2f}s: {error_text}")
                    if attempt < self.max_retries:
                        time.sleep(sleep_time)
                        attempt += 1
                        continue
                    raise OpenMeteoRateLimitError(
                        status_code=429,
                        message=f"Rate limit exceeded after {self.max_retries} retries: {error_text}",
                    )

                # HTTP error status check
                if response.status_code >= 400:
                    try:
                        err_json = response.json()
                        err_reason = err_json.get("reason", response.text)
                    except Exception:
                        err_reason = response.text
                    raise OpenMeteoAPIError(
                        status_code=response.status_code,
                        message=err_reason,
                    )

                # Successful parse
                try:
                    payload = response.json()
                except Exception as e:
                    raise OpenMeteoValidationError(f"Invalid JSON returned from Open-Meteo: {e}") from e

                return payload

            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_exception = e
                logger.warning(f"Network error on Open-Meteo request attempt {attempt + 1}: {e}")
                if attempt < self.max_retries:
                    sleep_time = (self.backoff_factor ** attempt)
                    time.sleep(sleep_time)
                    attempt += 1
                    continue
                break

        raise OpenMeteoError(
            f"Failed to fetch data from {url} after {self.max_retries + 1} attempts. Last error: {last_exception}"
        )

    def validate_response(
        self,
        payload: Dict[str, Any],
        expected_variables: List[str],
    ) -> Tuple[int, Dict[str, str], Dict[str, int]]:
        """Strictly validates response structure, timestamps, array lengths, and missing values."""
        if not isinstance(payload, dict):
            raise OpenMeteoValidationError("Payload is not a valid JSON dictionary.")

        if "hourly" not in payload or not isinstance(payload["hourly"], dict):
            raise OpenMeteoValidationError("Missing required 'hourly' field in response.")

        hourly = payload["hourly"]
        if "time" not in hourly or not isinstance(hourly["time"], list):
            raise OpenMeteoValidationError("Missing required 'time' array in 'hourly' data.")

        record_count = len(hourly["time"])
        if record_count == 0:
            raise OpenMeteoValidationError("Received 0 hourly observation records.")

        units = payload.get("hourly_units", {})
        missing_counts: Dict[str, int] = {}

        # Validate that each expected variable exists and matches timestamp array length
        for var in expected_variables:
            if var not in hourly:
                raise OpenMeteoValidationError(
                    f"Requested variable '{var}' is missing from Open-Meteo response."
                )
            arr = hourly[var]
            if not isinstance(arr, list):
                raise OpenMeteoValidationError(f"Variable '{var}' is not an array.")
            if len(arr) != record_count:
                raise OpenMeteoValidationError(
                    f"Mismatched array length for '{var}': {len(arr)} vs {record_count} times."
                )
            # Count actual missing (None or NaN)
            missing_counts[var] = sum(1 for val in arr if val is None)

        return record_count, units, missing_counts

    def fetch_historical(
        self,
        latitude: float = DEFAULT_LATITUDE,
        longitude: float = DEFAULT_LONGITUDE,
        start_date: str = "2024-01-01",
        end_date: str = "2024-01-15",
        variables: Optional[List[str]] = None,
        timezone_str: str = "UTC",
    ) -> Dict[str, Any]:
        """Fetches historical reanalysis weather and root-zone soil moisture data."""
        vars_to_fetch = variables or DEFAULT_HISTORICAL_VARIABLES

        # Validate date format YYYY-MM-DD
        try:
            d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError as e:
            raise ValueError(f"Dates must be in 'YYYY-MM-DD' format. Error: {e}")

        if d_start > d_end:
            raise ValueError(f"start_date ({start_date}) cannot be after end_date ({end_date}).")

        params = {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "start_date": start_date,
            "end_date": end_date,
            "hourly": ",".join(vars_to_fetch),
            "timezone": timezone_str,
        }

        payload = self._execute_request_with_retry(self.historical_base_url, params)
        self.validate_response(payload, vars_to_fetch)
        return payload

    def fetch_forecast(
        self,
        latitude: float = DEFAULT_LATITUDE,
        longitude: float = DEFAULT_LONGITUDE,
        forecast_days: int = 7,
        variables: Optional[List[str]] = None,
        timezone_str: str = "UTC",
    ) -> Dict[str, Any]:
        """Fetches synoptic 1-16 day weather and rainfall forecasts."""
        vars_to_fetch = variables or DEFAULT_FORECAST_VARIABLES

        if forecast_days < 1 or forecast_days > 16:
            raise ValueError("forecast_days must be between 1 and 16.")

        params = {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "hourly": ",".join(vars_to_fetch),
            "forecast_days": forecast_days,
            "timezone": timezone_str,
        }

        payload = self._execute_request_with_retry(self.forecast_base_url, params)
        self.validate_response(payload, vars_to_fetch)
        return payload


def normalize_historical_dataset(
    payload: Dict[str, Any],
    provider_name: str = "Open-Meteo ERA5 Reanalysis",
) -> Tuple[pd.DataFrame, IngestionMetadata]:
    """Transforms raw Open-Meteo historical payload into a standardized pandas DataFrame."""
    hourly = payload["hourly"]
    units = payload.get("hourly_units", {})
    latitude = float(payload.get("latitude", DEFAULT_LATITUDE))
    longitude = float(payload.get("longitude", DEFAULT_LONGITUDE))
    elevation = payload.get("elevation")

    retrieval_utc = datetime.now(timezone.utc).isoformat()

    # Normalize timestamps to explicit ISO UTC format
    raw_times = hourly["time"]
    normalized_times = [
        t if (t.endswith("Z") or "+00:00" in t) else f"{t}Z"
        for t in raw_times
    ]

    df_data = {
        "timestamp_utc": normalized_times,
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": elevation,
        "source_type": "WEATHER_MODEL_DERIVED",
        "provider": provider_name,
        "retrieval_timestamp_utc": retrieval_utc,
    }

    # Add meteorological and soil moisture variables
    variables_present = []
    missing_counts = {}

    for key, values in hourly.items():
        if key == "time":
            continue
        variables_present.append(key)
        df_data[key] = values
        missing_counts[key] = sum(1 for v in values if v is None)

    df = pd.DataFrame(df_data)

    metadata = IngestionMetadata(
        source_type="WEATHER_MODEL_DERIVED",
        provider=provider_name,
        latitude=latitude,
        longitude=longitude,
        elevation_m=elevation,
        retrieval_timestamp_utc=retrieval_utc,
        record_count=len(df),
        variables_retrieved=variables_present,
        units=units,
        missing_value_counts=missing_counts,
    )

    return df, metadata


def normalize_forecast_dataset(
    payload: Dict[str, Any],
    provider_name: str = "Open-Meteo NWP Forecast",
) -> Tuple[pd.DataFrame, IngestionMetadata]:
    """Transforms raw Open-Meteo forecast payload into a separate forecast DataFrame.

    Forecasts are strictly isolated from historical observations.
    """
    hourly = payload["hourly"]
    units = payload.get("hourly_units", {})
    latitude = float(payload.get("latitude", DEFAULT_LATITUDE))
    longitude = float(payload.get("longitude", DEFAULT_LONGITUDE))
    elevation = payload.get("elevation")

    retrieval_utc = datetime.now(timezone.utc).isoformat()
    raw_times = hourly["time"]

    # Calculate forecast horizon hours relative to retrieval
    normalized_times = [
        t if (t.endswith("Z") or "+00:00" in t) else f"{t}Z"
        for t in raw_times
    ]

    df_data = {
        "valid_time_utc": normalized_times,
        "forecast_retrieval_timestamp_utc": retrieval_utc,
        "forecast_horizon_hours": list(range(len(normalized_times))),
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": elevation,
        "source_type": "WEATHER_MODEL_DERIVED",
        "provider": provider_name,
    }

    variables_present = []
    missing_counts = {}

    for key, values in hourly.items():
        if key == "time":
            continue
        variables_present.append(key)
        df_data[key] = values
        missing_counts[key] = sum(1 for v in values if v is None)

    df = pd.DataFrame(df_data)

    metadata = IngestionMetadata(
        source_type="WEATHER_MODEL_DERIVED",
        provider=provider_name,
        latitude=latitude,
        longitude=longitude,
        elevation_m=elevation,
        retrieval_timestamp_utc=retrieval_utc,
        record_count=len(df),
        variables_retrieved=variables_present,
        units=units,
        missing_value_counts=missing_counts,
    )

    return df, metadata


def save_ingested_dataset(
    raw_payload: Dict[str, Any],
    df_normalized: pd.DataFrame,
    metadata: IngestionMetadata,
    raw_output_dir: str | Path,
    processed_output_dir: str | Path,
    file_prefix: str = "open_meteo_historical",
    deduplicate_on: str = "timestamp_utc",
) -> Tuple[Path, Path, Path]:
    """Persists raw JSON, normalized CSV (with safe deduplication), and provenance metadata JSON."""
    raw_path = Path(raw_output_dir)
    proc_path = Path(processed_output_dir)
    raw_path.mkdir(parents=True, exist_ok=True)
    proc_path.mkdir(parents=True, exist_ok=True)

    date_tag = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    raw_file = raw_path / f"{file_prefix}_{date_tag}.json"
    meta_file = proc_path / f"{file_prefix}_metadata_{date_tag}.json"
    csv_file = proc_path / f"{file_prefix}_dataset.csv"

    # 1. Save raw payload
    with open(raw_file, "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)

    # 2. Save metadata JSON
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata.model_dump(), f, indent=2)

    # 3. Save / Deduplicate normalized CSV
    if csv_file.exists():
        existing_df = pd.read_csv(csv_file)
        # Combine existing and new records
        combined = pd.concat([existing_df, df_normalized], ignore_index=True)
        # Deduplicate based on timestamp and coordinates (keeping latest retrieval)
        subset_cols = [c for c in [deduplicate_on, "latitude", "longitude"] if c in combined.columns]
        combined = combined.drop_duplicates(subset=subset_cols, keep="last")
        combined.sort_values(by=deduplicate_on, inplace=True)
        combined.to_csv(csv_file, index=False)
    else:
        df_normalized.sort_values(by=deduplicate_on, inplace=True)
        df_normalized.to_csv(csv_file, index=False)

    return raw_file, csv_file, meta_file
