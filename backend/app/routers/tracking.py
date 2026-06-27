"""Per-user tracking endpoints: update an item's status and read progress."""
from fastapi import APIRouter, Depends, HTTPException, Path, status

from ..auth import CurrentUser, get_current_user
from ..catalog_service import fetch_items_with_status, fetch_single_item
from ..constants import DEFAULT_STATUS, DONE_STATUS, STATUSES
from ..schemas import CustomTaskCreate, DeadlineUpdate, Item, ProgressSummary, StatusUpdate
from ..supabase_client import get_supabase

router = APIRouter(tags=["tracking"])


def _get_current_deadline(sb, user_id: str, item_type: str, item_id: int) -> dict:
    """Return the current deadline fields from user_item_status, or {} if no row exists."""
    rows = (
        sb.table("user_item_status")
        .select("deadline_type,deadline_date")
        .eq("user_id", user_id)
        .eq("item_type", item_type)
        .eq("item_id", item_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else {}


@router.put("/items/{item_type}/{item_id}/status", response_model=Item)
def set_status(
    payload: StatusUpdate,
    item_type: str = Path(..., pattern="^(moving_task|rights_item|custom_task)$"),
    item_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
) -> Item:
    if payload.status not in STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Allowed: {STATUSES}",
        )

    sb = get_supabase()
    current_deadline = _get_current_deadline(sb, user.id, item_type, item_id)

    row = {
        "user_id": user.id,
        "item_type": item_type,
        "item_id": item_id,
        "status": payload.status,
        "notes": payload.notes,
        "next_action": payload.next_action,
        "deadline_type": current_deadline.get("deadline_type"),
        "deadline_date": current_deadline.get("deadline_date"),
    }
    sb.table("user_item_status").upsert(
        row, on_conflict="user_id,item_type,item_id"
    ).execute()

    item = fetch_single_item(item_type, item_id, user_id=user.id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return Item(
        **item,
        status=payload.status,
        notes=payload.notes,
        next_action=payload.next_action,
        deadline_type=current_deadline.get("deadline_type"),
        deadline_date=str(current_deadline["deadline_date"]) if current_deadline.get("deadline_date") else None,
    )


@router.put("/items/{item_type}/{item_id}/deadline", response_model=Item)
def set_deadline(
    payload: DeadlineUpdate,
    item_type: str = Path(..., pattern="^(moving_task|rights_item|custom_task)$"),
    item_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
) -> Item:
    if payload.deadline_type == "specific_date" and not payload.deadline_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deadline_date is required when deadline_type is 'specific_date'",
        )

    sb = get_supabase()

    # Fetch current status to preserve it in the upsert.
    existing = (
        sb.table("user_item_status")
        .select("status,notes,next_action")
        .eq("user_id", user.id)
        .eq("item_type", item_type)
        .eq("item_id", item_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    current = existing[0] if existing else {}

    row = {
        "user_id": user.id,
        "item_type": item_type,
        "item_id": item_id,
        "status": current.get("status", DEFAULT_STATUS),
        "notes": current.get("notes"),
        "next_action": current.get("next_action"),
        "deadline_type": payload.deadline_type,
        "deadline_date": payload.deadline_date,
    }
    sb.table("user_item_status").upsert(
        row, on_conflict="user_id,item_type,item_id"
    ).execute()

    item = fetch_single_item(item_type, item_id, user_id=user.id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return Item(
        **item,
        status=current.get("status", DEFAULT_STATUS),
        notes=current.get("notes"),
        next_action=current.get("next_action"),
        deadline_type=payload.deadline_type,
        deadline_date=payload.deadline_date,
    )


@router.post("/custom-tasks", response_model=Item, status_code=201)
def create_custom_task(
    payload: CustomTaskCreate,
    user: CurrentUser = Depends(get_current_user),
) -> Item:
    if payload.deadline_type == "specific_date" and not payload.deadline_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deadline_date is required when deadline_type is 'specific_date'",
        )

    sb = get_supabase()
    result = sb.table("user_custom_tasks").insert({
        "user_id": user.id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "deadline_type": payload.deadline_type,
        "deadline_date": payload.deadline_date,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create custom task.")

    new_task = result.data[0]
    item_id: int = new_task["id"]

    # Atomically create the initial status row so the task is immediately tracked.
    sb.table("user_item_status").insert({
        "user_id": user.id,
        "item_type": "custom_task",
        "item_id": item_id,
        "status": DEFAULT_STATUS,
        "notes": None,
        "next_action": None,
    }).execute()

    item = fetch_single_item("custom_task", item_id, user_id=user.id)
    if item is None:
        raise HTTPException(status_code=500, detail="Task created but could not be read back.")
    return Item(**item, status=DEFAULT_STATUS)


@router.get("/progress", response_model=ProgressSummary)
def progress(user: CurrentUser = Depends(get_current_user)) -> ProgressSummary:
    # Same personalized set (relevance_rule + tag filtering applied) the
    # category cards on the Dashboard are built from — otherwise this total
    # double-counts moving_tasks that were filtered out as irrelevant to the
    # user's profile, and the header total doesn't match the cards' sum.
    items = fetch_items_with_status(user.id, item_type="moving_task")

    total = len(items)
    by_status = {s: 0 for s in STATUSES}
    for item in items:
        by_status[item["status"]] = by_status.get(item["status"], 0) + 1

    completed = by_status.get(DONE_STATUS, 0)
    completed_pct = round(completed / total * 100) if total else 0
    return ProgressSummary(
        total=total,
        tracked=total,
        completed=completed,
        completed_pct=completed_pct,
        by_status=by_status,
    )
