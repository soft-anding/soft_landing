"""Plain (non-HTTP) functions that create/modify a user's tasks — used by the
tasks AI agent's tool-calling. Deliberately separate from routers/tracking.py
(rather than refactoring it) so the existing HTTP endpoints — which also
support rights_item and notes/next_action — are left untouched.
"""
from .catalog_service import fetch_single_item
from .constants import CUSTOM_TASK_CATEGORIES, DEFAULT_STATUS, STATUSES
from .supabase_client import get_supabase

_DEADLINE_TYPES = {"before_move", "move_day", "after_move", "specific_date"}
_TASK_TYPES = {"moving_task", "custom_task"}


def _validate_deadline(deadline_type: str | None, deadline_date: str | None) -> None:
    if deadline_type is not None and deadline_type not in _DEADLINE_TYPES:
        raise ValueError(f"deadline_type לא חוקי. אפשרי: {sorted(_DEADLINE_TYPES)}")
    if deadline_type == "specific_date" and not deadline_date:
        raise ValueError("deadline_date נדרש כש-deadline_type הוא specific_date")


def set_task_status(user_id: str, item_type: str, item_id: int, new_status: str) -> dict:
    if item_type not in _TASK_TYPES:
        raise ValueError("item_type חייב להיות moving_task או custom_task")
    if new_status not in STATUSES:
        raise ValueError(f"סטטוס לא חוקי. אפשרי: {STATUSES}")

    sb = get_supabase()
    existing = (
        sb.table("user_item_status")
        .select("deadline_type,deadline_date")
        .eq("user_id", user_id).eq("item_type", item_type).eq("item_id", item_id)
        .limit(1).execute().data or []
    )
    current_deadline = existing[0] if existing else {}

    sb.table("user_item_status").upsert(
        {
            "user_id": user_id,
            "item_type": item_type,
            "item_id": item_id,
            "status": new_status,
            "notes": None,
            "next_action": None,
            "deadline_type": current_deadline.get("deadline_type"),
            "deadline_date": current_deadline.get("deadline_date"),
        },
        on_conflict="user_id,item_type,item_id",
    ).execute()

    item = fetch_single_item(item_type, item_id, user_id=user_id)
    if item is None:
        raise ValueError("המשימה לא נמצאה.")
    return item


def set_task_deadline(
    user_id: str,
    item_type: str,
    item_id: int,
    deadline_type: str,
    deadline_date: str | None = None,
) -> dict:
    if item_type not in _TASK_TYPES:
        raise ValueError("item_type חייב להיות moving_task או custom_task")
    _validate_deadline(deadline_type, deadline_date)

    sb = get_supabase()
    existing = (
        sb.table("user_item_status")
        .select("status,notes,next_action")
        .eq("user_id", user_id).eq("item_type", item_type).eq("item_id", item_id)
        .limit(1).execute().data or []
    )
    current = existing[0] if existing else {}

    sb.table("user_item_status").upsert(
        {
            "user_id": user_id,
            "item_type": item_type,
            "item_id": item_id,
            "status": current.get("status", DEFAULT_STATUS),
            "notes": current.get("notes"),
            "next_action": current.get("next_action"),
            "deadline_type": deadline_type,
            "deadline_date": deadline_date,
        },
        on_conflict="user_id,item_type,item_id",
    ).execute()

    item = fetch_single_item(item_type, item_id, user_id=user_id)
    if item is None:
        raise ValueError("המשימה לא נמצאה.")
    return item


def set_task_category(user_id: str, item_id: int, category: str) -> dict:
    """Changes the category of an existing custom task (categories on
    moving_task/rights_item items come from the shared catalog and aren't
    user-editable, so this only applies to custom_task).
    """
    if category not in CUSTOM_TASK_CATEGORIES:
        raise ValueError(f"קטגוריה לא חוקית. אפשרי: {CUSTOM_TASK_CATEGORIES}")

    sb = get_supabase()
    sb.table("user_custom_tasks").update({"category": category}).eq(
        "id", item_id
    ).eq("user_id", user_id).execute()

    item = fetch_single_item("custom_task", item_id, user_id=user_id)
    if item is None:
        raise ValueError("המשימה לא נמצאה.")
    return item


def add_custom_task(
    user_id: str,
    title: str,
    deadline_type: str,
    description: str | None = None,
    category: str | None = None,
    deadline_date: str | None = None,
) -> dict:
    if not title or not title.strip():
        raise ValueError("כותרת המשימה לא יכולה להיות ריקה.")
    if category is not None and category not in CUSTOM_TASK_CATEGORIES:
        raise ValueError(f"קטגוריה לא חוקית. אפשרי: {CUSTOM_TASK_CATEGORIES}")
    _validate_deadline(deadline_type, deadline_date)

    sb = get_supabase()
    result = sb.table("user_custom_tasks").insert(
        {
            "user_id": user_id,
            "title": title.strip(),
            "description": description,
            "category": category,
            "deadline_type": deadline_type,
            "deadline_date": deadline_date,
        }
    ).execute()
    if not result.data:
        raise ValueError("יצירת המשימה נכשלה.")

    item_id = result.data[0]["id"]
    sb.table("user_item_status").insert(
        {
            "user_id": user_id,
            "item_type": "custom_task",
            "item_id": item_id,
            "status": DEFAULT_STATUS,
            "notes": None,
            "next_action": None,
        }
    ).execute()

    item = fetch_single_item("custom_task", item_id, user_id=user_id)
    if item is None:
        raise ValueError("המשימה נוצרה אך לא ניתן לקרוא אותה בחזרה.")
    return item
