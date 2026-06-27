"""Tasks AI agent — a chat endpoint that helps the user organize their moving
tasks. Reads moving_tasks + user_custom_tasks (merged with the user's status
and deadlines via catalog_service) and the user's profile for context, then
asks OpenAI to reply. Read-only for now: the agent can discuss and recommend,
but cannot change task data itself.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAIError
from openai import OpenAI

from ..auth import CurrentUser, get_current_user
from ..catalog_service import _fetch_user_profile, fetch_items_with_status
from ..config import settings
from ..schemas import TaskAgentChatRequest, TaskAgentChatResponse

router = APIRouter(prefix="/task-agent", tags=["task-agent"])

# backend/app/routers/task_agent.py -> parents[2] == backend/
_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "task_agent_prompt.txt"


def _load_system_prompt() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def _tasks_context(user_id: str) -> str:
    items = fetch_items_with_status(user_id, item_type="moving_task")
    if not items:
        return "למשתמש/ת הזה/זו אין עדיין משימות במערכת."
    lines = []
    for it in items:
        deadline = it.get("deadline_date") or it.get("deadline_type") or "ללא מועד שנקבע"
        category = it.get("category_label") or it.get("category") or "כללי"
        lines.append(f"- [{category}] {it['title_he']} | סטטוס: {it['status']} | מועד: {deadline}")
    return "\n".join(lines)


def _profile_context(user_id: str) -> str:
    profile = _fetch_user_profile(user_id)
    parts = [f"{k}: {v}" for k, v in profile.items() if v]
    return ", ".join(parts) if parts else "אין פרטי פרופיל."


@router.post("/chat", response_model=TaskAgentChatResponse)
def chat(
    payload: TaskAgentChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskAgentChatResponse:
    if not settings.tasks_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המשימות לא הוגדר בשרת.")

    system_prompt = _load_system_prompt()
    context = (
        f"{system_prompt}\n\n"
        f"להלן המשימות הנוכחיות של המשתמש/ת לקראת המעבר:\n{_tasks_context(user.id)}\n\n"
        f"פרטי פרופיל המשתמש/ת: {_profile_context(user.id)}"
    )

    messages = [{"role": "system", "content": context}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages]

    client = OpenAI(api_key=settings.tasks_agent_openai_api_key)
    try:
        completion = client.chat.completions.create(model=settings.open_ai_model, messages=messages)
    except OpenAIError:
        try:
            completion = client.chat.completions.create(
                model=settings.open_ai_model_backup, messages=messages
            )
        except OpenAIError as exc:
            raise HTTPException(status_code=502, detail=f"שגיאה בפנייה לסוכן ה-AI: {exc}") from exc

    reply = completion.choices[0].message.content or ""
    return TaskAgentChatResponse(reply=reply)
