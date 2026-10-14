"""Comprehensive Integration Tests for AquaSense-IoT Backend.

Validates:
- Health and status endpoints (including graceful handling of offline PostgreSQL)
- User registration, password hashing, JWT authentication, and token verification
- Multi-tenant field isolation (User A cannot read/mutate User B's fields)
- Agricultural field CRUD operations
- Ground sensor observation ingestion, normalization, and deduplication
- End-to-end 24-hour root-zone soil moisture ML prediction pipeline execution and DB persistence
- End-to-end FAO-56 irrigation recommendation engine advisory generation and DB persistence
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture(scope="function")
async def client():
    """Provides an isolated in-memory test database and HTTP async test client for each test."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session_factory = async_sessionmaker(
        bind=test_engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with test_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_health_and_database_status(client: AsyncClient):
    """Verifies basic health and database health reporting."""
    # 1. API Health
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["services"]["api"] == "online"

    # 2. Database Health (Graceful check when native postgres is stopped)
    db_res = await client.get("/health/database")
    # Could be 200 if PostgreSQL is active, or 503 if offline
    assert db_res.status_code in [200, 503]
    db_data = db_res.json()
    assert "database" in db_data
    assert db_data["database"] == "PostgreSQL"
    if db_res.status_code == 503:
        assert db_data["connected"] is False
        assert "remedy" in db_data


@pytest.mark.asyncio
async def test_system_status_endpoint(client: AsyncClient):
    """Verifies that /api/v1/status reports ML artifacts and external sources."""
    res = await client.get("/api/v1/status")
    assert res.status_code == 200
    data = res.json()
    assert data["project"] == "AquaSense-IoT"
    assert data["services"]["api_server"] == "operational"
    # ML model check
    ml_status = data["services"]["ml_engine"]
    assert ml_status["artifact_found"] is True
    assert ml_status["inference_ready"] is True
    assert ml_status["target_horizon"] == "24h"
    assert ml_status["target_depth"] == "7-28 cm (Root Zone)"


@pytest.mark.asyncio
async def test_auth_workflow(client: AsyncClient):
    """Verifies registration, duplicate prevention, login, JWT issuance, and /auth/me."""
    # 1. Register User
    reg_payload = {
        "email": "researcher@aquasense.org",
        "password": "SecurePassword123!",
        "full_name": "Dr. Agri Scientist",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "researcher@aquasense.org"
    assert user_data["full_name"] == "Dr. Agri Scientist"
    assert "hashed_password" not in user_data
    assert "password" not in user_data
    assert "id" in user_data

    # 2. Duplicate Registration Prevention
    dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code in [400, 409]
    assert "already registered" in dup_res.json()["detail"].lower()

    # 3. Invalid Login Credentials
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "researcher@aquasense.org", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # 4. Valid Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "researcher@aquasense.org", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    token = token_data["access_token"]

    # 5. Access /auth/me with Bearer Token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "researcher@aquasense.org"

    # 6. Access /auth/me without Token
    unauth_res = await client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401


@pytest.mark.asyncio
async def test_field_crud_and_user_isolation(client: AsyncClient):
    """Verifies that Field CRUD operations enforce strict multi-tenant user isolation."""
    # Register User A
    await client.post(
        "/api/v1/auth/register",
        json={"email": "userA@aquasense.org", "password": "PasswordA123!"},
    )
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": "userA@aquasense.org", "password": "PasswordA123!"},
    )
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B
    await client.post(
        "/api/v1/auth/register",
        json={"email": "userB@aquasense.org", "password": "PasswordB123!"},
    )
    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "userB@aquasense.org", "password": "PasswordB123!"},
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    field_a_payload = {
        "name": "Kurnool Groundnut Plot 1",
        "latitude": 15.8281,
        "longitude": 78.0373,
        "area_unit": "hectares",
        "area_value": 2.5,
        "irrigation_method": "drip",
        "application_efficiency": 0.90,
        "max_depth_per_event_mm": 30.0,
        "crop": {
            "crop_name": "groundnut",
            "growth_stage": "mid_season",
            "kc": 1.15,
            "root_depth_m": 0.60,
            "depletion_fraction_p": 0.50,
        },
        "soil": {
            "soil_texture": "clay_loam",
            "field_capacity_theta": 0.31,
            "wilting_point_theta": 0.15,
        },
    }

    # User A creates Field A
    create_res = await client.post("/api/v1/fields", json=field_a_payload, headers=headers_a)
    assert create_res.status_code == 201
    field_a = create_res.json()
    field_a_id = field_a["id"]
    assert field_a["name"] == "Kurnool Groundnut Plot 1"
    assert field_a["area_m2"] == 25000.0  # 2.5 ha * 10,000

    # User B creates Field B
    field_b_payload = dict(field_a_payload)
    field_b_payload["name"] = "Anantapur Maize Field"
    create_b = await client.post("/api/v1/fields", json=field_b_payload, headers=headers_b)
    assert create_b.status_code == 201
    field_b_id = create_b.json()["id"]

    # User A lists fields: Should ONLY see Field A
    list_a = await client.get("/api/v1/fields", headers=headers_a)
    assert list_a.status_code == 200
    fields_a = list_a.json()
    assert len(fields_a) == 1
    assert fields_a[0]["id"] == field_a_id

    # User B lists fields: Should ONLY see Field B
    list_b = await client.get("/api/v1/fields", headers=headers_b)
    assert list_b.status_code == 200
    fields_b = list_b.json()
    assert len(fields_b) == 1
    assert fields_b[0]["id"] == field_b_id

    # User B attempts to access Field A -> 404 Not Found (User isolation)
    get_unauth = await client.get(f"/api/v1/fields/{field_a_id}", headers=headers_b)
    assert get_unauth.status_code == 404

    # User B attempts to update Field A -> 404 Not Found
    patch_unauth = await client.patch(
        f"/api/v1/fields/{field_a_id}",
        json={"kc": 0.85},
        headers=headers_b,
    )
    assert patch_unauth.status_code == 404

    # User B attempts to delete Field A -> 404 Not Found
    del_unauth = await client.delete(f"/api/v1/fields/{field_a_id}", headers=headers_b)
    assert del_unauth.status_code == 404

    # User A updates Field A
    update_res = await client.patch(
        f"/api/v1/fields/{field_a_id}",
        json={"kc": 1.20, "growth_stage": "late_season"},
        headers=headers_a,
    )
    assert update_res.status_code == 200
    assert update_res.json()["kc"] == 1.20
    assert update_res.json()["growth_stage"] == "late_season"

    # User A deletes Field A
    del_res = await client.delete(f"/api/v1/fields/{field_a_id}", headers=headers_a)
    assert del_res.status_code == 204

    # Verify deletion
    verify_del = await client.get(f"/api/v1/fields/{field_a_id}", headers=headers_a)
    assert verify_del.status_code == 404


@pytest.mark.asyncio
async def test_observation_ingestion_and_retrieval(client: AsyncClient):
    """Verifies ingestion of physical telemetry, deduplication, and historical query."""
    # Register & Login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "sensor_tech@aquasense.org", "password": "TechPassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "sensor_tech@aquasense.org", "password": "TechPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Field
    f_res = await client.post(
        "/api/v1/fields",
        json={
            "name": "Kurnool Research Station Plot",
            "latitude": 15.8281,
            "longitude": 78.0373,
            "area_unit": "hectares",
            "area_value": 1.0,
            "crop": {
                "crop_name": "groundnut",
                "growth_stage": "mid_season",
                "kc": 1.15,
                "root_depth_m": 0.60,
                "depletion_fraction_p": 0.50,
            },
            "soil": {
                "soil_texture": "clay_loam",
                "field_capacity_theta": 0.31,
                "wilting_point_theta": 0.15,
            },
        },
        headers=headers,
    )
    field_id = f_res.json()["id"]

    # Ingest Sensor Telemetry
    obs_payload = {
        "field_id": field_id,
        "device_id": "SN-KURNOOL-01",
        "observation_timestamp_utc": "2026-10-04T12:00:00Z",
        "soil_moisture_unit": "m3/m3",
        "soil_moisture": 0.22,
        "soil_temperature_unit": "celsius",
        "soil_temperature": 24.5,
        "relative_humidity_unit": "percent",
        "relative_humidity": 65.0,
        "depth_cm": 20.0,
        "battery_level_pct": 94.0,
        "signal_rssi_dbm": -72,
        "is_test_fixture": True,
    }
    ingest_res = await client.post("/api/v1/observations", json=obs_payload, headers=headers)
    assert ingest_res.status_code == 201
    obs_data = ingest_res.json()
    assert obs_data["device_id"] == "SN-KURNOOL-01"
    assert obs_data["soil_moisture_m3m3"] == 0.22
    assert obs_data["source_type"] == "SIMULATED"

    # Deduplication test: re-posting identical observation should return 409 Conflict
    dup_res = await client.post("/api/v1/observations", json=obs_payload, headers=headers)
    assert dup_res.status_code == 409
    assert "duplicate" in dup_res.json()["detail"].lower()

    # Retrieve observations for field
    list_obs = await client.get(f"/api/v1/fields/{field_id}/observations", headers=headers)
    assert list_obs.status_code == 200
    items = list_obs.json()
    assert len(items) == 1
    assert items[0]["soil_moisture_m3m3"] == 0.22


@pytest.mark.asyncio
async def test_soil_moisture_prediction_pipeline(client: AsyncClient):
    """Verifies ML model execution, 24h root-zone forecast, and DB persistence."""
    # Register & Login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "ml_analyst@aquasense.org", "password": "MLPassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "ml_analyst@aquasense.org", "password": "MLPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Field
    f_res = await client.post(
        "/api/v1/fields",
        json={
            "name": "Predictive Test Field",
            "latitude": 15.8281,
            "longitude": 78.0373,
            "area_unit": "hectares",
            "area_value": 3.0,
            "crop": {
                "crop_name": "groundnut",
                "growth_stage": "mid_season",
                "kc": 1.15,
                "root_depth_m": 0.60,
                "depletion_fraction_p": 0.50,
            },
            "soil": {
                "soil_texture": "clay_loam",
                "field_capacity_theta": 0.31,
                "wilting_point_theta": 0.15,
            },
        },
        headers=headers,
    )
    field_id = f_res.json()["id"]

    # Trigger ML Prediction
    pred_res = await client.post(
        f"/api/v1/fields/{field_id}/predictions",
        json={"current_soil_moisture_m3m3": 0.22, "hour_of_day": 14, "day_of_year": 120},
        headers=headers,
    )
    assert pred_res.status_code == 201
    pred_data = pred_res.json()
    pred_id = pred_data["id"]

    assert pred_data["field_id"] == field_id
    assert pred_data["horizon_hours"] == 24
    assert pred_data["target_variable"] == "soil_moisture_7_to_28cm"
    assert pred_data["target_depth"] == "7-28 cm (Root Zone)"
    assert pred_data["units"] == "m3/m3"
    assert pred_data["current_moisture_m3m3"] == 0.22
    assert 0.0 <= pred_data["predicted_moisture_m3m3"] <= 1.0
    assert pred_data["model_name"] == "RandomForest"

    # Query Field Predictions List
    list_preds = await client.get(f"/api/v1/fields/{field_id}/predictions", headers=headers)
    assert list_preds.status_code == 200
    preds_list = list_preds.json()
    assert len(preds_list) == 1
    assert preds_list[0]["id"] == pred_id

    # Query Single Prediction by ID
    single_pred = await client.get(f"/api/v1/predictions/{pred_id}", headers=headers)
    assert single_pred.status_code == 200
    assert single_pred.json()["id"] == pred_id


@pytest.mark.asyncio
async def test_irrigation_recommendation_pipeline(client: AsyncClient):
    """Verifies FAO-56 decision engine advisory generation and persistence."""
    # Register & Login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "irrigation_mgr@aquasense.org", "password": "MgrPassword123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "irrigation_mgr@aquasense.org", "password": "MgrPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Field (2 hectares)
    f_res = await client.post(
        "/api/v1/fields",
        json={
            "name": "Precision Irrigation Block A",
            "latitude": 15.8281,
            "longitude": 78.0373,
            "area_unit": "hectares",
            "area_value": 2.0,
            "irrigation_method": "drip",
            "application_efficiency": 0.90,
            "max_depth_per_event_mm": 30.0,
            "crop": {
                "crop_name": "groundnut",
                "growth_stage": "mid_season",
                "kc": 1.15,
                "root_depth_m": 0.60,
                "depletion_fraction_p": 0.50,
            },
            "soil": {
                "soil_texture": "clay_loam",
                "field_capacity_theta": 0.31,
                "wilting_point_theta": 0.15,
            },
        },
        headers=headers,
    )
    field_id = f_res.json()["id"]

    # 1. Trigger Recommendation under water deficit conditions
    # FC = 0.31, WP = 0.15 -> TAW = (0.31 - 0.15) * 600mm = 96mm. RAW = 48mm.
    # If soil moisture is 0.16 m3/m3, depletion = (0.31 - 0.16) * 600 = 90mm > RAW (48mm).
    # -> Decision must recommend irrigation!
    rec_res = await client.post(
        f"/api/v1/fields/{field_id}/irrigation/recommendations",
        json={
            "soil_moisture_m3m3": 0.16,
            "forecast_rainfall_next_24h_mm": 0.0,
            "forecast_rain_probability_pct": 5.0,
            "forecast_et0_next_24h_mm": 4.0,
        },
        headers=headers,
    )
    assert rec_res.status_code == 201
    rec = rec_res.json()
    rec_id = rec["recommendation_id"]

    assert rec["action"] == "IRRIGATE_RECOMMENDED"
    assert rec["net_irrigation_depth_mm"] > 0
    assert rec["gross_irrigation_depth_mm"] > rec["net_irrigation_depth_mm"]
    assert rec["water_volume_m3"] > 0
    assert rec["water_volume_liters"] == pytest.approx(rec["water_volume_m3"] * 1000.0, rel=1e-3)
    assert len(rec["explanations"]) > 0
    assert rec["baseline_comparison"] is not None

    # 2. Query History of recommendations for field
    history_res = await client.get(
        f"/api/v1/fields/{field_id}/irrigation/recommendations",
        headers=headers,
    )
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 1
    assert history[0]["id"] == rec_id

    # 3. Query Single Recommendation by ID
    single_res = await client.get(
        f"/api/v1/irrigation/recommendations/{rec_id}",
        headers=headers,
    )
    assert single_res.status_code == 200
    assert single_res.json()["id"] == rec_id

    # 4. Trigger Recommendation under Wet Conditions with Rainfall
    # Soil moisture = 0.30 m3/m3 (close to FC 0.31), 20mm forecast rain
    rec_wet = await client.post(
        f"/api/v1/fields/{field_id}/irrigation/recommendations",
        json={
            "soil_moisture_m3m3": 0.30,
            "forecast_rainfall_next_24h_mm": 20.0,
            "forecast_rain_probability_pct": 80.0,
            "forecast_et0_next_24h_mm": 3.0,
        },
        headers=headers,
    )
    assert rec_wet.status_code == 201
    rec_wet_data = rec_wet.json()
    assert rec_wet_data["action"] == "IRRIGATION_DEFERRED"
    assert rec_wet_data["net_irrigation_depth_mm"] is None or rec_wet_data["net_irrigation_depth_mm"] == 0.0
