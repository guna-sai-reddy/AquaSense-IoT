"""FastAPI Authentication Endpoints: Registration, Login, and Profile."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.otp import PasswordResetOTP
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


class ResetPINRequest(BaseModel):
    email: EmailStr


class ResetPINResponse(BaseModel):
    success: bool
    email: str
    pin: str
    role: str
    message: str


class ResetPasswordWithPINRequest(BaseModel):
    email: EmailStr
    pin: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User Account",
)
async def register_user(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Registers a new user account with bcrypt password hashing."""
    normalized_email = user_in.email.strip().lower()
    stmt = select(User).where(User.email == normalized_email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address is already registered.",
        )

    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="Login & Obtain Access Token",
)
async def login(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticates user credentials and issues a signed JWT access token.
    Supports both OAuth2 form data (username, password) and JSON payloads (email, password).
    """
    content_type = request.headers.get("content-type", "")
    username = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            username = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email/username and password are required.",
        )

    # Normalize email consistently with registration and password-reset
    normalized_email = str(username).strip().lower()

    stmt = select(User).where(User.email == normalized_email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user is None or not verify_password(str(password), user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )

    token_str = create_access_token(subject=user.id)
    return Token(
        access_token=token_str,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current User Profile",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Returns the authenticated user's profile."""
    return current_user


@router.post(
    "/reset-pin",
    response_model=ResetPINResponse,
    summary="Generate In-App Security Verification PIN for Password Reset",
)
async def generate_reset_pin(
    payload: ResetPINRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generates an instant in-app 6-digit security verification PIN for user or admin."""
    email_clean = payload.email.strip().lower()
    stmt = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No registered account found with email '{email_clean}'.",
        )

    # Invalidate previous unused PINs for this email
    stmt_deactivate = (
        update(PasswordResetOTP)
        .where(PasswordResetOTP.email == email_clean, PasswordResetOTP.is_used == False)
        .values(is_used=True)
    )
    await db.execute(stmt_deactivate)

    # Generate 6-digit verification PIN
    pin_code = str(secrets.randbelow(900000) + 100000)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    otp_record = PasswordResetOTP(
        email=email_clean,
        otp_code=pin_code,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(otp_record)
    await db.commit()

    role_str = "Administrator" if user.is_superuser else "Farmer / Operator"
    return ResetPINResponse(
        success=True,
        email=user.email,
        pin=pin_code,
        role=role_str,
        message=f"Instant security verification PIN generated for {role_str} account.",
    )


@router.post(
    "/reset-password",
    summary="Reset User or Administrator Password Using Verification PIN",
)
async def reset_password_with_pin(
    payload: ResetPasswordWithPINRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Validates the in-app verification PIN and securely resets the password for user or admin."""
    email_clean = payload.email.strip().lower()
    now_utc = datetime.now(timezone.utc)

    # 1. Verify PIN
    stmt_otp = (
        select(PasswordResetOTP)
        .where(
            PasswordResetOTP.email == email_clean,
            PasswordResetOTP.otp_code == payload.pin.strip(),
            PasswordResetOTP.is_used == False,
            PasswordResetOTP.expires_at > now_utc,
        )
        .order_by(PasswordResetOTP.created_at.desc())
    )
    otp_entry = (await db.execute(stmt_otp)).scalars().first()

    if not otp_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired security PIN code. Please generate a fresh PIN.",
        )

    # 2. Find target user
    stmt_user = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt_user)).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target account not found.",
        )

    # 3. Update password and invalidate PIN
    user.hashed_password = get_password_hash(payload.new_password)
    otp_entry.is_used = True

    await db.commit()

    role_name = "Administrator" if user.is_superuser else "User"
    return {
        "success": True,
        "message": f"Password for {role_name} ({user.email}) has been successfully updated! You can now log into your account.",
        "role": role_name,
        "email": user.email,
    }

