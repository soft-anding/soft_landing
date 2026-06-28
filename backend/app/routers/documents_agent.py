"""Documents AI agent — a chat endpoint that helps users understand and fill
out forms and documents relevant to their move. Receives the current category
and its form list as context so the agent can answer category-specific questions.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI, OpenAIError

from ..auth import CurrentUser, get_current_user
from ..config import settings
from ..schemas import DocumentsAgentChatRequest

router = APIRouter(prefix="/documents-agent", tags=["documents-agent"])

_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "documents_agent_prompt.txt"

_MAX_REPLY_TOKENS = 600


def _load_system_prompt() -> str:
    try:
        text = _PROMPT_PATH.read_text(encoding="utf-8").strip()
        print(f"[documents-agent] prompt loaded from {_PROMPT_PATH} ({len(text)} chars)")
        return text
    except FileNotFoundError:
        print(f"[documents-agent] PROMPT FILE NOT FOUND at {_PROMPT_PATH}")
        return ""


def _forms_context(category: str | None, forms: list[str]) -> str:
    if not category:
        return ""
    if not forms:
        return f"הקטגוריה הנוכחית: {category}. אין טפסים ברשימה."
    items = "\n".join(f"- {f}" for f in forms if f)
    return f"הקטגוריה הנוכחית: {category}\nהטפסים בקטגוריה זו:\n{items}"


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


@router.post("/chat")
def chat(
    payload: DocumentsAgentChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    if not settings.documents_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המסמכים לא הוגדר בשרת.")

    system_prompt = _load_system_prompt()
    forms_ctx = _forms_context(payload.category, payload.forms)
    context = "\n\n".join(p for p in [system_prompt, forms_ctx] if p)

    messages: list[dict] = [{"role": "system", "content": context}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages]

    client = OpenAI(api_key=settings.documents_agent_openai_api_key)
    return StreamingResponse(
        _stream_reply(client, messages), media_type="text/plain; charset=utf-8"
    )
