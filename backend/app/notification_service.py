"""Daily job: scans every onboarded user's tasks and writes rows into
`notifications` for upcoming/overdue deadlines (specific-date reminders,
the current move-stage's top urgent tasks, and red overdue-from-an-earlier-
stage alerts), plus a one-off move-day greeting.

Triggered by APScheduler (see main.py) and by the manual
POST /api/internal/notifications/run endpoint (routers/internal.py).
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .catalog_service import fetch_items_with_status
from .constants import DONE_STATUS
from .supabase_client import get_supabase

TZ = ZoneInfo("Asia/Jerusalem")

_NOT_RELEVANT_STATUS = "לא רלוונטי"
_STAGE_ORDER = ["before_move", "move_day", "after_move"]
_TOP_N_CURRENT_STAGE = 5
_DAYS_BEFORE_SPECIFIC_DATE = 3

MOVE_DAY_GREETING = (
    "יום המעבר הגיע, בהצלחה רבה! אל תשכח לעבור על המשימות לוודא שאתה מבצע אותם"
)

# Phrasing per status — so the reminder reads naturally instead of always
# saying "not yet done" even when the user actually started working on it.
# "בטיפול"/"ממתין לגורם חיצוני" get an extra "long time" variant once the
# status has sat unchanged for a while (see _LONG_THRESHOLD_DAYS below).
_STATUS_PHRASING = {
    "לא התחיל": "ישנה משימה שטרם בוצעה ב",
    "בבדיקה": "ישנה משימה שעדיין בבדיקה ולא הושלמה כראוי ב",
    "בטיפול": "ישנה משימה שנמצאת בטיפול ועדיין לא הושלמה ב",
    "ממתין לגורם חיצוני": "ישנה משימה שממתינה לגורם חיצוני ועדיין לא הושלמה ב",
}

_LONG_STATUS_PHRASING = {
    "בטיפול": "ישנה משימה שנמצאת בטיפול זמן רב ועדיין לא הושלמה ב",
    "ממתין לגורם חיצוני": "ישנה משימה שממתינה זמן רב לגורם חיצוני ועדיין לא הושלמה ב",
}

_LONG_THRESHOLD_DAYS = 3


def _today() -> date:
    return datetime.now(TZ).date()


def _current_stage(move_date: date, today: date) -> str:
    if today < move_date:
        return "before_move"
    if today == move_date:
        return "move_day"
    return "after_move"


def _effective_stage(item: dict) -> str | None:
    """A user-set deadline_type overrides the task's own default timeline_stage."""
    return item.get("deadline_type") or item.get("timeline_stage")


def _as_date(value) -> date | None:
    if not value:
        return None
    return value if isinstance(value, date) else date.fromisoformat(value)


def _status_age_days(item: dict, today: date) -> int | None:
    """Days since the item's status was last changed, or None if unknown."""
    raw = item.get("status_updated_at")
    if not raw:
        return None
    return (today - datetime.fromisoformat(raw).date()).days


def _reminder_row(user_id: str, item: dict, today: date, *, severity: str = "normal") -> dict:
    category = item.get("category_label") or item.get("category") or "כללי"
    status = item["status"]
    age = _status_age_days(item, today)
    if status in _LONG_STATUS_PHRASING and age is not None and age >= _LONG_THRESHOLD_DAYS:
        phrasing = _LONG_STATUS_PHRASING[status]
    else:
        phrasing = _STATUS_PHRASING.get(status, _STATUS_PHRASING["לא התחיל"])
    return {
        "user_id": user_id,
        "content": f"{phrasing}: {category}",
        "task_title": item.get("title_he"),
        "item_type": item["item_type"],
        "item_id": item["item_id"],
        "severity": severity,
        "is_read": False,
    }


def _greeting_row(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "content": MOVE_DAY_GREETING,
        "task_title": None,
        "item_type": None,
        "item_id": None,
        "severity": "normal",
        "is_read": False,
    }




def _candidates_for_user(user_id: str, move_date: date, today: date) -> list[dict]:
    stage = _current_stage(move_date, today)
    earlier_stages = set(_STAGE_ORDER[: _STAGE_ORDER.index(stage)])

    items = [
        it
        for it in fetch_items_with_status(user_id, item_type="moving_task")
        if it["status"] not in (DONE_STATUS, _NOT_RELEVANT_STATUS)
    ]

    candidates: list[dict] = []
    if today == move_date:
        candidates.append(_greeting_row(user_id))

    current_stage_items = []
    for item in items:
        eff = _effective_stage(item)
        if eff == "specific_date":
            deadline = _as_date(item.get("deadline_date"))
            if deadline and deadline in (today, today + timedelta(days=_DAYS_BEFORE_SPECIFIC_DATE)):
                candidates.append(_reminder_row(user_id, item, today))
        elif eff in earlier_stages:
            candidates.append(_reminder_row(user_id, item, today, severity="urgent"))
        elif eff == stage:
            current_stage_items.append(item)

    current_stage_items.sort(key=lambda it: it["item_id"])
    for item in current_stage_items[:_TOP_N_CURRENT_STAGE]:
        candidates.append(_reminder_row(user_id, item, today))

    return candidates


def generate_daily_notifications() -> int:
    """Run the scan for every onboarded user and write the resulting
    notification rows — inserting new ones and refreshing the wording of
    today's existing ones if the task's status changed since they were
    created (e.g. a "not started" reminder that's since moved to "בטיפול"
    would otherwise sit there with stale text for the rest of the day).
    Returns the number of rows inserted or updated."""
    sb = get_supabase()
    today = _today()
    start_of_today = datetime.combine(today, datetime.min.time(), tzinfo=TZ).isoformat()

    profiles = sb.table("user_profiles").select("id,move_date").execute().data or []

    changed = 0
    for profile in profiles:
        move_date = _as_date(profile.get("move_date"))
        if not move_date:
            continue
        user_id = profile["id"]

        candidates = _candidates_for_user(user_id, move_date, today)
        if not candidates:
            continue

        existing = (
            sb.table("notifications")
            .select("id,item_type,item_id,content")
            .eq("user_id", user_id)
            .gte("created_at", start_of_today)
            .execute()
            .data
            or []
        )
        existing_by_item = {
            (n["item_type"], n["item_id"]): n for n in existing if n["item_id"] is not None
        }
        existing_contents = {n["content"] for n in existing if n["item_id"] is None}

        to_insert = []
        for row in candidates:
            if row["item_id"] is None:
                if row["content"] not in existing_contents:
                    to_insert.append(row)
                continue

            match = existing_by_item.get((row["item_type"], row["item_id"]))
            if match is None:
                to_insert.append(row)
            elif match["content"] != row["content"]:
                sb.table("notifications").update(
                    {"content": row["content"], "task_title": row["task_title"],
                     "severity": row["severity"], "is_read": False}
                ).eq("id", match["id"]).execute()
                changed += 1

        if to_insert:
            sb.table("notifications").insert(to_insert).execute()
            changed += len(to_insert)

    return changed
