"""One-time script to seed a superuser admin account into the dev SQLite database."""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

# ── Credentials you can change ──────────────────────────────────────────────
ADMIN_EMAIL    = "admin@aquasense.io"
ADMIN_PASSWORD = "Admin@1234"
ADMIN_NAME     = "AquaSense Admin"
# ────────────────────────────────────────────────────────────────────────────

DEV_DB_FILE = Path(__file__).resolve().parent / "aquasense_dev.db"

engine = create_async_engine(
    f"sqlite+aiosqlite:///{DEV_DB_FILE.as_posix()}",
    echo=False,
    future=True,
)
SessionLocal = async_sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False, class_=AsyncSession)


async def seed():
    # Import models here so SQLAlchemy metadata is populated
    from app.models.user import User  # noqa: F401 – registers table in metadata
    from app.core.database import Base
    from app.core.security import get_password_hash

    # Create all tables (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == ADMIN_EMAIL))).scalar_one_or_none()
        if existing:
            print(f"[INFO] Admin user '{ADMIN_EMAIL}' already exists. No changes made.")
            return

        admin = User(
            id=str(uuid.uuid4()),
            email=ADMIN_EMAIL,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            full_name=ADMIN_NAME,
            is_active=True,
            is_superuser=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin)
        await db.commit()
        print("=" * 50)
        print("[OK] Admin user created successfully!")
        print(f"   Email   : {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
        print(f"   Role    : Superuser")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
