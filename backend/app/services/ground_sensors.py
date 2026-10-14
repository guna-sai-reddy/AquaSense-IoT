"""AquaSense-IoT Ground Sensor Telemetry Ingestion Service.

Handles real in-situ sensor data validation, unit normalization, physical bounds checking,
device authentication, duplicate filtering, and distinct storage isolation.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

from app.schemas.sensor import GroundSensorReadingCreate, GroundSensorReadingResponse

logger = logging.getLogger(__name__)

# Default authorized devices & fields
DEFAULT_AUTHORIZED_DEVICES: Set[str] = {
    "KURNOOL_NODE_01",
    "KURNOOL_NODE_02",
    "FIELD_BENCHMARK_PROBE_A",
    "FIELD_BENCHMARK_PROBE_B",
}


class SensorIngestionError(Exception):
    """Base exception for sensor telemetry issues."""
    pass


class UnauthorizedDeviceError(SensorIngestionError):
    """Raised when an unauthenticated hardware device sends telemetry."""
    pass


class DuplicateReadingError(SensorIngestionError):
    """Raised when a reading for the same device and timestamp was already processed."""
    pass


class GroundSensorService:
    """Service managing physical and simulated sensor ingest pipelines."""

    def __init__(
        self,
        raw_storage_dir: Path | str = "ml_engine/data/raw/ground_sensors",
        processed_storage_dir: Path | str = "ml_engine/data/processed",
        authorized_devices: Optional[Set[str]] = None,
    ):
        self.raw_dir = Path(raw_storage_dir)
        self.processed_dir = Path(processed_storage_dir)
        self.authorized_devices = authorized_devices if authorized_devices is not None else DEFAULT_AUTHORIZED_DEVICES
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

        self.measured_csv = self.processed_dir / "ground_sensors_measured.csv"
        self.simulated_csv = self.processed_dir / "ground_sensors_test_fixtures.csv"

        # In-memory tracking of seen (device_id, observation_timestamp_utc)
        self._seen_signatures: Set[Tuple[str, str]] = set()
        self._load_seen_signatures()

    def _load_seen_signatures(self) -> None:
        """Loads historical signatures from disk to prevent duplicate ingestion across restarts."""
        for csv_path in [self.measured_csv, self.simulated_csv]:
            if csv_path.exists():
                try:
                    df = pd.read_csv(csv_path)
                    if "device_id" in df.columns and "observation_timestamp_utc" in df.columns:
                        for _, row in df.iterrows():
                            self._seen_signatures.add((str(row["device_id"]), str(row["observation_timestamp_utc"])))
                except Exception as e:
                    logger.warning(f"Error loading existing sensor signatures from {csv_path}: {e}")

    def ingest_reading(
        self,
        reading: GroundSensorReadingCreate,
        client_auth_token: Optional[str] = None,
    ) -> GroundSensorReadingResponse:
        """Validates, deduplicates, and saves incoming ground sensor reading."""
        # 1. Device Authorization
        if reading.device_id not in self.authorized_devices:
            logger.warning(f"Rejected telemetry from unauthorized device ID: {reading.device_id}")
            raise UnauthorizedDeviceError(
                f"Device '{reading.device_id}' is not an authorized sensor node in this field."
            )

        # 2. Duplicate Detection
        sig = (reading.device_id, reading.observation_timestamp_utc)
        if sig in self._seen_signatures:
            logger.info(f"Duplicate reading detected for device {reading.device_id} at {reading.observation_timestamp_utc}. Dropping duplicate.")
            raise DuplicateReadingError(
                f"Reading from device '{reading.device_id}' at timestamp '{reading.observation_timestamp_utc}' has already been ingested."
            )

        ingestion_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        reading_id = str(uuid.uuid4())

        # Determine Provenance: Real MEASURED vs SIMULATED Test Fixture
        provenance = "SIMULATED" if reading.is_test_fixture else "MEASURED"

        # 3. Persist Raw JSON (Daily audit partition)
        date_folder = reading.observation_timestamp_utc[:10]
        raw_partition_dir = self.raw_dir / date_folder
        raw_partition_dir.mkdir(parents=True, exist_ok=True)
        raw_file = raw_partition_dir / f"{reading.device_id}_{reading_id[:8]}.json"

        raw_payload = reading.model_dump()
        raw_payload["id"] = reading_id
        raw_payload["ingestion_timestamp_utc"] = ingestion_time_utc
        raw_payload["source_type"] = provenance

        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(raw_payload, f, indent=2)

        # 4. Append to Processed Dataset
        target_csv = self.simulated_csv if reading.is_test_fixture else self.measured_csv
        record_df = pd.DataFrame([
            {
                "id": reading_id,
                "device_id": reading.device_id,
                "field_id": reading.field_id,
                "observation_timestamp_utc": reading.observation_timestamp_utc,
                "ingestion_timestamp_utc": ingestion_time_utc,
                "soil_moisture_m3m3": reading.soil_moisture,
                "soil_temperature_c": reading.soil_temperature,
                "relative_humidity_pct": reading.relative_humidity,
                "depth_cm": reading.depth_cm,
                "battery_level_pct": reading.battery_level_pct,
                "signal_rssi_dbm": reading.signal_rssi_dbm,
                "source_type": provenance,
            }
        ])

        if target_csv.exists():
            existing = pd.read_csv(target_csv)
            combined = pd.concat([existing, record_df], ignore_index=True)
            combined.sort_values(by="observation_timestamp_utc", inplace=True)
            combined.drop_duplicates(subset=["device_id", "observation_timestamp_utc"], keep="last", inplace=True)
            combined.to_csv(target_csv, index=False)
        else:
            record_df.to_csv(target_csv, index=False)

        # Mark seen
        self._seen_signatures.add(sig)

        return GroundSensorReadingResponse(
            id=reading_id,
            device_id=reading.device_id,
            field_id=reading.field_id,
            observation_timestamp_utc=reading.observation_timestamp_utc,
            ingestion_timestamp_utc=ingestion_time_utc,
            soil_moisture_m3m3=reading.soil_moisture,
            soil_temperature_c=reading.soil_temperature,
            relative_humidity_pct=reading.relative_humidity,
            depth_cm=reading.depth_cm,
            source_type=provenance,
            battery_level_pct=reading.battery_level_pct,
            signal_rssi_dbm=reading.signal_rssi_dbm,
            status="ACCEPTED",
        )

    def get_history(
        self,
        field_id: Optional[str] = None,
        device_id: Optional[str] = None,
        include_simulated: bool = False,
    ) -> List[Dict]:
        """Returns chronological telemetry history."""
        target_csv = self.simulated_csv if include_simulated else self.measured_csv
        if not target_csv.exists():
            return []
        df = pd.read_csv(target_csv)
        if field_id:
            df = df[df["field_id"] == field_id]
        if device_id:
            df = df[df["device_id"] == device_id]
        return df.to_dict(orient="records")
