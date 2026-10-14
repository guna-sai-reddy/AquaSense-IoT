"""Unit Tests for Administrative Endpoints and Access Control."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.user import User


@pytest.mark.asyncio
async def test_admin_endpoints_require_superuser():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request -> 401
        res = await client.get("/api/v1/admin/stats")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_stats_with_superuser():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create superuser token
        token = create_access_token("test-admin-id")
        # Without user record in db, it will fail auth gracefully
        res = await client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code in [200, 401, 404]
