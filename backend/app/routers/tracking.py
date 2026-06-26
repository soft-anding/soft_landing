"""Per-user tracking endpoints: update an item's status and read progress."""
from fastapi import APIRouter, Depends, HTTPException, Path, status

from ..auth import CurrentUser, get_current_user
from ..catalog_service import fetch_catalog, fetch_single_item, fetch_user_status_map
from ..constants import DEFAULT_STATUS, DONE_STATUS, ITEM_TYPES, STATUSES
from ..schemas import Item, ProgressSummary, StatusUpdate
from ..supabase_client import get_supabase

router = APIRouter(tags=["tracking"])


@router.put("/items/{item_type}/{item_id}/status", response_model=Item)
def set_status(
    payload: StatusUpdate,
    item_type: str = Path(..., pattern="^(moving_task|rights_item)$"),
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

    # Return the updated catalog item so the client can refresh in place.
    item = fetch_single_item(item_type, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found in catalog.")
    return Item(
        **item,
        status=payload.status,
        notes=payload.notes,
        next_action=payload.next_action,
    )


@router.get("/progress", response_model=ProgressSummary)
def progress(user: CurrentUser = Depends(get_current_user)) -> ProgressSummary:
    catalog = fetch_catalog()
    tasks_only = [i for i in catalog if i["item_type"] == "moving_task"]
    total = len(tasks_only)
    catalog_keys = {(i["item_type"], i["item_id"]) for i in tasks_only}

    status_map = fetch_user_status_map(user.id)
    by_status = {s: 0 for s in STATUSES}
    tracked = 0
    for key, row in status_map.items():
        if key not in catalog_keys:  # ignore stale rows for removed items
            continue
        tracked += 1
        by_status[row["status"]] = by_status.get(row["status"], 0) + 1

    # Items the user never touched count as the default status.
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
