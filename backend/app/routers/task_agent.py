"""Tasks AI agent — a chat endpoint that helps the user organize their moving
tasks. Reads moving_tasks + user_custom_tasks (merged with the user's status
and deadlines via catalog_service) and the user's profile for context, and
can also act on tasks via OpenAI tool-calling: add a custom task, change a
task's status, or change a task's deadline (see task_actions.py).
"""
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI, OpenAIError

from .. import task_actions
from ..auth import CurrentUser, get_current_user
from ..catalog_service import _fetch_user_profile, fetch_items_with_status
from ..config import settings
from ..constants import CUSTOM_TASK_CATEGORIES, STATUSES
from ..schemas import TaskAgentChatRequest, TaskAgentChatResponse

router = APIRouter(prefix="/task-agent", tags=["task-agent"])

# backend/app/routers/task_agent.py -> parents[2] == backend/
_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "task_agent_prompt.txt"

_DEADLINE_TYPES = ["before_move", "move_day", "after_move", "specific_date"]
_MAX_TOOL_ROUNDS = 4

# These are the real category values used in moving_tasks (free Hebrew text,
# not slugs) — see constants.CUSTOM_TASK_CATEGORIES for why.
_CATEGORY_DESCRIPTION = (
    "הקטגוריה המתאימה ביותר מבין הרשימה הקבועה, לפי המשמעות הכללית של המשימה "
    "(לא לפי התאמת מילת מפתח מדויקת): " + ", ".join(CUSTOM_TASK_CATEGORIES)
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "add_custom_task",
            "description": "מוסיף משימה אישית חדשה לרשימת המשימות של המשתמש/ת.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "כותרת המשימה"},
                    "description": {"type": "string", "description": "פירוט נוסף, אופציונלי"},
                    "category": {
                        "type": "string",
                        "enum": CUSTOM_TASK_CATEGORIES,
                        "description": _CATEGORY_DESCRIPTION,
                    },
                    "deadline_type": {"type": "string", "enum": _DEADLINE_TYPES},
                    "deadline_date": {
                        "type": "string",
                        "description": "תאריך בפורמט YYYY-MM-DD — נדרש רק אם deadline_type הוא specific_date",
                    },
                },
                "required": ["title", "deadline_type", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_task_category",
            "description": "משנה את הקטגוריה של משימה אישית קיימת (custom_task בלבד).",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer"},
                    "category": {
                        "type": "string",
                        "enum": CUSTOM_TASK_CATEGORIES,
                        "description": _CATEGORY_DESCRIPTION,
                    },
                },
                "required": ["item_id", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_task_status",
            "description": "משנה את הסטטוס של משימה קיימת. יש להשתמש ב-item_type וב-item_id כפי שהם מופיעים ברשימת המשימות שסופקה.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_type": {"type": "string", "enum": ["moving_task", "custom_task"]},
                    "item_id": {"type": "integer"},
                    "status": {"type": "string", "enum": STATUSES},
                },
                "required": ["item_type", "item_id", "status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_task_deadline",
            "description": "קובע או משנה את מועד הביצוע (דדליין) של משימה קיימת.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_type": {"type": "string", "enum": ["moving_task", "custom_task"]},
                    "item_id": {"type": "integer"},
                    "deadline_type": {"type": "string", "enum": _DEADLINE_TYPES},
                    "deadline_date": {
                        "type": "string",
                        "description": "תאריך בפורמט YYYY-MM-DD — נדרש רק אם deadline_type הוא specific_date",
                    },
                },
                "required": ["item_type", "item_id", "deadline_type"],
            },
        },
    },
]


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
        lines.append(
            f"- ({it['item_type']}#{it['item_id']}) [{category}] {it['title_he']} "
            f"| סטטוס: {it['status']} | מועד: {deadline}"
        )
    return "\n".join(lines)


def _profile_context(user_id: str) -> str:
    profile = _fetch_user_profile(user_id)
    parts = [f"{k}: {v}" for k, v in profile.items() if v]
    return ", ".join(parts) if parts else "אין פרטי פרופיל."


def _execute_tool(user_id: str, name: str, args: dict) -> dict:
    try:
        if name == "add_custom_task":
            item = task_actions.add_custom_task(
                user_id,
                title=args["title"],
                deadline_type=args["deadline_type"],
                description=args.get("description"),
                category=args.get("category"),
                deadline_date=args.get("deadline_date"),
            )
        elif name == "set_task_category":
            item = task_actions.set_task_category(
                user_id, int(args["item_id"]), args["category"]
            )
        elif name == "set_task_status":
            item = task_actions.set_task_status(
                user_id, args["item_type"], int(args["item_id"]), args["status"]
            )
        elif name == "set_task_deadline":
            item = task_actions.set_task_deadline(
                user_id,
                args["item_type"],
                int(args["item_id"]),
                args["deadline_type"],
                args.get("deadline_date"),
            )
        else:
            return {"ok": False, "error": f"כלי לא מוכר: {name}"}
        return {"ok": True, "item": item}
    except (ValueError, KeyError, TypeError) as exc:
        return {"ok": False, "error": str(exc)}


def _call_model(client: OpenAI, messages: list[dict]) -> object:
    try:
        return client.chat.completions.create(
            model=settings.open_ai_model, messages=messages, tools=TOOLS
        )
    except OpenAIError:
        return client.chat.completions.create(
            model=settings.open_ai_model_backup, messages=messages, tools=TOOLS
        )


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
        f"להלן המשימות הנוכחיות של המשתמש/ת לקראת המעבר (item_type#item_id לשימוש בכלים):\n"
        f"{_tasks_context(user.id)}\n\n"
        f"פרטי פרופיל המשתמש/ת: {_profile_context(user.id)}"
    )

    messages: list[dict] = [{"role": "system", "content": context}]
    messages += [{"role": m.role, "content": m.content} for m in payload.messages]

    client = OpenAI(api_key=settings.tasks_agent_openai_api_key)

    try:
        for _ in range(_MAX_TOOL_ROUNDS):
            completion = _call_model(client, messages)
            choice = completion.choices[0].message
            tool_calls = choice.tool_calls or []

            if not tool_calls:
                return TaskAgentChatResponse(reply=choice.content or "")

            messages.append(
                {
                    "role": "assistant",
                    "content": choice.content,
                    "tool_calls": [tc.model_dump() for tc in tool_calls],
                }
            )
            for tc in tool_calls:
                args = json.loads(tc.function.arguments or "{}")
                result = _execute_tool(user.id, tc.function.name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
        # Ran out of tool-call rounds — ask once more without tools for a final answer.
        final = client.chat.completions.create(model=settings.open_ai_model, messages=messages)
        return TaskAgentChatResponse(reply=final.choices[0].message.content or "")
    except OpenAIError as exc:
        raise HTTPException(status_code=502, detail=f"שגיאה בפנייה לסוכן ה-AI: {exc}") from exc
