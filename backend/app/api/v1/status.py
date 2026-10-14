"""FastAPI Status and Provenance Endpoint."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from app.core.config import settings
from app.core.database import check_database_connection

router = APIRouter(tags=["System Status"])


@router.get(
    "/status",
    summary="Comprehensive System, Model, and Data-Source Health",
)
async def get_system_status():
    """Reports detailed operational status across backend, PostgreSQL, ML artifacts, and data providers."""
    # Database check
    db_ok, db_msg = await check_database_connection()

    # ML Model artifact check
    model_file = Path(settings.MODEL_ARTIFACT_PATH)
    if not model_file.exists():
        alt = Path(__file__).resolve().parents[4] / settings.MODEL_ARTIFACT_PATH
        if alt.exists():
            model_file = alt

    meta_file = Path(settings.MODEL_METADATA_PATH)
    if not meta_file.exists():
        alt_meta = Path(__file__).resolve().parents[4] / settings.MODEL_METADATA_PATH
        if alt_meta.exists():
            meta_file = alt_meta

    model_status = {
        "artifact_found": model_file.exists(),
        "artifact_path": str(model_file),
        "inference_ready": model_file.exists(),
        "metadata_found": meta_file.exists(),
        "selected_model": None,
        "target_horizon": "24h",
        "target_depth": "7-28 cm (Root Zone)",
    }

    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
                model_status["selected_model"] = meta.get("selected_best_model")
                model_status["target_horizon"] = f"{meta.get('target', {}).get('horizon_hours', 24)}h"
        except Exception:
            pass

    return {
        "project": "AquaSense-IoT",
        "api_version": "v1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": {
            "api_server": "operational",
            "database": {
                "status": "healthy" if db_ok else "unavailable",
                "engine": "PostgreSQL (AsyncPG)",
                "detail": db_msg,
            },
            "ml_engine": model_status,
            "external_data_sources": {
                "open_meteo_archive": "available (public REST)",
                "open_meteo_forecast": "available (public REST)",
                "nasa_smap_cmr": "available (NASA Earthdata public metadata search)",
                "nasa_smap_hdf5_download": (
                    "authenticated (credentials configured)"
                    if (settings.EARTHDATA_USERNAME and settings.EARTHDATA_PASSWORD)
                    else "unauthenticated (credentials required in .env for HDF5 downloads)"
                ),
                "in_situ_ground_sensors": "endpoint active (awaiting physical hardware deployment)",
            },
        },
    }
