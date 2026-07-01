"""Tasks AI agent — a chat endpoint that helps the user organize their moving
tasks. Reads moving_tasks + user_custom_tasks (merged with the user's status
and deadlines via catalog_service) and the user's profile for context, and
can also act on tasks via OpenAI tool-calling: add a custom task, change a
task's status, or change a task's deadline (see task_actions.py).
"""
import json
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI, OpenAIError

from .. import task_actions
from ..auth import CurrentUser, get_current_user
from ..catalog_service import fetch_items_with_status_and_profile
from ..config import settings
from ..constants import CUSTOM_TASK_CATEGORIES, STATUSES
from ..schemas import SaveConversationRequest, TaskAgentChatRequest
from ..supabase_client import get_supabase
from .daily_board import list_daily_board

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
                    "action_steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "2-5 שלבי פעולה קונקרטיים וברורים לביצוע המשימה, בעברית. "
                            "חובה להציע שלבים אלה ביזמתך בכל משימה חדשה (אלא אם המשימה כל כך "
                            "פשוטה וחד-שלבית שאין צורך לפרק אותה)."
                        ),
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
            "name": "set_task_action_steps",
            "description": "מוסיף או מחליף את שלבי הפעולה של משימה אישית קיימת (custom_task בלבד).",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer"},
                    "action_steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "2-5 שלבי פעולה קונקרטיים וברורים, בעברית.",
                    },
                },
                "required": ["item_id", "action_steps"],
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
            "name": "get_daily_board",
            "description": (
                "שולף את רשימת המשימות שמופיעות כרגע בלוח היומי של המשתמש/ת "
                "(המשימות שסומנו על ידה/ו ל'היום'), בסדר התצוגה שלהן בלוח."
            ),
            "parameters": {"type": "object", "properties": {}},
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


def _tasks_context(items: list[dict]) -> str:
    if not items:
        return "למשתמש/ת הזה/זו אין עדיין משימות במערכת."
    lines = []
    for it in items:
        deadline = it.get("deadline_date") or it.get("deadline_type") or "ללא מועד שנקבע"
        category = it.get("category_label") or it.get("category") or "כללי"
        line = (
            f"- ({it['item_type']}#{it['item_id']}) [{category}] {it['title_he']} "
            f"| סטטוס: {it['status']} | מועד: {deadline}"
        )
        steps = it.get("action_steps") or []
        if steps:
            line += f" | שלבים: {'; '.join(steps)}"
        lines.append(line)
    return "\n".join(lines)


def _profile_context(profile: dict) -> str:
    parts = [f"{k}: {v}" for k, v in profile.items() if v]
    return ", ".join(parts) if parts else "אין פרטי פרופיל."


def _execute_tool(user_id: str, name: str, args: dict, items: list[dict]) -> dict:
    try:
        if name == "get_daily_board":
            by_key = {(it["item_type"], it["item_id"]): it for it in items}
            board = [
                by_key[(row["item_type"], row["item_id"])]
                for row in list_daily_board(user_id)
                if (row["item_type"], row["item_id"]) in by_key
            ]
            return {"ok": True, "daily_board": board}
        if name == "add_custom_task":
            item = task_actions.add_custom_task(
                user_id,
                title=args["title"],
                deadline_type=args["deadline_type"],
                description=args.get("description"),
                category=args.get("category"),
                deadline_date=args.get("deadline_date"),
                action_steps=args.get("action_steps"),
            )
        elif name == "set_task_category":
            item = task_actions.set_task_category(
                user_id, int(args["item_id"]), args["category"]
            )
        elif name == "set_task_action_steps":
            item = task_actions.set_task_content(
                user_id, int(args["item_id"]), action_steps=args.get("action_steps")
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


# Caps worst-case reply latency without affecting the short, focused answers
# the prompt already asks for (~500 tokens is generous for that).
_MAX_REPLY_TOKENS = 500


def _create_stream(client: OpenAI, messages: list[dict], tools: list[dict] | None = None):
    kwargs = dict(model=settings.open_ai_model, messages=messages, max_tokens=_MAX_REPLY_TOKENS, stream=True)
    if tools is not None:
        kwargs["tools"] = tools
    try:
        return client.chat.completions.create(**kwargs)
    except OpenAIError:
        kwargs["model"] = settings.open_ai_model_backup
        return client.chat.completions.create(**kwargs)


def _stream_reply(client: OpenAI, messages: list[dict], user_id: str, items: list[dict]):
    """Yields the assistant's reply text as it's generated. Tool-call rounds
    produce no visible content (the model doesn't speak while deciding to
    call a tool), so only the round that actually answers in words streams
    anything to the caller — earlier rounds just execute tools silently.
    """
    try:
        for _ in range(_MAX_TOOL_ROUNDS):
            content_parts: list[str] = []
            tool_calls_acc: dict[int, dict] = {}

            for chunk in _create_stream(client, messages, TOOLS):
                delta = chunk.choices[0].delta
                if delta.content:
                    content_parts.append(delta.content)
                    yield delta.content
                for tc_delta in delta.tool_calls or []:
                    entry = tool_calls_acc.setdefault(tc_delta.index, {"id": "", "name": "", "arguments": ""})
                    if tc_delta.id:
                        entry["id"] = tc_delta.id
                    if tc_delta.function and tc_delta.function.name:
                        entry["name"] = tc_delta.function.name
                    if tc_delta.function and tc_delta.function.arguments:
                        entry["arguments"] += tc_delta.function.arguments

            if not tool_calls_acc:
                return  # final answer already streamed above

            ordered_calls = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
            messages.append(
                {
                    "role": "assistant",
                    "content": "".join(content_parts) or None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        }
                        for tc in ordered_calls
                    ],
                }
            )
            for tc in ordered_calls:
                args = json.loads(tc["arguments"] or "{}")
                result = _execute_tool(user_id, tc["name"], args, items)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
        # Ran out of tool-call rounds — stream one final answer without tools.
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
                {"role": "system", "content": "צור שם קצר (3-5 מילים בעברית) לשיחה הבאה עם עוזר המשימות. החזר רק את השם, ללא פיסוק מיותר."},
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
    if not settings.tasks_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המשימות לא הוגדר.")
    client = OpenAI(api_key=settings.tasks_agent_openai_api_key)
    name = _generate_conversation_name(client, payload.messages)
    conv_id = str(uuid.uuid4())
    messages_data = [{"role": m.role, "content": m.content} for m in payload.messages]
    try:
        get_supabase().table("tasks_agent_conversations").insert({
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


@router.get("/conversations")
def list_conversations(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    result = (
        get_supabase()
        .table("tasks_agent_conversations")
        .select("conversation_id, conversation_name, message_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: str,
    payload: SaveConversationRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    messages_data = [{"role": m.role, "content": m.content} for m in payload.messages]
    try:
        get_supabase().table("tasks_agent_conversations").update({
            "messages": messages_data,
            "message_count": len(payload.messages),
            "status": "Completed",
        }).eq("conversation_id", conversation_id).eq("user_id", user.id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"שגיאה בעדכון השיחה: {exc}") from exc
    return {"conversation_id": conversation_id}


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    result = (
        get_supabase()
        .table("tasks_agent_conversations")
        .select("conversation_id, conversation_name, messages, created_at")
        .eq("conversation_id", conversation_id)
        .eq("user_id", user.id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="שיחה לא נמצאה.")
    row = result.data
    msgs = row["messages"]
    if isinstance(msgs, str):
        msgs = json.loads(msgs)
    return {"conversation_id": row["conversation_id"], "conversation_name": row["conversation_name"], "messages": msgs}


def _build_agent_messages(user_id: str, history: list[dict], *, source: str = "app") -> tuple[list[dict], list[dict]]:
    """Builds the system-context-primed message list (+ the raw items, needed
    by tools like get_daily_board) for one agent turn. Shared by the streaming
    HTTP route and any non-HTTP caller (e.g. the Telegram bot)."""
    system_prompt = _load_system_prompt()
    # Fetches the profile and the task list in one parallel batch (instead of
    # the profile first and everything else after) — shaves the pre-stream
    # delay down to roughly the slowest single query instead of two stages.
    items, profile = fetch_items_with_status_and_profile(user_id, item_type="moving_task")
    telegram_note = (
        "\nערוץ תקשורת: טלגרם — אין לכלול את שורת [SUGGEST_DAILY:...] בשום תשובה.\n"
        if source == "telegram" else ""
    )
    context = (
        f"{system_prompt}\n\n"
        f"תאריך היום: {date.today().isoformat()}\n"
        f"{telegram_note}\n"
        f"להלן המשימות הנוכחיות של המשתמש/ת לקראת המעבר (item_type#item_id לשימוש בכלים):\n"
        f"{_tasks_context(items)}\n\n"
        f"פרטי פרופיל המשתמש/ת: {_profile_context(profile)}"
    )
    messages: list[dict] = [{"role": "system", "content": context}] + history
    return messages, items


def get_agent_reply(user_id: str, history: list[dict]) -> str:
    """Non-streaming variant of /chat for callers without an HTTP response
    object — currently the Telegram bot (see telegram_service.py). Runs the
    same tool-calling engine to completion and returns the full reply text,
    still raw (may include the [SUGGEST_DAILY:...] marker or a {"reply":...}
    wrapper) — cleanup is the caller's responsibility, same as the frontend
    does for the streamed version today.
    """
    if not settings.tasks_agent_openai_api_key:
        raise RuntimeError("מפתח ה-API של סוכן המשימות לא הוגדר בשרת.")
    messages, items = _build_agent_messages(user_id, history, source="telegram")
    client = OpenAI(api_key=settings.tasks_agent_openai_api_key)
    return "".join(_stream_reply(client, messages, user_id, items))


@router.post("/chat")
def chat(
    payload: TaskAgentChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """Streams the assistant's reply as plain text chunks as they're generated,
    instead of waiting for the full reply before responding — the OpenAI call
    itself is the dominant cost (2-7s), so this is what makes the chat feel
    responsive instead of frozen for several seconds.
    """
    if not settings.tasks_agent_openai_api_key:
        raise HTTPException(status_code=503, detail="מפתח ה-API של סוכן המשימות לא הוגדר בשרת.")

    history = [{"role": m.role, "content": m.content} for m in payload.messages]
    messages, items = _build_agent_messages(user.id, history)

    client = OpenAI(api_key=settings.tasks_agent_openai_api_key)
    return StreamingResponse(
        _stream_reply(client, messages, user.id, items), media_type="text/plain; charset=utf-8"
    )
