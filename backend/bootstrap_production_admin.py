"""AquaSense-IoT Production Admin Bootstrap Script.

PURPOSE
-------
Safely creates an administrator account in the PRODUCTION Neon PostgreSQL database
(or any configured PostgreSQL database). This script is designed to be run ONCE,
manually, by a developer who has access to the production DATABASE_URL.

SAFETY GUARANTEES
-----------------
1. Refuses to run unless --confirm-production-admin-bootstrap is supplied.
2. Requires admin email via AQUASENSE_ADMIN_EMAIL environment variable.
3. Requires admin password via AQUASENSE_ADMIN_PASSWORD environment variable
   OR prompts securely (hidden input) if not set.
4. Verifies that the configured DATABASE_URL points to PostgreSQL before touching anything.
5. Checks if the email already exists — never overwrites silently.
6. Uses existing Alembic migrations (does NOT call create_all()).
7. Uses a transaction — rolls back cleanly on error.
8. Never prints the password, hash, or any secret.
9. Is idempotent — safe to run multiple times.

USAGE
-----
From the backend/ directory (with .venv activated):

    # Set env vars (PowerShell):
    $env:DATABASE_URL = "postgresql+asyncpg://user:pass@host/db"
    $env:AQUASENSE_ADMIN_EMAIL = "admin@yourdomain.com"
    $env:AQUASENSE_ADMIN_PASSWORD = "YourSecurePassword123!"

    # Run with explicit confirmation flag:
    python bootstrap_production_admin.py --confirm-production-admin-bootstrap

    # Or omit AQUASENSE_ADMIN_PASSWORD for a secure interactive prompt:
    python bootstrap_production_admin.py --confirm-production-admin-bootstrap

DO NOT run this automatically at startup or in CI/CD pipelines.
DO NOT commit this script with credentials in it.
DO NOT delete or truncate the production database.
"""

from __future__ import annotations

import asyncio
import getpass
import os
import sys
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# 1. Guard: explicit confirmation flag required
# ---------------------------------------------------------------------------
CONFIRM_FLAG = "--confirm-production-admin-bootstrap"
if CONFIRM_FLAG not in sys.argv:
    print("=" * 70)
    print("ABORTED: This script requires an explicit confirmation flag.")
    print(f"  Usage: python {sys.argv[0]} {CONFIRM_FLAG}")
    print()
    print("Read the module docstring carefully before proceeding.")
    print("=" * 70)
    sys.exit(1)

# ---------------------------------------------------------------------------
# 2. Import app modules (must be done after path check)
# ---------------------------------------------------------------------------
from pathlib import Path

# Ensure the backend root is on sys.path so `app.*` imports work
backend_root = Path(__file__).resolve().parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User


# ---------------------------------------------------------------------------
# 3. Resolve credentials from environment (never hardcoded)
# ---------------------------------------------------------------------------
def _get_credentials() -> tuple[str, str]:
    """Return (admin_email, admin_password) from environment or secure prompt."""
    email = os.environ.get("AQUASENSE_ADMIN_EMAIL", "").strip().lower()
    if not email:
        print("ERROR: Set the AQUASENSE_ADMIN_EMAIL environment variable before running.")
        sys.exit(1)

    password = os.environ.get("AQUASENSE_ADMIN_PASSWORD", "")
    if not password:
        print(f"No AQUASENSE_ADMIN_PASSWORD env var found. Enter password for {email}:")
        password = getpass.getpass(prompt="  Password (hidden): ")
        if not password:
            print("ERROR: Password cannot be empty.")
            sys.exit(1)
        confirm = getpass.getpass(prompt="  Confirm password (hidden): ")
        if password != confirm:
            print("ERROR: Passwords do not match.")
            sys.exit(1)

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters long.")
        sys.exit(1)

    return email, password


# ---------------------------------------------------------------------------
# 4. Verify the configured database is PostgreSQL
# ---------------------------------------------------------------------------
def _verify_postgres_url(db_url: str) -> None:
    """Refuse to proceed if the URL does not look like PostgreSQL."""
    url_lower = db_url.lower()
    if not (url_lower.startswith("postgresql") or url_lower.startswith("postgres")):
        print("=" * 70)
        print("ABORTED: DATABASE_URL does not appear to point to a PostgreSQL database.")
        print(f"  Detected URL prefix: {db_url[:40]}...")
        print("  This script must only target PostgreSQL (Neon, Render, etc.).")
        print("=" * 70)
        sys.exit(1)


# ---------------------------------------------------------------------------
# 5. Main async bootstrap logic
# ---------------------------------------------------------------------------
async def bootstrap() -> None:
    """Core bootstrap: check, then create admin if absent."""
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    db_url = settings.DATABASE_URL

    # Safety: must be PostgreSQL
    _verify_postgres_url(db_url)

    print()
    print("=" * 70)
    print("AquaSense-IoT Production Admin Bootstrap")
    print("=" * 70)
    print(f"  DATABASE_URL scheme : {db_url.split('://')[0]}")
    print(f"  Target host         : {db_url.split('@')[-1].split('/')[0] if '@' in db_url else 'unknown'}")
    print()

    # Resolve credentials
    admin_email, admin_password = _get_credentials()
    print(f"  Admin email         : {admin_email}")
    print()

    # Connect
    engine = create_async_engine(db_url, echo=False, future=True)
    SessionLocal = async_sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )

    try:
        async with SessionLocal() as session:
            async with session.begin():
                # Verify connectivity
                try:
                    await session.execute(text("SELECT 1"))
                except Exception as conn_err:
                    print(f"ERROR: Cannot connect to the database: {conn_err}")
                    sys.exit(1)

                # NOTE: We do NOT call Base.metadata.create_all() here.
                # Schema must already exist via `alembic upgrade head` run separately.
                # Check that the users table exists by querying it.
                try:
                    await session.execute(text("SELECT 1 FROM users LIMIT 1"))
                except Exception:
                    print("ERROR: The 'users' table does not exist.")
                    print("       Run `alembic upgrade head` against production first.")
                    sys.exit(1)

                # Check for existing user
                stmt = select(User).where(User.email == admin_email)
                existing = (await session.execute(stmt)).scalar_one_or_none()

                if existing:
                    print(f"INFO: An account with email '{admin_email}' already exists.")
                    print(f"      is_active={existing.is_active}, is_superuser={existing.is_superuser}")
                    print()
                    if existing.is_superuser and existing.is_active:
                        print("  The account already has active superuser privileges.")
                        print("  If you cannot log in, use the password-reset flow:")
                        print("    POST /api/v1/auth/reset-pin  { email: ... }")
                        print("    POST /api/v1/auth/reset-password  { email, pin, new_password }")
                        print()
                        print("  No changes were made to the database.")
                    else:
                        print("  WARNING: The account exists but may be inactive or lack superuser rights.")
                        print("  To promote it, run a targeted SQL command via your DB console:")
                        print(f"    UPDATE users SET is_superuser=true, is_active=true")
                        print(f"    WHERE email='{admin_email}';")
                        print()
                        print("  No automated changes were made. This avoids unexpected privilege escalation.")
                    return  # Do not commit anything

                # Create new superuser
                new_admin = User(
                    id=str(uuid.uuid4()),
                    email=admin_email,
                    hashed_password=get_password_hash(admin_password),
                    full_name="AquaSense Administrator",
                    is_active=True,
                    is_superuser=True,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(new_admin)
                # Transaction commits on context-manager exit

        print("[OK] Administrator account created successfully.")
        print(f"     Email     : {admin_email}")
        print(f"     Superuser : True")
        print(f"     Active    : True")
        print()
        print("  You can now log in at:")
        print("    https://aqua-sense-io-t.vercel.app/login")
        print("    (or http://localhost:3000/login for local)")
        print()
        print("  REMINDER: Delete AQUASENSE_ADMIN_PASSWORD from your shell history")
        print("  and remove it from the Render environment after first login.")
        print("=" * 70)

    finally:
        await engine.dispose()


# ---------------------------------------------------------------------------
# 6. Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    asyncio.run(bootstrap())
