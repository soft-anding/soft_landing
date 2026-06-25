"""Authentication: verify the Supabase access token on each request.

The frontend signs in with Supabase (Google OAuth) and sends the resulting
access token as `Authorization: Bearer <token>`. We verify it by asking
Supabase Auth directly (GET /auth/v1/user) rather than checking the JWT
signature locally, so no JWT secret needs to be configured here.
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import AuthApiError

from .supabase_client import get_supabase_anon

_bearer = HTTPBearer(auto_error=True)


@dataclass
class CurrentUser:
    id: str
    email: str | None


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    token = creds.credentials
    try:
        response = get_supabase_anon().auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc

    user = response.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    return CurrentUser(id=user.id, email=user.email)
