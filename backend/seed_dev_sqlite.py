"""Direct seed and verify script for dev SQLite database."""
import asyncio
import sys
sys.path.insert(0, ".")

async def main():
    from app.core.database import dev_engine, dev_session_factory, Base
    from app.models import user  # ensure model registered
    from app.models import field, observation, prediction, recommendation, event, otp, broadcast
    
    # Create tables
    async with dev_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created")
    
    # Seed admin
    from sqlalchemy import select
    from app.models.user import User
    from app.core.security import get_password_hash, verify_password
    
    async with dev_session_factory() as session:
        existing = (await session.execute(select(User).where(User.email == "admin@aquasense.io"))).scalar_one_or_none()
        if existing:
            print(f"Admin already exists: {existing.email}, superuser={existing.is_superuser}")
        else:
            pwd = "Admin@12345"
            hashed = get_password_hash(pwd)
            admin = User(
                email="admin@aquasense.io",
                hashed_password=hashed,
                full_name="AquaSense Administrator",
                is_active=True,
                is_superuser=True,
            )
            session.add(admin)
            await session.commit()
            print(f"Admin seeded: admin@aquasense.io")
        
        # Verify password
        all_users = (await session.execute(select(User))).scalars().all()
        print(f"Total users: {len(all_users)}")
        for u in all_users:
            ok = verify_password("Admin@12345", u.hashed_password)
            print(f"  {u.email} | superuser={u.is_superuser} | active={u.is_active} | pwd_verify={ok}")

asyncio.run(main())
