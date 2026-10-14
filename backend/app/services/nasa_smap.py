"""AquaSense-IoT NASA SMAP Satellite Data Client & Parser.

Integrates official NASA Earthdata CMR and NSIDC DAAC repositories for SMAP
(Soil Moisture Active Passive) radiometer observations.
Selected Product: SPL3SMP_E (Enhanced Radiometer Global Daily 9 km EASE-Grid 2.0).
DOI: 10.5067/4DQAS6970728
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Official NASA Earthdata Endpoints
CMR_GRANULES_SEARCH_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
SMAP_PRODUCT_SHORT_NAME = "SPL3SMP_E"
SMAP_PRODUCT_VERSION = "006"


class NASAEarthdataError(Exception):
    """Base exception for NASA Earthdata interactions."""
    pass


class NASAEarthdataAuthError(NASAEarthdataError):
    """Raised when Earthdata credentials are missing, invalid, or unauthorized."""
    pass


class NASAEarthdataGranuleNotFoundError(NASAEarthdataError):
    """Raised when no satellite granules intersect the spatiotemporal query."""
    pass


class SMAPGranuleInfo(BaseModel):
    """Metadata describing an identified SMAP granule in NASA CMR."""
    granule_id: str
    producer_granule_id: str
    time_start: str
    time_end: str
    download_url: str
    size_mb: Optional[float] = None
    day_night_flag: Optional[str] = None


class SMAPObservation(BaseModel):
    """Normalized satellite soil-moisture observation with scientific quality flags."""
    timestamp_utc: str
    latitude: float
    longitude: float
    soil_moisture_m3m3: float
    retrieval_qual_flag: int
    is_valid_quality: bool
    quality_assessment: str
    surface_temp_c: Optional[float] = None
    vegetation_water_content_kgm2: Optional[float] = None
    source_type: str = "SATELLITE_DERIVED"
    provider: str = "NASA SMAP SPL3SMP_E 9km"
    granule_id: str


class NASASMAPClient:
    """Reusable client for NASA Earthdata SMAP search, retrieval, and parsing."""

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        bearer_token: Optional[str] = None,
        cmr_url: str = CMR_GRANULES_SEARCH_URL,
        timeout_seconds: float = 30.0,
        http_client: Optional[httpx.Client] = None,
    ):
        self.username = username or os.getenv("EARTHDATA_USERNAME", "")
        self.password = password or os.getenv("EARTHDATA_PASSWORD", "")
        self.bearer_token = bearer_token or os.getenv("EARTHDATA_TOKEN", "")
        self.cmr_url = cmr_url
        self.timeout_seconds = timeout_seconds
        self._http_client = http_client

    def _get_client(self, authenticated: bool = False) -> httpx.Client:
        if self._http_client is not None:
            return self._http_client

        auth = None
        headers = {
            "User-Agent": "AquaSense-IoT/1.0 (Precision Agriculture Research Framework)",
            "Accept": "application/json",
        }

        if authenticated:
            if self.bearer_token:
                headers["Authorization"] = f"Bearer {self.bearer_token}"
            elif self.username and self.password:
                auth = httpx.BasicAuth(self.username, self.password)
            else:
                raise NASAEarthdataAuthError(
                    "NASA Earthdata credentials missing. Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD "
                    "or EARTHDATA_TOKEN in your environment/.env file."
                )

        return httpx.Client(
            timeout=httpx.Timeout(self.timeout_seconds),
            auth=auth,
            headers=headers,
            follow_redirects=True,
        )

    def search_granules(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
        short_name: str = SMAP_PRODUCT_SHORT_NAME,
        version: str = SMAP_PRODUCT_VERSION,
        limit: int = 50,
    ) -> List[SMAPGranuleInfo]:
        """Queries NASA Common Metadata Repository (CMR) for SMAP granules covering the coordinates."""
        client = self._get_client(authenticated=False)

        # CMR expects temporal range in ISO8601 UTC
        time_query = f"{start_date}T00:00:00Z,{end_date}T23:59:59Z"
        # CMR point query format: longitude,latitude
        point_query = f"{longitude:.4f},{latitude:.4f}"

        params = {
            "short_name": short_name,
            "version": version,
            "point": point_query,
            "temporal": time_query,
            "page_size": limit,
            "sort_key": "start_date",
        }

        try:
            logger.info(f"Querying NASA CMR for {short_name} v{version} at ({latitude}, {longitude}) from {start_date} to {end_date}")
            response = client.get(self.cmr_url, params=params)
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            raise NASAEarthdataError(f"Network error querying NASA CMR: {e}") from e

        if response.status_code != 200:
            raise NASAEarthdataError(
                f"NASA CMR returned HTTP {response.status_code}: {response.text}"
            )

        try:
            payload = response.json()
        except Exception as e:
            raise NASAEarthdataError(f"Failed to parse CMR JSON response: {e}") from e

        entries = payload.get("feed", {}).get("entry", [])
        if not entries:
            logger.warning(f"No SMAP granules found for ({latitude}, {longitude}) in {time_query}")
            return []

        granules: List[SMAPGranuleInfo] = []
        for e in entries:
            # Locate direct HDF5 data download link
            h5_links = [
                l["href"]
                for l in e.get("links", [])
                if l.get("href", "").endswith(".h5") and not l.get("href", "").endswith(".xml")
            ]
            if not h5_links:
                continue

            granule_id = e.get("id", "")
            title = e.get("title", "")
            start_t = e.get("time_start", "")
            end_t = e.get("time_end", "")
            size_mb = float(e.get("granule_size", 0.0)) if e.get("granule_size") else None
            day_night = e.get("day_night_flag")

            granules.append(
                SMAPGranuleInfo(
                    granule_id=granule_id,
                    producer_granule_id=title,
                    time_start=start_t,
                    time_end=end_t,
                    download_url=h5_links[0],
                    size_mb=size_mb,
                    day_night_flag=day_night,
                )
            )

        logger.info(f"Identified {len(granules)} NASA SMAP granules in CMR query.")
        return granules

    def download_granule(
        self,
        granule_url: str,
        destination_path: Path | str,
    ) -> Path:
        """Downloads an official SMAP HDF5 granule with Earthdata authentication."""
        dest = Path(destination_path)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if not (self.username and self.password) and not self.bearer_token:
            raise NASAEarthdataAuthError(
                "Authentication credentials not provided. Set EARTHDATA_USERNAME and "
                "EARTHDATA_PASSWORD in your backend environment variables to download real SMAP granules."
            )

        client = self._get_client(authenticated=True)
        logger.info(f"Downloading SMAP granule: {granule_url} -> {dest}")

        try:
            with client.stream("GET", granule_url) as response:
                if response.status_code == 401:
                    raise NASAEarthdataAuthError(
                        "Earthdata HTTP 401 Unauthorized: Invalid NASA credentials or URS OAuth agreement pending."
                    )
                if response.status_code == 403:
                    raise NASAEarthdataAuthError(
                        "Earthdata HTTP 403 Forbidden: You must authorize NSIDC DAAC in your NASA Earthdata profile."
                    )
                if response.status_code >= 400:
                    raise NASAEarthdataError(
                        f"Failed to download SMAP granule. HTTP {response.status_code}: {response.text}"
                    )

                with open(dest, "wb") as f:
                    for chunk in response.iter_bytes(chunk_size=65536):
                        f.write(chunk)

            logger.info(f"Successfully downloaded SMAP granule ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
            return dest
        except httpx.HTTPError as e:
            if dest.exists():
                dest.unlink()
            raise NASAEarthdataError(f"HTTP error downloading granule from {granule_url}: {e}") from e

    @staticmethod
    def evaluate_quality_flag(flag: int) -> Tuple[bool, str]:
        """Evaluates SMAP SPL3SMP_E retrieval_qual_flag bitmask.

        Bit 0: Recommended Quality (0 = Recommended, 1 = Not Recommended)
        Bit 1: Retrieval Attempted (0 = Attempted, 1 = Not Attempted)
        Bit 2: Retrieval Successful (0 = Success, 1 = Failure)
        """
        # Bit 0 check
        bit0_recommended = (flag & 1) == 0
        bit1_attempted = (flag & 2) == 0
        bit2_success = (flag & 4) == 0

        if bit0_recommended and bit1_attempted and bit2_success:
            return True, "RECOMMENDED_QUALITY"
        elif not bit0_recommended and bit2_success:
            return False, "RETRIEVAL_SUBOPTIMAL (Dense Veg / RFI / Water)"
        elif not bit2_success:
            return False, "RETRIEVAL_FAILED"
        return False, f"FLAG_{flag}_NON_RECOMMENDED"

    @staticmethod
    def parse_smap_hdf5(
        h5_filepath: Path | str,
        target_lat: float,
        target_lon: float,
        max_distance_km: float = 15.0,
    ) -> List[SMAPObservation]:
        """Parses an official NASA SMAP SPL3SMP_E HDF5 granule and extracts pixel observations."""
        import h5py

        h5_path = Path(h5_filepath)
        if not h5_path.exists():
            raise FileNotFoundError(f"SMAP HDF5 file not found: {h5_path}")

        observations: List[SMAPObservation] = []

        with h5py.File(h5_path, "r") as h5:
            # SMAP L3 contains both AM (descending ~06:00) and PM (ascending ~18:00) passes
            groups = [
                ("Soil_Moisture_Retrieval_Data_AM", "AM"),
                ("Soil_Moisture_Retrieval_Data_PM", "PM"),
            ]

            for grp_name, pass_type in groups:
                if grp_name not in h5:
                    continue

                grp = h5[grp_name]
                if "latitude" not in grp or "longitude" not in grp or "soil_moisture" not in grp:
                    continue

                lats = grp["latitude"][:]
                lons = grp["longitude"][:]
                sm_arr = grp["soil_moisture"][:]
                qual_flags = grp["retrieval_qual_flag"][:] if "retrieval_qual_flag" in grp else None
                surf_temp = grp["surface_temperature"][:] if "surface_temperature" in grp else None
                veg_water = grp["vegetation_water_content"][:] if "vegetation_water_content" in grp else None
                tb_time_utc = grp["tb_time_utc"][:] if "tb_time_utc" in grp else None

                # Distance calculation to find pixel nearest to target farm coordinates
                dist_deg = np.sqrt((lats - target_lat) ** 2 + (lons - target_lon) ** 2)
                # 1 degree is roughly 111 km
                dist_km = dist_deg * 111.0
                min_idx = np.unravel_index(np.argmin(dist_km), dist_km.shape)

                if dist_km[min_idx] <= max_distance_km:
                    sm_val = float(sm_arr[min_idx])
                    q_flag = int(qual_flags[min_idx]) if qual_flags is not None else 0

                    # Filter fill values (-9999.0 is standard NASA fill value)
                    if sm_val <= -9000.0 or np.isnan(sm_val):
                        continue

                    is_valid, q_desc = NASASMAPClient.evaluate_quality_flag(q_flag)

                    # Extract ISO timestamp if available, else derive from filename
                    obs_time_str = ""
                    if tb_time_utc is not None:
                        val = tb_time_utc[min_idx]
                        if isinstance(val, (bytes, bytearray)):
                            obs_time_str = val.decode("utf-8").strip()
                        elif isinstance(val, str):
                            obs_time_str = val.strip()

                    if not obs_time_str:
                        # Fallback to granule date from filename: SMAP_L3_SM_P_E_YYYYMMDD_...
                        parts = h5_path.stem.split("_")
                        date_str = parts[5] if len(parts) > 5 else datetime.now(timezone.utc).strftime("%Y%m%d")
                        hour_str = "06:00:00Z" if pass_type == "AM" else "18:00:00Z"
                        obs_time_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}T{hour_str}"

                    # Surface temperature conversion (Kelvin to Celsius)
                    t_c = None
                    if surf_temp is not None:
                        val_t = float(surf_temp[min_idx])
                        if val_t > 0:
                            t_c = round(val_t - 273.15, 2)

                    # Vegetation water content
                    vwc = None
                    if veg_water is not None:
                        val_vwc = float(veg_water[min_idx])
                        if val_vwc >= 0:
                            vwc = round(val_vwc, 2)

                    observations.append(
                        SMAPObservation(
                            timestamp_utc=obs_time_str,
                            latitude=float(lats[min_idx]),
                            longitude=float(lons[min_idx]),
                            soil_moisture_m3m3=round(sm_val, 4),
                            retrieval_qual_flag=q_flag,
                            is_valid_quality=is_valid,
                            quality_assessment=q_desc,
                            surface_temp_c=t_c,
                            vegetation_water_content_kgm2=vwc,
                            granule_id=h5_path.name,
                        )
                    )

        return observations


def normalize_smap_observations(
    observations: List[SMAPObservation],
) -> pd.DataFrame:
    """Converts a collection of parsed SMAP observations into a normalized pandas DataFrame."""
    if not observations:
        return pd.DataFrame(
            columns=[
                "timestamp_utc",
                "latitude",
                "longitude",
                "soil_moisture_smap_m3m3",
                "retrieval_qual_flag",
                "is_valid_quality",
                "quality_assessment",
                "surface_temp_c",
                "vegetation_water_content_kgm2",
                "source_type",
                "provider",
                "granule_id",
            ]
        )

    records = [
        {
            "timestamp_utc": obs.timestamp_utc,
            "latitude": obs.latitude,
            "longitude": obs.longitude,
            "soil_moisture_smap_m3m3": obs.soil_moisture_m3m3,
            "retrieval_qual_flag": obs.retrieval_qual_flag,
            "is_valid_quality": obs.is_valid_quality,
            "quality_assessment": obs.quality_assessment,
            "surface_temp_c": obs.surface_temp_c,
            "vegetation_water_content_kgm2": obs.vegetation_water_content_kgm2,
            "source_type": obs.source_type,
            "provider": obs.provider,
            "granule_id": obs.granule_id,
        }
        for obs in observations
    ]
    df = pd.DataFrame(records)
    df.sort_values(by="timestamp_utc", inplace=True)
    return df
