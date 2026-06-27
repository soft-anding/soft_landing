"""Per-user tracking endpoints: update an item's status and read progress."""
from fastapi import APIRouter, Depends, HTTPException, Path, status

from ..auth import CurrentUser, get_current_user
from ..catalog_service import (
    fetch_catalog,
    fetch_single_item,
    fetch_user_custom_tasks,
    fetch_user_status_map,
)
from ..constants import DEFAULT_STATUS, DONE_STATUS, STATUSES
from ..schemas import CustomTaskCreate, Item, ProgressSummary, StatusUpdate
from ..supabase_client import get_supabase

router = APIRouter(tags=["tracking"])


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
    row = {
        "user_id": user.id,
        "item_type": item_type,
        "item_id": item_id,
        "status": payload.status,
        "notes": payload.notes,
        "next_action": payload.next_action,
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
    catalog = fetch_catalog()
    tasks_only = [i for i in catalog if i["item_type"] == "moving_task"]
    custom_tasks = fetch_user_custom_tasks(user.id)

    total = len(tasks_only) + len(custom_tasks)
    all_task_keys = (
        {(i["item_type"], i["item_id"]) for i in tasks_only}
        | {(i["item_type"], i["item_id"]) for i in custom_tasks}
    )

    status_map = fetch_user_status_map(user.id)
    by_status = {s: 0 for s in STATUSES}
    tracked = 0
    for key, row in status_map.items():
        if key not in all_task_keys:
            continue
        tracked += 1
        by_status[row["status"]] = by_status.get(row["status"], 0) + 1

    # Catalog tasks the user never touched count as the default status.
    by_status[DEFAULT_STATUS] += max(total - tracked, 0)

    completed = by_status.get(DONE_STATUS, 0)
    completed_pct = round(completed / total * 100) if total else 0
    return ProgressSummary(
        total=total,
        tracked=tracked,
        completed=completed,
        completed_pct=completed_pct,
        by_status=by_status,
    )
