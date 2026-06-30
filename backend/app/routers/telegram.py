"""Lets a logged-in user request a code to link their Telegram account, and
receives the webhook Telegram pushes updates to (see telegram_service.register_webhook)."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from .. import telegram_service
from ..auth import CurrentUser, get_current_user

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/link-code")
def create_link_code(user: CurrentUser = Depends(get_current_user)) -> dict:
    code = telegram_service.generate_link_code(user.id)
    return {"code": code, "deep_link": f"https://t.me/{telegram_service.bot_username()}?start={code}"}


@router.post("/webhook", include_in_schema=False)
async def webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    if not telegram_service.verify_secret(x_telegram_bot_api_secret_token):
        raise HTTPException(status_code=403, detail="invalid secret token")
    telegram_service.handle_webhook_update(await request.json())
    return {"ok": True}
