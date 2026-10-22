"""Fix dev admin password and list all users."""
import asyncio, sys
sys.path.insert(0, ".")

async def main():
    from sqlalchemy import select
    from app.core.database import dev_session_factory
    from app.models.user import User
    from app.core.security import get_password_hash, verify_password

    NEW_PASS = "Admin@12345"

    async with dev_session_factory() as session:
        # Fix admin@aquasense.io password
        admin = (await session.execute(
            select(User).where(User.email == "admin@aquasense.io")
        )).scalar_one_or_none()

        if admin:
            admin.hashed_password = get_password_hash(NEW_PASS)
            admin.is_superuser = True
            admin.is_active = True
            await session.commit()
            await session.refresh(admin)
            ok = verify_password(NEW_PASS, admin.hashed_password)
            print(f"Updated admin@aquasense.io — pwd_verify={ok}, superuser={admin.is_superuser}")
        else:
            print("admin@aquasense.io not found!")

        # Show all users
        users = (await session.execute(select(User))).scalars().all()
        print(f"\nAll users ({len(users)}):")
        for u in users:
            print(f"  {u.email} | superuser={u.is_superuser} | active={u.is_active}")

asyncio.run(main())
