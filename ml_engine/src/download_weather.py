"""CLI Script for Ingesting Open-Meteo Historical Weather and Synoptic Forecasts.

Saves verified raw JSON to `ml_engine/data/raw/weather/` and normalized CSV datasets
to `ml_engine/data/processed/` for precision irrigation research.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Add project root and backend to pythonpath to enable importing shared services
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.services.open_meteo import (
    DEFAULT_HISTORICAL_VARIABLES,
    DEFAULT_FORECAST_VARIABLES,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    OpenMeteoClient,
    normalize_historical_dataset,
    normalize_forecast_dataset,
    save_ingested_dataset,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("download_weather")


def run_ingestion(
    lat: float,
    lon: float,
    mode: str,
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-15",
    forecast_days: int = 7,
    raw_dir: Path | None = None,
    processed_dir: Path | None = None,
) -> dict:
    """Runs end-to-end ingestion and persistence for historical or forecast data."""
    raw_output_dir = raw_dir or (ROOT_DIR / "ml_engine" / "data" / "raw" / "weather")
    proc_output_dir = processed_dir or (ROOT_DIR / "ml_engine" / "data" / "processed")

    client = OpenMeteoClient()

    if mode == "historical":
        logger.info(f"Initiating HISTORICAL ingestion: Lat={lat}, Lon={lon}, Range={start_date} to {end_date}")
        payload = client.fetch_historical(
            latitude=lat,
            longitude=lon,
            start_date=start_date,
            end_date=end_date,
            variables=DEFAULT_HISTORICAL_VARIABLES,
        )
        df, metadata = normalize_historical_dataset(payload)
        raw_f, csv_f, meta_f = save_ingested_dataset(
            raw_payload=payload,
            df_normalized=df,
            metadata=metadata,
            raw_output_dir=raw_output_dir,
            processed_output_dir=proc_output_dir,
            file_prefix=f"open_meteo_historical_lat{lat:.2f}_lon{lon:.2f}",
            deduplicate_on="timestamp_utc",
        )
        logger.info(f"Historical ingestion complete: {len(df)} records saved.")
    elif mode == "forecast":
        logger.info(f"Initiating FORECAST ingestion: Lat={lat}, Lon={lon}, Days={forecast_days}")
        payload = client.fetch_forecast(
            latitude=lat,
            longitude=lon,
            forecast_days=forecast_days,
            variables=DEFAULT_FORECAST_VARIABLES,
        )
        df, metadata = normalize_forecast_dataset(payload)
        raw_f, csv_f, meta_f = save_ingested_dataset(
            raw_payload=payload,
            df_normalized=df,
            metadata=metadata,
            raw_output_dir=raw_output_dir,
            processed_output_dir=proc_output_dir,
            file_prefix=f"open_meteo_forecast_lat{lat:.2f}_lon{lon:.2f}",
            deduplicate_on="valid_time_utc",
        )
        logger.info(f"Forecast ingestion complete: {len(df)} forecast steps saved.")
    else:
        raise ValueError(f"Unknown mode '{mode}'. Choose 'historical' or 'forecast'.")

    return {
        "status": "success",
        "mode": mode,
        "records": len(df),
        "raw_file": str(raw_f),
        "csv_file": str(csv_f),
        "metadata_file": str(meta_f),
        "variables": metadata.variables_retrieved,
        "units": metadata.units,
        "missing_counts": metadata.missing_value_counts,
    }


def main():
    parser = argparse.ArgumentParser(description="AquaSense-IoT Weather Data Ingestion CLI")
    parser.add_argument("--mode", choices=["historical", "forecast"], default="historical", help="Ingestion mode")
    parser.add_argument("--lat", type=float, default=DEFAULT_LATITUDE, help="Field latitude")
    parser.add_argument("--lon", type=float, default=DEFAULT_LONGITUDE, help="Field longitude")
    parser.add_argument("--start-date", default="2024-01-01", help="Start date (YYYY-MM-DD) for historical")
    parser.add_argument("--end-date", default="2024-01-15", help="End date (YYYY-MM-DD) for historical")
    parser.add_argument("--forecast-days", type=int, default=7, help="Forecast horizon in days (1-16)")

    args = parser.parse_args()
    res = run_ingestion(
        lat=args.lat,
        lon=args.lon,
        mode=args.mode,
        start_date=args.start_date,
        end_date=args.end_date,
        forecast_days=args.forecast_days,
    )
    print("\n--- Ingestion Result ---")
    for k, v in res.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
