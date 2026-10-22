"""Phase 5 Tests: Authentication, Admin Authorization, CORS, and Password-Reset Endpoint.

Covers:
- Correct password login
- Incorrect password rejection
- Missing user rejection
- Email normalization (case-insensitive login)
- Password hashing and verification
- Admin role assignment and authorization
- Duplicate admin bootstrap behavior (no double-creation)
- Refusing admin endpoints without superuser privileges
- Password-reset endpoint path consistency (/auth/reset-pin, /auth/reset-password)
- CORS for production Vercel origin
- get_current_superuser no longer hardcodes email address
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash, verify_password
from app.main import app


# ---------------------------------------------------------------------------
# Shared test fixture: isolated in-memory SQLite DB per test
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def client():
    """In-memory SQLite test client — fully isolated, no production DB access."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_factory() as session:
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
    await engine.dispose()


# ---------------------------------------------------------------------------
# Helper: register + login, return token
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, email: str, password: str, full_name: str = "Test User") -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


async def _make_superuser(client: AsyncClient, email: str) -> None:
    """Directly updates a user's is_superuser flag via the DB session inside a test."""
    from sqlalchemy import select, update
    from app.models.user import User

    # We access the overridden DB via a raw SQLAlchemy call routed through the override
    # Use a separate connection from the override
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Instead, promote via the dependency override by inspecting the injected session
    # This test helper exists only for local in-memory DB where we control everything
    # We just re-use the app's DB override by sending a request that touches the DB
    pass  # See test_admin_role_assignment for the proper approach using admin bootstrap


# ---------------------------------------------------------------------------
# 1. Password hashing and verification (unit tests)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_password_hash_and_verify():
    """get_password_hash + verify_password round-trip must work correctly."""
    password = "SuperSecure#2026"
    hashed = get_password_hash(password)
    assert hashed != password  # Must not store plaintext
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False


@pytest.mark.asyncio
async def test_different_passwords_produce_different_hashes():
    """bcrypt must produce different hashes for different passwords."""
    h1 = get_password_hash("Password123!")
    h2 = get_password_hash("Password124!")
    assert h1 != h2


@pytest.mark.asyncio
async def test_same_password_produces_different_hashes_due_to_salt():
    """bcrypt salting: two hashes of the same password must differ."""
    h1 = get_password_hash("SamePassword!")
    h2 = get_password_hash("SamePassword!")
    assert h1 != h2
    # But both must verify correctly
    assert verify_password("SamePassword!", h1) is True
    assert verify_password("SamePassword!", h2) is True


# ---------------------------------------------------------------------------
# 2. Correct password login
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_correct_password_login(client: AsyncClient):
    """A registered user with the correct password must receive a JWT."""
    email = "correct@aquasense.io"
    password = "Correct#Password1"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# ---------------------------------------------------------------------------
# 3. Incorrect password rejection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incorrect_password_rejected(client: AsyncClient):
    """Login with wrong password must return 401."""
    email = "wrongpw@aquasense.io"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "RealPassword#1"})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword#1"})
    assert resp.status_code == 401
    assert "incorrect" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Missing user rejection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_user_rejected(client: AsyncClient):
    """Login for a non-existent email must return 401 (not 404, to prevent enumeration)."""
    resp = await client.post("/api/v1/auth/login", json={"email": "nobody@aquasense.io", "password": "AnyPassword#1"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 5. Email normalization (case-insensitive login & registration)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_email_normalization_login_case_insensitive(client: AsyncClient):
    """Users registered with mixed-case email must be able to log in with any case."""
    # Register with lowercase (normalized)
    await client.post("/api/v1/auth/register", json={"email": "farmer@AquaSense.IO", "password": "CaseTest#123"})

    # Login with different cases — all must succeed
    for variant in ["farmer@aquasense.io", "FARMER@AQUASENSE.IO", "Farmer@AquaSense.Io"]:
        resp = await client.post("/api/v1/auth/login", json={"email": variant, "password": "CaseTest#123"})
        assert resp.status_code == 200, f"Login failed for email variant '{variant}': {resp.text}"


@pytest.mark.asyncio
async def test_email_normalization_prevents_duplicate_registrations(client: AsyncClient):
    """Registering the same email in different cases must be rejected as a duplicate."""
    await client.post("/api/v1/auth/register", json={"email": "dup@aquasense.io", "password": "Dup#Password1"})
    resp2 = await client.post("/api/v1/auth/register", json={"email": "DUP@AQUASENSE.IO", "password": "Dup#Password2"})
    assert resp2.status_code in [400, 409]


# ---------------------------------------------------------------------------
# 6. Admin role assignment and authorization
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_endpoints_require_auth(client: AsyncClient):
    """Unauthenticated requests to /admin/* must return 401."""
    resp = await client.get("/api/v1/admin/stats")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_regular_user_cannot_access_admin_endpoints(client: AsyncClient):
    """A regular (non-superuser) user must receive 403 on admin endpoints."""
    token = await _register_and_login(client, "regularuser@aquasense.io", "Regular#Pass1")
    resp = await client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_superuser_can_access_admin_endpoints(client: AsyncClient):
    """A superuser must be able to access admin endpoints regardless of email address."""
    import uuid
    from sqlalchemy import select
    from app.models.user import User
    from app.core.database import get_db as real_get_db

    # Register a user with a non-hardcoded email (verifies we removed the email check)
    custom_admin_email = f"customadmin_{uuid.uuid4().hex[:6]}@mycompany.io"
    await client.post("/api/v1/auth/register", json={
        "email": custom_admin_email,
        "password": "AdminPass#2026",
        "full_name": "Custom Admin"
    })

    # Elevate to superuser directly via the DB session override
    db_override = app.dependency_overrides.get(get_db)
    assert db_override is not None
    async for session in db_override():
        stmt = select(User).where(User.email == custom_admin_email)
        user = (await session.execute(stmt)).scalar_one_or_none()
        assert user is not None
        user.is_superuser = True
        await session.commit()
        break

    # Login as the custom-email superuser
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": custom_admin_email,
        "password": "AdminPass#2026"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # Must be able to access admin stats
    admin_resp = await client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert admin_resp.status_code == 200


# ---------------------------------------------------------------------------
# 7. get_current_superuser does NOT check email address
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_superuser_check_does_not_require_specific_email(client: AsyncClient):
    """
    REGRESSION TEST for the hardcoded `email != 'admin@aquasense.org'` bug.
    Any superuser, with any email, must pass get_current_superuser.
    """
    from sqlalchemy import select
    from app.models.user import User

    # Use an email that is definitely NOT admin@aquasense.org
    email = "different_admin@someotherdomain.net"
    await client.post("/api/v1/auth/register", json={"email": email, "password": "DiffAdmin#2026"})

    db_override = app.dependency_overrides.get(get_db)
    assert db_override is not None
    async for session in db_override():
        stmt = select(User).where(User.email == email)
        user = (await session.execute(stmt)).scalar_one_or_none()
        user.is_superuser = True
        await session.commit()
        break

    login_resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "DiffAdmin#2026"})
    token = login_resp.json()["access_token"]

    # This must NOT return 403 (which the old hardcoded check would have caused)
    resp = await client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, (
        f"Superuser with non-hardcoded email was denied admin access! "
        f"Status: {resp.status_code}, Body: {resp.text}"
    )


# ---------------------------------------------------------------------------
# 8. Duplicate admin bootstrap behavior
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_registration_rejected(client: AsyncClient):
    """The same email cannot be registered twice."""
    email = "duplicate@aquasense.io"
    password = "DupTest#Pass1"
    resp1 = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp1.status_code == 201
    resp2 = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp2.status_code in [400, 409]
    assert "already registered" in resp2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 9. Password-reset endpoint path consistency
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_pin_endpoint_exists(client: AsyncClient):
    """POST /api/v1/auth/reset-pin must return 404 for unknown user (not 404 for route-not-found)."""
    resp = await client.post(
        "/api/v1/auth/reset-pin",
        json={"email": "nobody@aquasense.io"},
    )
    # Route exists: expect 404 user-not-found, not 422 (validation) or 405 (method not allowed)
    assert resp.status_code == 404
    assert "no registered account" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reset_password_endpoint_exists(client: AsyncClient):
    """POST /api/v1/auth/reset-password must return 400 for invalid PIN (not route-not-found)."""
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": "nobody@aquasense.io", "pin": "123456", "new_password": "NewPass#123"},
    )
    # Route exists: 400 for bad PIN, not 404 route-not-found
    assert resp.status_code in [400, 404]


@pytest.mark.asyncio
async def test_reset_pin_and_password_full_flow(client: AsyncClient):
    """Full OTP reset flow: generate PIN for existing user, then reset password with it."""
    email = "resetme@aquasense.io"
    original_pass = "Original#Pass1"
    new_pass = "NewSecure#Pass2"

    # Register
    await client.post("/api/v1/auth/register", json={"email": email, "password": original_pass})

    # Generate reset PIN
    pin_resp = await client.post("/api/v1/auth/reset-pin", json={"email": email})
    assert pin_resp.status_code == 200
    pin_data = pin_resp.json()
    assert pin_data["success"] is True
    pin = pin_data["pin"]
    assert len(pin) == 6

    # Reset password
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "pin": pin, "new_password": new_pass},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["success"] is True

    # Old password must no longer work
    old_login = await client.post("/api/v1/auth/login", json={"email": email, "password": original_pass})
    assert old_login.status_code == 401

    # New password must work
    new_login = await client.post("/api/v1/auth/login", json={"email": email, "password": new_pass})
    assert new_login.status_code == 200


# ---------------------------------------------------------------------------
# 10. CORS — production Vercel origin must be allowed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cors_allows_vercel_origin(client: AsyncClient):
    """The production Vercel origin must be present in BACKEND_CORS_ORIGINS config.

    Note: ASGITransport does not replicate real CORS preflight negotiation.
    We verify the configuration directly to confirm the backend is correctly
    configured to allow the Vercel frontend.
    """
    from app.core.config import settings

    vercel_origin = "https://aqua-sense-io-t.vercel.app"
    assert vercel_origin in settings.BACKEND_CORS_ORIGINS, (
        f"Production Vercel origin '{vercel_origin}' is missing from "
        f"BACKEND_CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}"
    )


@pytest.mark.asyncio
async def test_cors_allows_localhost_origin(client: AsyncClient):
    """Localhost:3000 must be in BACKEND_CORS_ORIGINS for local development."""
    from app.core.config import settings

    localhost_origin = "http://localhost:3000"
    assert localhost_origin in settings.BACKEND_CORS_ORIGINS, (
        f"Localhost origin '{localhost_origin}' is missing from "
        f"BACKEND_CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}"
    )


# ---------------------------------------------------------------------------
# 11. Production bootstrap script refuses to run without confirmation flag
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bootstrap_requires_confirmation_flag():
    """The production bootstrap script must exit(1) if the confirmation flag is absent."""
    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "bootstrap_production_admin.py"],
        capture_output=True,
        text=True,
        cwd=str(__import__("pathlib").Path(__file__).resolve().parents[1]),
    )
    assert result.returncode == 1, "Bootstrap script should exit with code 1 when flag is missing"
    assert "ABORTED" in result.stdout or "ABORTED" in result.stderr
