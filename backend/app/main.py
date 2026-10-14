"""AquaSense-IoT FastAPI Application Entrypoint."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.evaluation import router as evaluation_router
from app.api.v1.fields import router as fields_router
from app.api.v1.irrigation import router as irrigation_router
from app.api.v1.observations import router as observations_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.status import router as status_router
from app.api.v1.telemetry import router as telemetry_router
from app.core.config import settings
from app.core.database import check_database_connection

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(fields_router, prefix=settings.API_V1_STR)
app.include_router(observations_router, prefix=settings.API_V1_STR)
app.include_router(predictions_router, prefix=settings.API_V1_STR)
app.include_router(irrigation_router, prefix=settings.API_V1_STR)
app.include_router(evaluation_router, prefix=settings.API_V1_STR)
app.include_router(status_router, prefix=settings.API_V1_STR)
app.include_router(telemetry_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["General"])
async def root():
    """Root entry point with project summary and documentation links."""
    return {
        "project": "AquaSense-IoT",
        "description": "Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling",
        "status": "operational",
        "version": "1.0.0",
        "api_docs": "/docs",
        "health": "/health",
        "database_health": "/health/database",
        "system_status": f"{settings.API_V1_STR}/status",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Application health endpoint verifying the web server is online."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "api": "online",
            "api_server": "online",
        },
    }


@app.get("/health/database", tags=["Health"])
async def database_health_check(response: Response):
    """PostgreSQL connectivity health check."""
    is_connected, message = await check_database_connection()
    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unavailable",
            "database": "PostgreSQL",
            "connected": False,
            "error": message,
            "remedy": (
                "PostgreSQL service is currently stopped or unreachable on port 5432. "
                "Start the native Windows PostgreSQL service (Start-Service postgresql-x64-18) "
                "or launch via Docker (docker compose up -d database)."
            ),
        }

    return {
        "status": "healthy",
        "database": "PostgreSQL",
        "connected": True,
        "detail": message,
    }


@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        },
    )
