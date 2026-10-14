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
            _dev_tables_initialized = True

        async with dev_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
