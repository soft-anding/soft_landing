"""Mirrors in-app notifications to Telegram.

Uses polling (getUpdates) instead of a webhook so linking works the same in
local dev and in production without registering a public HTTPS callback URL.
Account linking: the user requests a short code (see routers/telegram.py),
opens a t.me deep-link with that code as the /start payload, and poll_updates
resolves the resulting message into a telegram_chat_id on their profile.
"""
import logging
import secrets

import httpx

from .config import settings
from .supabase_client import get_supabase

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org"
_LINK_CONFIRMATION = "מחובר בהצלחה! מעכשיו תקבלו כאן גם את ההתראות מהמערכת."

_last_update_id: int | None = None
_bot_username_cache: str | None = None


def _api_url(method: str) -> str:
    return f"{_API_BASE}/bot{settings.telegram_bot_token}/{method}"


def send_message(chat_id: str, text: str) -> None:
    try:
        httpx.post(_api_url("sendMessage"), json={"chat_id": chat_id, "text": text}, timeout=10).raise_for_status()
    except httpx.HTTPError:
        logger.exception("Failed to send Telegram message to chat_id=%s", chat_id)


def bot_username() -> str:
    global _bot_username_cache
    if _bot_username_cache is None:
        response = httpx.get(_api_url("getMe"), timeout=10)
        response.raise_for_status()
        _bot_username_cache = response.json()["result"]["username"]
    return _bot_username_cache


def generate_link_code(user_id: str) -> str:
    code = secrets.token_hex(4)
    get_supabase().table("user_profiles").update({"telegram_link_code": code}).eq("id", user_id).execute()
    return code


def poll_updates() -> None:
    """Fetch pending Telegram updates and resolve any /start <code> into a chat link."""
    global _last_update_id
    params = {"timeout": 0}
    if _last_update_id is not None:
        params["offset"] = _last_update_id + 1

    try:
        response = httpx.get(_api_url("getUpdates"), params=params, timeout=15)
        response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Failed to poll Telegram updates")
        return

    updates = response.json().get("result", [])
    if not updates:
        return

    sb = get_supabase()
    for update in updates:
        _last_update_id = update["update_id"]
        message = update.get("message") or {}
        text = message.get("text") or ""
        if not text.startswith("/start "):
            continue

        code = text.removeprefix("/start ").strip()
        chat_id = message["chat"]["id"]

        match = (
            sb.table("user_profiles")
            .select("id")
            .eq("telegram_link_code", code)
            .maybe_single()
            .execute()
            .data
        )
        if not match:
            continue

        sb.table("user_profiles").update(
            {"telegram_chat_id": str(chat_id), "telegram_link_code": None}
        ).eq("id", match["id"]).execute()
        send_message(chat_id, _LINK_CONFIRMATION)
