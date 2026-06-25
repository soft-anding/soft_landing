"""Reads the shared knowledge base (moving_tasks + rights_items) and merges in
the current user's per-item status. The service-role client bypasses RLS, so
user data is always filtered by user_id here.
"""
from typing import Any

from .config import settings
from .constants import DEFAULT_STATUS, category_label
from .supabase_client import get_supabase


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


def fetch_catalog() -> list[dict]:
    """All catalog items (tasks + rights), normalized, without user status."""
    tasks = _fetch_table(
        "moving_tasks",
        "id,title,title_he,summary,action_steps,related_links,category,source_url",
    )
    rights = _fetch_table(
        "rights_items",
        "id,title,title_he,description,eligibility_conditions,required_documents,"
        "discount_amount,deadlines,category,source_url",
    )
    return [_normalize_task(r) for r in tasks] + [_normalize_right(r) for r in rights]


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
) -> list[dict]:
    catalog = fetch_catalog()
    status_map = fetch_user_status_map(user_id)
    items: list[dict] = []
    for item in catalog:
        if category and item["category"] != category:
            continue
        if item_type and item["item_type"] != item_type:
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
