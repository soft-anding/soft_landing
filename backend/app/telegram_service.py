"""Mirrors in-app notifications to Telegram, and lets a linked user chat with
the task agent directly from Telegram (same engine as the in-app chat).

Uses a webhook (registered once at startup via register_webhook) rather than
polling, so Telegram only ever has one registered delivery target — it
refuses getUpdates from anywhere else while a webhook is active, which rules
out duplicate replies from a stray local server holding the same bot token.
Account linking: the user requests a short code (see routers/telegram.py),
opens a t.me deep-link with that code as the /start payload, and the webhook
resolves the resulting message into a telegram_chat_id on their profile.
"""
import html
import json
import logging
import os
import re
import secrets

import httpx

from .config import settings
from .routers import task_agent
from .supabase_client import get_supabase

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org"
_LINK_CONFIRMATION = "מחובר בהצלחה! מעכשיו תקבלו כאן גם את ההתראות מהמערכת, ותוכלו להתייעץ ולהיעזר בי בכל שלב במעבר דירה!"
_NOT_LINKED = "החשבון שלך עדיין לא מקושר. כדי לדבר איתי כאן, קשרו את הטלגרם דרך הפרופיל באפליקציה."
_AGENT_ERROR = "מצטערים, הייתה שגיאה בפנייה לסוכן. נסו שוב בעוד רגע."

# Telegram has no "end conversation" action like the in-app chat, so this is
# one continuous thread per user — trimmed to the last N messages (both
# before sending to the model and before persisting) to bound cost/context.
_MAX_HISTORY_MESSAGES = 30
_TELEGRAM_MESSAGE_LIMIT = 4096

_BOLD_RE = re.compile(r"\*\*(.+?)\*\*", re.DOTALL)

_bot_username_cache: str | None = None
# Generated fresh by register_webhook() on each startup and handed to Telegram
# as the webhook's secret_token — incoming requests must echo it back in the
# X-Telegram-Bot-Api-Secret-Token header, or they're rejected.
_webhook_secret: str | None = None


def _api_url(method: str) -> str:
    return f"{_API_BASE}/bot{settings.telegram_bot_token}/{method}"


def _to_telegram_html(text: str) -> str:
    """Escapes the agent's plain text for Telegram's HTML parse mode, then
    turns **bold** markdown into real <b> tags so it actually renders as
    bold instead of showing literal asterisks."""
    escaped = html.escape(text, quote=False)
    return _BOLD_RE.sub(r"<b>\1</b>", escaped)


def send_message(chat_id: str, text: str) -> None:
    formatted = _to_telegram_html(text)
    # Telegram rejects messages over 4096 chars — split defensively, even
    # though the agent's replies are capped well under this in practice.
    chunks = [
        formatted[i : i + _TELEGRAM_MESSAGE_LIMIT] for i in range(0, len(formatted), _TELEGRAM_MESSAGE_LIMIT)
    ] or [formatted]
    for chunk in chunks:
        try:
            httpx.post(
                _api_url("sendMessage"),
                json={"chat_id": chat_id, "text": chunk, "parse_mode": "HTML"},
                timeout=10,
            ).raise_for_status()
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


def register_webhook() -> None:
    """Tells Telegram to push updates to this deploy's /api/telegram/webhook
    instead of waiting to be polled. Safe to call on every startup — each
    call overwrites whatever URL/secret was registered before, so only the
    most-recently-started instance ever receives traffic."""
    global _webhook_secret
    domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
    if not domain:
        logger.warning("RAILWAY_PUBLIC_DOMAIN not set — skipping Telegram webhook registration")
        return
    secret = secrets.token_hex(32)
    url = f"https://{domain}/api/telegram/webhook"
    try:
        httpx.post(_api_url("setWebhook"), json={"url": url, "secret_token": secret}, timeout=10).raise_for_status()
    except httpx.HTTPError:
        logger.exception("Failed to register Telegram webhook")
        return
    _webhook_secret = secret


def verify_secret(token: str | None) -> bool:
    return _webhook_secret is not None and token == _webhook_secret


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
        # Boundary call (OpenAI + Supabase) inside the webhook request — must
        # never raise, or the user just sees the request silently fail.
        logger.exception("Task agent failed to reply to telegram chat_id=%s", chat_id)
        send_message(chat_id, _AGENT_ERROR)
        return

    reply = _unwrap_reply(raw_reply)
    send_message(chat_id, reply)
    history.append({"role": "assistant", "content": reply})
    _save_conversation(sb, user_id, history)


def handle_webhook_update(update: dict) -> None:
    """Process a single Telegram update pushed by the webhook: resolves
    /start <code> into an account link, and routes any other text message to
    the task agent for a linked user (or asks them to link their account
    first)."""
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    if not text:
        return
    chat_id = message["chat"]["id"]
    sb = get_supabase()
    if text.startswith("/start "):
        _handle_start(sb, text, chat_id)
        return
    _handle_agent_message(sb, chat_id, text)
