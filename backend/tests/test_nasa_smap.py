"""Tests for NASA SMAP Discovery, Quality Flag Filtering, and Granule Parsing."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import h5py
import httpx
import numpy as np
import pytest

from app.services.nasa_smap import (
    NASASMAPClient,
    NASAEarthdataAuthError,
    NASAEarthdataError,
    normalize_smap_observations,
)


@pytest.fixture
def mock_cmr_response():
    """Mocked NASA CMR Search response with 2 granules."""
    return {
        "feed": {
            "entry": [
                {
                    "id": "G12345-NSIDC",
                    "title": "SMAP_L3_SM_P_E_20240101_R19240_001.h5",
                    "time_start": "2024-01-01T00:00:00.000Z",
                    "time_end": "2024-01-01T23:59:59.999Z",
                    "granule_size": "150.5",
                    "day_night_flag": "BOTH",
                    "links": [
                        {
                            "rel": "http://esipfed.org/ns/fed/1.0/data#",
                            "href": "https://data.nsidc.earthdatacloud.nasa.gov/SMAP_L3_SM_P_E_20240101_R19240_001.h5",
                        }
                    ],
                },
                {
                    "id": "G12346-NSIDC",
                    "title": "SMAP_L3_SM_P_E_20240102_R19240_001.h5",
                    "time_start": "2024-01-02T00:00:00.000Z",
                    "time_end": "2024-01-02T23:59:59.999Z",
                    "granule_size": "152.0",
                    "day_night_flag": "BOTH",
                    "links": [
                        {
                            "rel": "http://esipfed.org/ns/fed/1.0/data#",
                            "href": "https://data.nsidc.earthdatacloud.nasa.gov/SMAP_L3_SM_P_E_20240102_R19240_001.h5",
                        }
                    ],
                },
            ]
        }
    }


def test_cmr_search_granules_mocked(mock_cmr_response):
    """Verify CMR query extracts granule metadata correctly."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_cmr_response

    mock_http = MagicMock(spec=httpx.Client)
    mock_http.get.return_value = mock_resp

    client = NASASMAPClient(http_client=mock_http)
    granules = client.search_granules(
        latitude=15.8281,
        longitude=78.0373,
        start_date="2024-01-01",
        end_date="2024-01-02",
    )

    assert len(granules) == 2
    assert granules[0].granule_id == "G12345-NSIDC"
    assert granules[0].download_url.endswith(".h5")
    assert granules[0].size_mb == 150.5


def test_download_granule_auth_error_when_uncredentialed(tmp_path):
    """Attempting download without credentials must raise NASAEarthdataAuthError."""
    client = NASASMAPClient(username="", password="", bearer_token="")
    dest = tmp_path / "test.h5"

    with pytest.raises(NASAEarthdataAuthError, match="credentials not provided"):
        client.download_granule(
            "https://data.nsidc.earthdatacloud.nasa.gov/test.h5",
            dest,
        )


def test_quality_flag_evaluation_bitmask():
    """Verify bitmask interpretation of retrieval_qual_flag."""
    # 0 = bit 0 clear (recommended), bit 1 clear (attempted), bit 2 clear (successful)
    is_valid, desc = NASASMAPClient.evaluate_quality_flag(0)
    assert is_valid is True
    assert "RECOMMENDED_QUALITY" in desc

    # 1 = bit 0 set (not recommended)
    is_valid, desc = NASASMAPClient.evaluate_quality_flag(1)
    assert is_valid is False
    assert "Dense Veg" in desc or "SUBOPTIMAL" in desc

    # 4 = bit 2 set (retrieval failed)
    is_valid, desc = NASASMAPClient.evaluate_quality_flag(4)
    assert is_valid is False
    assert "FAILED" in desc


def test_parse_smap_hdf5_synthetic_fixture(tmp_path):
    """Creates a temporary HDF5 file formatted like official SMAP L3 to test parsing logic."""
    test_h5 = tmp_path / "SMAP_L3_SM_P_E_20240101_R19240_001.h5"

    # Create realistic test HDF5 hierarchy
    with h5py.File(test_h5, "w") as f:
        grp = f.create_group("Soil_Moisture_Retrieval_Data_AM")
        # 3x3 grid around Kurnool (15.8281, 78.0373)
        lats = np.array([[15.80, 15.8281, 15.85], [15.80, 15.8281, 15.85], [15.80, 15.8281, 15.85]])
        lons = np.array([[78.00, 78.00, 78.00], [78.0373, 78.0373, 78.0373], [78.07, 78.07, 78.07]])
        sm = np.array([[0.15, 0.18, 0.22], [0.16, 0.19, 0.21], [0.14, 0.17, 0.20]])
        flags = np.array([[0, 0, 1], [0, 0, 0], [0, 1, 0]], dtype=np.uint16)
        temp = np.array([[295.0, 296.0, 297.0], [295.5, 296.5, 297.5], [294.0, 295.0, 296.0]])

        grp.create_dataset("latitude", data=lats)
        grp.create_dataset("longitude", data=lons)
        grp.create_dataset("soil_moisture", data=sm)
        grp.create_dataset("retrieval_qual_flag", data=flags)
        grp.create_dataset("surface_temperature", data=temp)

    obs_list = NASASMAPClient.parse_smap_hdf5(
        h5_filepath=test_h5,
        target_lat=15.8281,
        target_lon=78.0373,
        max_distance_km=15.0,
    )

    assert len(obs_list) == 1
    obs = obs_list[0]
    assert obs.soil_moisture_m3m3 == 0.19
    assert obs.is_valid_quality is True
    # 296.5 Kelvin - 273.15 = 23.35 °C
    assert abs(obs.surface_temp_c - 23.35) < 0.1
    assert "2024-01-01" in obs.timestamp_utc


def test_normalize_smap_observations():
    """Verify DataFrame normalization and provenance metadata."""
    from app.services.nasa_smap import SMAPObservation
    sample_obs = [
        SMAPObservation(
            timestamp_utc="2024-01-01T06:00:00Z",
            latitude=15.8281,
            longitude=78.0373,
            soil_moisture_m3m3=0.19,
            retrieval_qual_flag=0,
            is_valid_quality=True,
            quality_assessment="RECOMMENDED_QUALITY",
            surface_temp_c=23.35,
            vegetation_water_content_kgm2=0.45,
            granule_id="SMAP_L3_SM_P_E_20240101.h5",
        )
    ]
    df = normalize_smap_observations(sample_obs)
    assert len(df) == 1
    assert df.loc[0, "source_type"] == "SATELLITE_DERIVED"
    assert df.loc[0, "soil_moisture_smap_m3m3"] == 0.19
