from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AquaSense-IoT Core Backend Settings."""
    PROJECT_NAME: str = "AquaSense-IoT Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & JWT
    SECRET_KEY: str = "aquasense_dev_insecure_jwt_secret_key_change_in_production_384729"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
   BACKEND_CORS_ORIGINS: List[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://aqua-sense-io-t.vercel.app",
]

    # Database (PostgreSQL)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "aquasense_db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/aquasense_db"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/aquasense_db"

    # ML Artifacts (Relative to backend directory or root)
    MODEL_ARTIFACT_PATH: str = "ml_engine/models/root_zone_model.joblib"
    MODEL_METADATA_PATH: str = "ml_engine/models/model_metadata.json"

    # Data Sources
    EARTHDATA_USERNAME: str = ""
    EARTHDATA_PASSWORD: str = ""
    NASA_CMR_API_URL: str = "https://cmr.earthdata.nasa.gov/search"
    OPEN_METEO_HISTORICAL_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    OPEN_METEO_FORECAST_URL: str = "https://api.open-meteo.com/v1/forecast"

    # SMTP & Personal Email Dispatch
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "notifications@aquasense.org"
    EMAILS_FROM_NAME: str = "AquaSense Precision Agriculture"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
