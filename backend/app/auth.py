"""Authentication: verify the Supabase access token (JWT) on each request.

The frontend signs in with Supabase (Google OAuth) and sends the resulting
access token as `Authorization: Bearer <token>`. Supabase signs these tokens
with the project's JWT secret (HS256), so we can verify them locally without a
network round-trip.
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_bearer = HTTPBearer(auto_error=True)


@dataclass
class CurrentUser:
    id: str
    email: str | None


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server missing SUPABASE_JWT_SECRET.",
        )
    token = creds.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no subject (sub).",
        )
    return CurrentUser(id=user_id, email=payload.get("email"))
