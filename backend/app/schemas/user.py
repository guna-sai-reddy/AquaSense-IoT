"""Pydantic Schemas for User Authentication and Profiles."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Payload to register a new user account."""

    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=8, max_length=128, description="Plaintext password (min 8 characters)")
    full_name: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    """Payload to authenticate an existing user."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Sanitized user representation (NEVER returns password hash)."""

    id: str
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """OAuth2 JWT access token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class TokenData(BaseModel):
    """Internal decoded token payload."""

    user_id: Optional[str] = None

