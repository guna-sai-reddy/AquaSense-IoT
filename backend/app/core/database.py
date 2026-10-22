"""Database Connection and Session Management using SQLAlchemy AsyncPG with Development Resilience."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncGenerator, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# Primary Async SQLAlchemy Engine for PostgreSQL via AsyncPG
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

# Primary Async Session Factory for PostgreSQL
async_session_factory = async_sessionmaker(
    bind=async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)

# Development Fallback Engine (SQLite) when host PostgreSQL service is stopped
DEV_DB_FILE = Path(__file__).resolve().parents[2] / "aquasense_dev.db"
dev_engine = create_async_engine(
    f"sqlite+aiosqlite:///{DEV_DB_FILE.as_posix()}",
    echo=False,
    future=True,
)

dev_session_factory = async_sessionmaker(
    bind=dev_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)

_dev_tables_initialized = False


async def check_database_connection() -> Tuple[bool, str]:
    """Dynamically tests PostgreSQL connectivity without raising unhandled errors."""
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1;"))
            row = result.scalar()
            if row == 1:
                return True, "PostgreSQL database connection is healthy."
            return False, f"Unexpected query result from database: {row}"
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"PostgreSQL connectivity test failed: {error_msg}")
        return False, error_msg


async def _seed_dev_admin(session: AsyncSession) -> None:
    """Inserts a default development admin into SQLite if no users exist.

    This runs ONLY when the SQLite fallback is active (PostgreSQL is offline).
    It does NOT touch the production Neon PostgreSQL database.
    """
    try:
        from sqlalchemy import select
        from app.models.user import User
        from app.core.security import get_password_hash

        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none() is None:
            admin = User(
                email="admin@aquasense.io",
                hashed_password=get_password_hash("Admin@12345"),
                full_name="AquaSense Administrator",
                is_active=True,
                is_superuser=True,
            )
            session.add(admin)
            await session.commit()
            logger.info(
                "Dev SQLite admin seeded: admin@aquasense.io (password: Admin@12345) — "
                "local development only, not production."
            )
    except Exception as exc:
        logger.warning(f"Dev admin seeding skipped: {exc}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session per request.

    Prefers production PostgreSQL. If PostgreSQL is stopped/unreachable,
    transparently falls back to persistent local SQLite for development.
    """
    global _dev_tables_initialized

    is_pg_connected, _ = await check_database_connection()

    if is_pg_connected:
        async with async_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    else:
        logger.info(
            "Host PostgreSQL is offline. Using local development SQLite persistence (aquasense_dev.db)."
        )
        if not _dev_tables_initialized:
            async with dev_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            # Seed default dev admin on first initialization
            async with dev_session_factory() as seed_session:
                await _seed_dev_admin(seed_session)
            _dev_tables_initialized = True

        async with dev_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

