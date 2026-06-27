"""Reads the shared knowledge base (moving_tasks + rights_items) and merges in
the current user's per-item status. The service-role client bypasses RLS, so
user data is always filtered by user_id here.
"""
from typing import Any

from .config import settings
from .constants import DEFAULT_STATUS, category_label
from .supabase_client import get_supabase

# item_types that are treated as "tasks" for filtering purposes
_TASK_TYPES = {"moving_task", "custom_task"}


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _normalize_task(row: dict) -> dict:
    return {
        "item_type": "moving_task",
        "item_id": row["id"],
        "title_he": row.get("title_he") or row.get("title"),
        "summary": row.get("summary"),
        "category": row.get("category"),
        "category_label": category_label(row.get("category")),
        "source_url": row.get("source_url"),
        "links": _as_list(row.get("related_links")),
        "action_steps": _as_list(row.get("action_steps")),
        "eligibility_conditions": [],
        "required_documents": [],
        "discount_amount": None,
        "deadlines": None,
        # kept for server-side filtering in fetch_items_with_status; stripped by Item schema
        "_relevance_rule": row.get("relevance_rule"),
    }


def _normalize_custom_task(row: dict) -> dict:
    return {
        "item_type": "custom_task",
        "item_id": row["id"],
        "title_he": row.get("title"),
        "summary": row.get("description"),
        "category": row.get("category"),
        "category_label": category_label(row.get("category")),
        "source_url": None,
        "links": [],
        "action_steps": [],
        "eligibility_conditions": [],
        "required_documents": [],
        "discount_amount": None,
        "deadlines": None,
        "deadline_type": row.get("deadline_type"),
        "deadline_date": str(row["deadline_date"]) if row.get("deadline_date") else None,
        "is_custom": True,
    }


def _normalize_right(row: dict) -> dict:
    return {
        "item_type": "rights_item",
        "item_id": row["id"],
        "title_he": row.get("title_he") or row.get("title"),
        "summary": row.get("description"),
        "category": row.get("category"),
        "category_label": category_label(row.get("category")),
        "source_url": row.get("source_url"),
        "links": [row["source_url"]] if row.get("source_url") else [],
        "action_steps": [],
        "eligibility_conditions": _as_list(row.get("eligibility_conditions")),
        "required_documents": _as_list(row.get("required_documents")),
        "discount_amount": row.get("discount_amount"),
        "deadlines": row.get("deadlines"),
    }


def _fetch_table(table: str, columns: str) -> list[dict]:
    sb = get_supabase()
    query = sb.table(table).select(columns)
    if not settings.show_unverified:
        query = query.eq("verified", True)
    return query.execute().data or []


def _resolve_city_id(city_slug: str) -> int | None:
    """Map a user_profiles city slug (e.g. 'tel_aviv') to the cities.id.

    The cities table uses hyphens ('tel-aviv') while user_profiles uses
    underscores ('tel_aviv'), so we normalise before comparing.
    Returns None on any error so city filtering degrades gracefully.
    """
    try:
        sb = get_supabase()
        rows = sb.table("cities").select("id,slug").execute().data or []
        normalised = city_slug.replace("_", "-").lower()
        for row in rows:
            if row["slug"].lower() == normalised or row["slug"].lower() == city_slug.lower():
                return row["id"]
    except Exception:
        pass
    return None


def _fetch_rights_items(city_slug: str | None = None) -> list[dict]:
    sb = get_supabase()
    # Do NOT add city_id to the SELECT — we only need it for filtering,
    # and PostgREST lets you filter by a column without returning it.
    query = sb.table("rights_items").select(
        "id,title_he,description,eligibility_conditions,required_documents,"
        "discount_amount,deadlines,category,source_url"
    )
    if not settings.show_unverified:
        query = query.eq("verified", True)
    if city_slug:
        city_id = _resolve_city_id(city_slug)
        if city_id is not None:
            query = query.eq("city_id", city_id)
    return query.execute().data or []


def _fetch_user_profile(user_id: str) -> dict:
    """Return the user_profiles row for user_id, or {} if no profile exists yet."""
    sb = get_supabase()
    rows = (
        sb.table("user_profiles")
        .select(
            "has_car,needs_movers,moving_companions,occupation,"
            "marital_status,income_range,special_eligibility,destination_city"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else {}


def _matches_relevance_rule(rule: dict | None, profile: dict) -> bool:
    """Return True if every key in rule matches the corresponding user profile field.

    - null / empty rule → always included (universal task)
    - scalar value (bool/str) → exact match required
    - list value → profile field must be one of the listed values
    If the user has no profile yet (empty dict), tasks with any non-null rule
    are excluded so they don't spam users who haven't filled in onboarding.
    """
    if not rule:
        return True
    if not profile:
        return False
    for key, expected in rule.items():
        actual = profile.get(key)
        if isinstance(expected, list):
            if actual not in expected:
                return False
        else:
            if actual != expected:
                return False
    return True


def fetch_catalog(city_slug: str | None = None) -> list[dict]:
    """All catalog items (tasks + rights), normalized, without user status.

    moving_tasks are city-agnostic and always included.
    rights_items are filtered to city_slug when provided.
    """
    tasks = _fetch_table(
        "moving_tasks",
        "id,title_he,summary,action_steps,related_links,category,source_url,relevance_rule",
    )
    rights = _fetch_rights_items(city_slug=city_slug)
    return [_normalize_task(r) for r in tasks] + [_normalize_right(r) for r in rights]


def fetch_user_custom_tasks(user_id: str) -> list[dict]:
    """Return normalized custom task items for a user, without status merged in."""
    sb = get_supabase()
    rows = (
        sb.table("user_custom_tasks")
        .select("id,user_id,title,description,category,deadline_type,deadline_date,created_at")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    return [_normalize_custom_task(r) for r in rows]


def fetch_single_item(item_type: str, item_id: int, user_id: str | None = None) -> dict | None:
    """Fetch and normalize exactly one catalog item by id.

    Used after a status update, where pulling the entire catalog (both
    tables, every row) just to find the one changed row made every status
    change noticeably slow.
    For custom_task, user_id is required (service role sees all rows).
    """
    sb = get_supabase()
    if item_type == "moving_task":
        rows = (
            sb.table("moving_tasks")
            .select("id,title_he,summary,action_steps,related_links,category,source_url")
            .eq("id", item_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return _normalize_task(rows[0]) if rows else None

    if item_type == "rights_item":
        rows = (
            sb.table("rights_items")
            .select(
                "id,title_he,description,eligibility_conditions,required_documents,"
                "discount_amount,deadlines,category,source_url"
            )
            .eq("id", item_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return _normalize_right(rows[0]) if rows else None

    if item_type == "custom_task" and user_id:
        rows = (
            sb.table("user_custom_tasks")
            .select("id,user_id,title,description,category,deadline_type,deadline_date,created_at")
            .eq("id", item_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return _normalize_custom_task(rows[0]) if rows else None

    return None


def fetch_user_status_map(user_id: str) -> dict[tuple[str, int], dict]:
    """Map of (item_type, item_id) -> {status, notes, next_action} for one user."""
    sb = get_supabase()
    rows = (
        sb.table("user_item_status")
        .select("item_type,item_id,status,notes,next_action")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    return {(r["item_type"], r["item_id"]): r for r in rows}


def fetch_items_with_status(
    user_id: str,
    category: str | None = None,
    item_type: str | None = None,
    city_slug: str | None = None,
) -> list[dict]:
    profile = _fetch_user_profile(user_id)
    catalog = fetch_catalog(city_slug=city_slug)
    # Custom tasks appear whenever moving_task type is requested (or no filter)
    include_custom = item_type is None or item_type == "moving_task"
    custom_items = fetch_user_custom_tasks(user_id) if include_custom else []

    status_map = fetch_user_status_map(user_id)
    items: list[dict] = []
    for item in catalog + custom_items:
        if category and item["category"] != category:
            continue
        # moving_task filter also admits custom_task items
        if item_type == "moving_task":
            if item["item_type"] not in _TASK_TYPES:
                continue
        elif item_type and item["item_type"] != item_type:
            continue

        # Exclude moving_tasks that don't match the user's profile
        if item["item_type"] == "moving_task":
            if not _matches_relevance_rule(item.get("_relevance_rule"), profile):
                continue

        st = status_map.get((item["item_type"], item["item_id"]))
        item = {
            **item,
            "status": st["status"] if st else DEFAULT_STATUS,
            "notes": st.get("notes") if st else None,
            "next_action": st.get("next_action") if st else None,
        }
        items.append(item)
    return items
