"""Mirrors in-app notifications to Telegram, and lets a linked user chat with
the task agent directly from Telegram (same engine as the in-app chat).

Uses polling (getUpdates) instead of a webhook so linking works the same in
local dev and in production without registering a public HTTPS callback URL.
Account linking: the user requests a short code (see routers/telegram.py),
opens a t.me deep-link with that code as the /start payload, and poll_updates
resolves the resulting message into a telegram_chat_id on their profile.
"""
import json
import logging
import re
import secrets

import httpx

from .config import settings
from .routers import task_agent
from .supabase_client import get_supabase

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org"
_LINK_CONFIRMATION = "מחובר בהצלחה! מעכשיו תקבלו כאן גם את ההתראות מהמערכת."
_NOT_LINKED = "החשבון שלך עדיין לא מקושר. כדי לדבר איתי כאן, קשרו את הטלגרם דרך הפרופיל באפליקציה."
_AGENT_ERROR = "מצטערים, הייתה שגיאה בפנייה לסוכן. נסו שוב בעוד רגע."

# Telegram has no "end conversation" action like the in-app chat, so this is
# one continuous thread per user — trimmed to the last N messages (both
# before sending to the model and before persisting) to bound cost/context.
_MAX_HISTORY_MESSAGES = 30
_TELEGRAM_MESSAGE_LIMIT = 4096

_SUGGEST_DAILY_RE = re.compile(r"\[SUGGEST_DAILY:(\{.*?\})\]", re.DOTALL)

_last_update_id: int | None = None
_bot_username_cache: str | None = None


def _api_url(method: str) -> str:
    return f"{_API_BASE}/bot{settings.telegram_bot_token}/{method}"


def send_message(chat_id: str, text: str) -> None:
    # Telegram rejects messages over 4096 chars — split defensively, even
    # though the agent's replies are capped well under this in practice.
    chunks = [text[i : i + _TELEGRAM_MESSAGE_LIMIT] for i in range(0, len(text), _TELEGRAM_MESSAGE_LIMIT)] or [text]
    for chunk in chunks:
        try:
            httpx.post(_api_url("sendMessage"), json={"chat_id": chat_id, "text": chunk}, timeout=10).raise_for_status()
        except httpx.HTTPError:
            logger.exception("Failed to send Telegram message to chat_id=%s", chat_id)


def _send_typing(chat_id: str) -> None:
    try:
        httpx.post(_api_url("sendChatAction"), json={"chat_id": chat_id, "action": "typing"}, timeout=10).raise_for_status()
    except httpx.HTTPError:
        logger.exception("Failed to send typing indicator to chat_id=%s", chat_id)


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


# ── Agent reply cleanup — Python port of the frontend's unwrapReply /
# parseSuggestion (TaskAgentChat.jsx), since Telegram is its own "client"
# that has to do the same cleanup the React app does before displaying text.
def _unwrap_reply(text: str) -> str:
    if not text or not text.lstrip().startswith("{"):
        return text
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and isinstance(parsed.get("reply"), str):
            return parsed["reply"]
    except (json.JSONDecodeError, ValueError):
        pass
    prefix = '{"reply":"'
    if text.startswith(prefix):
        inner = text[len(prefix):]
        if inner.endswith('"}'):
            inner = inner[:-2]
        elif inner.endswith('"'):
            inner = inner[:-1]
        return inner.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
    return text


def _strip_daily_suggestion(text: str) -> str:
    """Drops the [SUGGEST_DAILY:{...}] marker the agent appends when it wants
    to offer pinning tasks to the daily board — the in-app chat turns that
    into a clickable confirm/decline button, which Telegram doesn't have
    (v1), so the marker is just removed rather than acted on."""
    match = _SUGGEST_DAILY_RE.search(text)
    if not match:
        return text
    try:
        json.loads(match.group(1))
    except json.JSONDecodeError:
        return text
    return (text[: match.start()] + text[match.end():]).rstrip()


def _load_conversation(sb, user_id: str) -> list[dict]:
    # maybe_single().execute() returns None itself (not a response with
    # data=None) when zero rows match — guard both, not just .data.
    result = (
        sb.table("telegram_agent_conversations")
        .select("messages")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        return []
    messages = result.data["messages"]
    return json.loads(messages) if isinstance(messages, str) else messages


def _save_conversation(sb, user_id: str, messages: list[dict]) -> None:
    sb.table("telegram_agent_conversations").upsert(
        {"user_id": user_id, "messages": messages[-_MAX_HISTORY_MESSAGES:]}, on_conflict="user_id"
    ).execute()


def _handle_start(sb, text: str, chat_id) -> None:
    code = text.removeprefix("/start ").strip()
    result = (
        sb.table("user_profiles")
        .select("id")
        .eq("telegram_link_code", code)
        .maybe_single()
        .execute()
    )
    match = result.data if result else None
    if not match:
        return
    sb.table("user_profiles").update(
        {"telegram_chat_id": str(chat_id), "telegram_link_code": None}
    ).eq("id", match["id"]).execute()
    send_message(chat_id, _LINK_CONFIRMATION)


def _handle_agent_message(sb, chat_id, text: str) -> None:
    result = (
        sb.table("user_profiles")
        .select("id")
        .eq("telegram_chat_id", str(chat_id))
        .maybe_single()
        .execute()
    )
    profile = result.data if result else None
    if not profile:
        send_message(chat_id, _NOT_LINKED)
        return

    user_id = profile["id"]
    _send_typing(chat_id)
    history = _load_conversation(sb, user_id)
    history.append({"role": "user", "content": text})
    try:
        raw_reply = task_agent.get_agent_reply(user_id, history[-_MAX_HISTORY_MESSAGES:])
    except Exception:
        # Boundary call (OpenAI + Supabase) inside a scheduled job — must
        # never raise, or it takes the whole poll loop down with it.
        logger.exception("Task agent failed to reply to telegram chat_id=%s", chat_id)
        send_message(chat_id, _AGENT_ERROR)
        return

    reply = _strip_daily_suggestion(_unwrap_reply(raw_reply))
    send_message(chat_id, reply)
    history.append({"role": "assistant", "content": reply})
    _save_conversation(sb, user_id, history)


def poll_updates() -> None:
    """Fetch pending Telegram updates: resolves /start <code> into an account
    link, and routes any other text message to the task agent for a linked
    user (or asks them to link their account first)."""
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
        text = (message.get("text") or "").strip()
        if not text:
            continue
        chat_id = message["chat"]["id"]
        if text.startswith("/start "):
            _handle_start(sb, text, chat_id)
            continue
        _handle_agent_message(sb, chat_id, text)
