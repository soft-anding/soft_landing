"""Lets a logged-in user request a code to link their Telegram account."""
from fastapi import APIRouter, Depends

from .. import telegram_service
from ..auth import CurrentUser, get_current_user

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/link-code")
def create_link_code(user: CurrentUser = Depends(get_current_user)) -> dict:
    code = telegram_service.generate_link_code(user.id)
    return {"code": code, "deep_link": f"https://t.me/{telegram_service.bot_username()}?start={code}"}
