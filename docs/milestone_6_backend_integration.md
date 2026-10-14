# Milestone 6: FastAPI Backend and PostgreSQL Integration Guide

## 1. Overview

Milestone 6 integrates the previous data ingestion pipelines (Open-Meteo, NASA SMAP, ground sensors), trained machine learning model (`root_zone_model.joblib`), and the FAO-56 irrigation decision engine into a robust, asynchronous FastAPI backend backed by PostgreSQL.

---

## 2. Architecture & Components

```
                   +---------------------------------------------+
                   |             FastAPI Application             |
                   |      (Uvicorn / AsyncPG / SQLAlchemy)       |
                   +----------------------+----------------------+
                                          |
                +-------------------------+-------------------------+
                |                         |                         |
       [REST / OAuth2]           [Service Layer]           [Database Engine]
                |                         |                         |
   +------------+------------+            |                 +-------+-------+
   | /api/v1/auth            |            |                 | PostgreSQL    |
   | /api/v1/fields          |            |                 | (AsyncPG)     |
   | /api/v1/observations    |            |                 +---------------+
   | /api/v1/predictions     |---+        |                         |
   | /api/v1/irrigation      |   |        |                 +-------+-------+
   | /api/v1/status          |   |        |                 | Tables:       |
   | /health, /health/db     |   |        |                 | - users       |
   +-------------------------+   |        |                 | - fields      |
                                 |        |                 | - sensor_obs  |
                                 v        v                 | - weather_obs |
                  +--------------------------------+        | - predictions |
                  | Trained ML Artifacts           |        | - irrigation_ |
                  | - root_zone_model.joblib       |        |   recomms     |
                  | - model_metadata.json          |        +---------------+
                  | - FAO-56 Decision Engine       |
                  +--------------------------------+
```

---

## 3. Database Schema & Tables

All tables are defined in `backend/app/models/` and managed via Alembic migrations:

1. **`users`**:
   - `id` (UUID string, PK), `email` (Unique, indexed), `hashed_password` (Bcrypt), `full_name`, `is_active`, `is_superuser`, `created_at`.
2. **`fields`**:
   - `id` (UUID string, PK), `user_id` (FK -> `users.id` ON DELETE CASCADE), `name`, `latitude`, `longitude`, `area_value`, `area_unit`, `area_m2`, `irrigation_method`, `application_efficiency`, `max_depth_per_event_mm`, `max_volume_m3`.
   - Agronomic parameters: `crop_name`, `growth_stage`, `kc`, `root_depth_m`, `depletion_fraction_p`, `soil_texture`, `field_capacity_theta`, `wilting_point_theta`.
3. **`sensor_observations`**:
   - `id` (PK), `field_id` (FK -> `fields.id`), `device_id` (indexed), `observation_timestamp_utc` (indexed), `soil_moisture_m3m3`, `soil_temperature_c`, `relative_humidity_pct`, `depth_cm`, `source_type` (`MEASURED` or `SIMULATED`), `battery_level_pct`, `signal_rssi_dbm`.
4. **`weather_observations`**:
   - `id` (PK), `field_id` (FK -> `fields.id`), `timestamp_utc` (indexed), `temperature_2m_c`, `relative_humidity_pct`, `precipitation_mm`, `rain_mm`, `surface_pressure_hpa`, `et0_fao_mm`, `shortwave_radiation_wm2`, `wind_speed_kmh`, `source_type`, `provider`.
5. **`predictions`**:
   - `id` (PK), `field_id` (FK -> `fields.id`), `prediction_timestamp_utc`, `target_timestamp_utc`, `horizon_hours` (24), `target_variable` (`soil_moisture_7_to_28cm`), `target_depth` (`7-28 cm (Root Zone)`), `units` (`m3/m3`), `current_moisture_m3m3`, `predicted_moisture_m3m3`, `projected_change_m3m3`, `model_version`, `model_name`, `input_provenance`, `features_json`.
6. **`irrigation_recommendations`**:
   - `id` (PK), `field_id` (FK -> `fields.id`), `prediction_id` (FK -> `predictions.id` ON DELETE SET NULL), `generated_at_utc`, `action` (`IRRIGATE_RECOMMENDED`, `IRRIGATION_DEFERRED`, `INDETERMINATE`), `net_irrigation_depth_mm`, `gross_irrigation_depth_mm`, `water_volume_m3`, `water_volume_liters`, `total_available_water_taw_mm`, `readily_available_water_raw_mm`, `current_depletion_dr_mm`, `effective_rainfall_considered_mm`, `crop_evapotranspiration_etc_mm`, `explanations_json`, `warnings_json`, `baseline_comparison_json`, `suggested_timing_window`.

---

## 4. Alembic Migrations

To apply migrations against a running PostgreSQL instance:
```powershell
alembic -c backend/alembic.ini upgrade head
```

To review generated SQL without applying:
```powershell
alembic -c backend/alembic.ini upgrade head --sql
```

---

## 5. PostgreSQL Setup & Health Check

The backend connects to PostgreSQL using AsyncPG:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/aquasense_db
SYNC_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aquasense_db
```

### PostgreSQL Status & Graceful Degradation
- If PostgreSQL is offline, `GET /health` continues to return HTTP 200 with `api: online`.
- `GET /health/database` dynamically tests connectivity. If unreachable, it returns HTTP 503 Service Unavailable with clear startup commands:
  ```powershell
  # Start native Windows service:
  Start-Service postgresql-x64-18
  
  # Or launch via Docker:
  docker run -d --name aquasense-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aquasense_db postgres:16
  ```

---

## 6. Authentication & API Endpoints

### 6.1 Authentication
- `POST /api/v1/auth/register`: Create user account.
- `POST /api/v1/auth/login`: Authenticate via JSON payload (`{"email": "...", "password": "..."}`) or standard OAuth2 form-data (`username=...&password=...`). Returns signed JWT Bearer token.
- `GET /api/v1/auth/me`: Authenticated profile endpoint.

### 6.2 Fields (Multi-Tenant User Isolation)
- `POST /api/v1/fields`: Create agricultural field.
- `GET /api/v1/fields`: List authenticated user's fields.
- `GET /api/v1/fields/{id}`: Get single field (enforces user ownership).
- `PATCH /api/v1/fields/{id}`: Update crop stage, Kc, or limits.
- `DELETE /api/v1/fields/{id}`: Delete field and cascading telemetry.

### 6.3 Observations
- `POST /api/v1/observations`: Ingest in-situ ground sensor telemetry. Validates physical bounds, normalizes timestamps, and prevents duplicate records.
- `GET /api/v1/fields/{id}/observations`: Query chronological field sensor records.
- `GET /api/v1/fields/{id}/weather`: Query meteorological observations.

### 6.4 ML Predictions
- `POST /api/v1/fields/{id}/predictions`: Executes trained Random Forest model (`root_zone_model.joblib`), predicts 24h root-zone moisture (7-28 cm), records provenance, and saves result.
- `GET /api/v1/fields/{id}/predictions`: Chronological history of field predictions.
- `GET /api/v1/predictions/{id}`: Retrieve single prediction by ID.

### 6.5 Precision Irrigation Advisories
- `POST /api/v1/fields/{id}/irrigation/recommendations`: Executes FAO-56 dual crop coefficient water-balance model using latest sensor readings, 24h ML prediction, and rainfall forecasts. Calculates RAW, TAW, depletion, net/gross irrigation depths, and water volumes (m³ and liters).
- `GET /api/v1/fields/{id}/irrigation/recommendations`: Advisory history.
- `GET /api/v1/irrigation/recommendations/{id}`: Detailed advisory by ID.

### 6.6 System Status
- `GET /api/v1/status`: Comprehensive status of PostgreSQL, ML model artifact, and external data sources (Open-Meteo, NASA SMAP, ground sensors).

---

## 7. Automated Test Verification

All 53 unit and integration tests execute cleanly with `pytest`:
```powershell
pytest backend/tests -v
```
Results:
- `test_backend_integration.py`: 7 passed (100%)
- `test_data_fusion.py`: 4 passed
- `test_decision_engine.py`: 11 passed
- `test_ground_sensors.py`: 7 passed
- `test_health.py`: 2 passed
- `test_ml_inference.py`: 5 passed
- `test_nasa_smap.py`: 5 passed
- `test_open_meteo.py`: 12 passed
- **Total: 53 passed**.
