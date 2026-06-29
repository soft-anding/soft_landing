"""Documents AI agent — answers questions about forms and documents needed for
moving. Fetches the user's profile and their city's full forms list from the
database on every request so the model always has up-to-date context (which
city they're moving to, which forms exist, which are already checked).
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI, OpenAIError

from ..auth import CurrentUser, get_current_user
from ..catalog_service import _fetch_user_profile, fetch_forms
from ..config import settings
from ..schemas import DocumentsAgentChatRequest, SaveConversationRequest
from ..supabase_client import get_supabase

router = APIRouter(prefix="/documents-agent", tags=["documents-agent"])

_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "documents_agent_prompt.txt"
_MAX_REPLY_TOKENS = 600

_CITY_LABELS = {"jerusalem": "ירושלים", "tel_aviv": "תל אביב"}

_LANGUAGE_RULE = (
    "שפת תשובה: ענה תמיד בעברית בלבד. "
    "החריג היחיד: אם המשתמש/ת מבקש/ת במפורש לקבל תשובה באנגלית, ענה באנגלית לאותה הודעה בלבד."
)


def _load_system_prompt() -> str:
    try:
        text = _PROMPT_PATH.read_text(encoding="utf-8").strip()
        print(f"[documents-agent] prompt loaded ({len(text)} chars)")
        return text
    except FileNotFoundError:
        print(f"[documents-agent] PROMPT FILE NOT FOUND at {_PROMPT_PATH}")
        return ""


def _profile_context(profile: dict) -> str:
    city_slug = profile.get("destination_city") or ""
    city_label = _CITY_LABELS.get(city_slug, city_slug or "לא הוגדרה")
    parts = [f"עיר יעד: {city_label}"]
    if profile.get("marital_status"):
        parts.append(f"מצב משפחתי: {profile['marital_status']}")
    if profile.get("occupation"):
        parts.append(f"עיסוק: {profile['occupation']}")
    return "פרטי המשתמש/ת:\n" + "\n".join(f"- {p}" for p in parts)


def _forms_context(forms: list[dict], active_category: str | None) -> str:
    if not forms:
        return "אין טפסים זמינים לעיר היעד של המשתמש/ת."

    by_cat: dict[str, list[dict]] = {}
    for f in forms:
        cat = f.get("category") or "כללי"
        by_cat.setdefault(cat, []).append(f)

    lines = ["כל הטפסים הזמינים לעיר היעד של המשתמש/ת:"]
    for cat, items in by_cat.items():
        marker = " ← קטגוריה פתוחה כרגע" if cat == active_category else ""
        lines.append(f"\nקטגוריה: {cat}{marker}")
        for f in items:
            status = " ✓ (טופל)" if f.get("checked") else ""
            notes = f" — {f['notes']}" if f.get("notes") else ""
            link = f"\n    [לטופס/להורדה]({f['file_url']})" if f.get("file_url") else ""
            lines.append(f"  - {f.get('name') or 'ללא שם'}{notes}{link}{status}")

    return "\n".join(lines)


def _create_stream(client: OpenAI, messages: list[dict]):
    kwargs = dict(model=settings.open_ai_model, messages=messages, max_tokens=_MAX_REPLY_TOKENS, stream=True)
    try:
        return client.chat.completions.create(**kwargs)
    except OpenAIError:
        kwargs["model"] = settings.open_ai_model_backup
        return client.chat.completions.create(**kwargs)


def _stream_reply(client: OpenAI, messages: list[dict]):
    try:
        for chunk in _create_stream(client, messages):
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except OpenAIError as exc:
        yield f"\n\n⚠️ שגיאה בפנייה לסוכן ה-AI: {exc}"


def _generate_conversation_name(client: OpenAI, messages: list) -> str:
    user_messages = [m for m in messages if m.role == "user"]
    if not user_messages:
        return f"שיחה {datetime.now(timezone.utc).strftime('%d/%m/%Y')}"
    snippet = "\n".join(f"{m.role}: {m.content}" for m in messages[:12])
    try:
        resp = client.chat.completions.create(
            model=settings.open_ai_model,
            messages=[
                {"role": "system", "content": "צור שם קצר (3-5 מילים בעברית) לשיחה הבאה עם עוזר המסמכים. החזר רק את השם, ללא פיסוק מיותר."},
                {"role": "user", "content": snippet},
            ],
            max_tokens=20,
        )
        content = resp.choices[0].message.content
        return content.strip() if content else f"שיחה {datetime.now(timezone.utc).strftime('%d/%m/%Y')}"
    except Exception:
        return f"שיחה {datetime.now(timezone.utc).strftime('%d/%m/%Y')}"


@router.post("/save-conversation")
def save_conversation(
    payload: SaveConversationRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    if not settings.documents_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המסמכים לא הוגדר.")
    client = OpenAI(api_key=settings.documents_agent_openai_api_key)
    name = _generate_conversation_name(client, payload.messages)
    conv_id = str(uuid.uuid4())
    messages_data = json.dumps(
        [{"role": m.role, "content": m.content} for m in payload.messages],
        ensure_ascii=False,
    )
    try:
        get_supabase().table("documents_agent_conversations").insert({
            "conversation_id": conv_id,
            "user_id": user.id,
            "conversation_name": name,
            "messages": messages_data,
            "status": "Completed",
            "message_count": len(payload.messages),
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"שגיאה בשמירת השיחה: {exc}") from exc
    return {"conversation_id": conv_id, "conversation_name": name}


@router.post("/chat")
def chat(
    payload: DocumentsAgentChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    if not settings.documents_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המסמכים לא הוגדר בשרת.")

    system_prompt = _load_system_prompt()

    # Profile must come first to get the user's city for the forms query.
    profile = _fetch_user_profile(user.id)
    city_slug = profile.get("destination_city") or None
    forms = fetch_forms(city_slug, user.id)

    context = "\n\n".join(p for p in [
        _LANGUAGE_RULE,
        system_prompt,
        _profile_context(profile),
        _forms_context(forms, payload.category),
    ] if p)

    messages: list[dict] = [{"role": "system", "content": context}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages]

    # Attach image to the last user message as a vision payload.
    if payload.image_base64:
        mime = payload.image_mime_type or "image/jpeg"
        for i in range(len(messages) - 1, -1, -1):
            if messages[i]["role"] == "user":
                messages[i] = {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": messages[i]["content"] or ""},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{payload.image_base64}"}},
                    ],
                }
                break

    client = OpenAI(api_key=settings.documents_agent_openai_api_key)
    return StreamingResponse(
        _stream_reply(client, messages), media_type="text/plain; charset=utf-8"
    )
