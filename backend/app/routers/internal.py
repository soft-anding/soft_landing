"""Internal/ops endpoints — not for end users, guarded by a shared secret
instead of a user JWT since they act across every user at once.
"""
from fastapi import APIRouter, Header, HTTPException, status

from .. import notification_service
from ..config import settings

router = APIRouter(prefix="/internal", tags=["internal"])


def _check_secret(x_internal_secret: str | None) -> None:
    if not settings.internal_job_secret or x_internal_secret != settings.internal_job_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden.")


@router.post("/notifications/run")
def run_notifications_job(x_internal_secret: str | None = Header(default=None)) -> dict:
    """Manually trigger the daily notifications scan — same logic the
    08:00 scheduler runs, useful for testing/demos without waiting for it."""
    _check_secret(x_internal_secret)
    inserted = notification_service.generate_daily_notifications()
    return {"inserted": inserted}
