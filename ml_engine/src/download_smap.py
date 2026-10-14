"""CLI Utility for Querying and Ingesting NASA SMAP Soil Moisture Granules.

Uses NASA CMR API for granule discovery and NSIDC DAAC for authenticated HDF5 retrieval.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Add backend to path
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.services.nasa_smap import (
    NASASMAPClient,
    NASAEarthdataAuthError,
    normalize_smap_observations,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("download_smap")


def run_smap_discovery(
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    download: bool = False,
) -> dict:
    """Discovers available SMAP granules in NASA CMR and optionally downloads them."""
    client = NASASMAPClient()
    granules = client.search_granules(
        latitude=lat,
        longitude=lon,
        start_date=start_date,
        end_date=end_date,
    )

    result = {
        "status": "success",
        "product": "NASA SMAP SPL3SMP_E v006",
        "coordinates": {"lat": lat, "lon": lon},
        "query_range": {"start": start_date, "end": end_date},
        "granules_found_count": len(granules),
        "granules": [g.model_dump() for g in granules],
        "download_attempted": download,
        "downloaded_files": [],
        "auth_blocker_note": None,
    }

    if download and granules:
        raw_smap_dir = ROOT_DIR / "ml_engine" / "data" / "raw" / "smap"
        for g in granules:
            filename = Path(g.download_url).name
            dest_file = raw_smap_dir / filename
            try:
                client.download_granule(g.download_url, dest_file)
                result["downloaded_files"].append(str(dest_file))
            except NASAEarthdataAuthError as auth_err:
                logger.warning(f"Download requires authentication: {auth_err}")
                result["auth_blocker_note"] = str(auth_err)
                break
            except Exception as e:
                logger.error(f"Download failed for {g.download_url}: {e}")

    return result


def main():
    parser = argparse.ArgumentParser(description="AquaSense-IoT NASA SMAP Granule Discovery & Retrieval")
    parser.add_argument("--lat", type=float, default=15.8281, help="Target latitude")
    parser.add_argument("--lon", type=float, default=78.0373, help="Target longitude")
    parser.add_argument("--start-date", default="2024-01-01", help="Start date YYYY-MM-DD")
    parser.add_argument("--end-date", default="2024-01-15", help="End date YYYY-MM-DD")
    parser.add_argument("--download", action="store_true", help="Attempt authenticated download")

    args = parser.parse_args()
    res = run_smap_discovery(
        lat=args.lat,
        lon=args.lon,
        start_date=args.start_date,
        end_date=args.end_date,
        download=args.download,
    )

    print("\n--- NASA SMAP Discovery Summary ---")
    print(f"Product: {res['product']}")
    print(f"Granules Found in NASA CMR: {res['granules_found_count']}")
    for g in res["granules"][:3]:
        print(f" - ID: {g['producer_granule_id']} ({g['time_start']} to {g['time_end']})")
    if res["granules_found_count"] > 3:
        print(f"   ... and {res['granules_found_count'] - 3} more granules.")

    if res["auth_blocker_note"]:
        print(f"\nAuthentication Status: {res['auth_blocker_note']}")


if __name__ == "__main__":
    main()
