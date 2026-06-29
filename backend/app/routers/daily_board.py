"""Daily board endpoints — add/remove/list tasks pinned to the user's daily board."""
from fastapi import APIRouter, Depends, Path
from fastapi.responses import Response

from ..auth import CurrentUser, get_current_user
from ..schemas import DailyBoardAddRequest, DailyBoardKey
from ..supabase_client import get_supabase

router = APIRouter(prefix="/daily-board", tags=["daily-board"])


def list_daily_board(user_id: str) -> list[dict]:
    """Shared by the route below and the task agent's get_daily_board tool."""
    sb = get_supabase()
    return (
        sb.table("user_daily_board")
        .select("item_type,item_id,position,added_at")
        .eq("user_id", user_id)
        .order("position")
        .execute()
        .data
        or []
    )


@router.get("", response_model=list[DailyBoardKey])
def get_daily_board(user: CurrentUser = Depends(get_current_user)) -> list[DailyBoardKey]:
    return [DailyBoardKey(**r) for r in list_daily_board(user.id)]


@router.post("/items", response_model=list[DailyBoardKey])
def add_to_daily_board(
    payload: DailyBoardAddRequest,
    user: CurrentUser = Depends(get_current_user),
) -> list[DailyBoardKey]:
    if not payload.entries:
        return []

    sb = get_supabase()

    # Find the current highest position so new items are appended in order.
    top = (
        sb.table("user_daily_board")
        .select("position")
        .eq("user_id", user.id)
        .order("position", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    next_pos = (top[0]["position"] + 1) if top else 0

    rows = [
        {
            "user_id": user.id,
            "item_type": e.item_type,
            "item_id": e.item_id,
            "position": next_pos + i,
        }
        for i, e in enumerate(payload.entries)
    ]
    # ON CONFLICT DO NOTHING — re-pinning an already-pinned item is a no-op.
    sb.table("user_daily_board").upsert(
        rows, on_conflict="user_id,item_type,item_id", ignore_duplicates=True
    ).execute()

    all_rows = (
        sb.table("user_daily_board")
        .select("item_type,item_id,position,added_at")
        .eq("user_id", user.id)
        .order("position")
        .execute()
        .data
        or []
    )
    return [DailyBoardKey(**r) for r in all_rows]


@router.delete("/items/{item_type}/{item_id}", status_code=204)
def remove_from_daily_board(
    item_type: str = Path(..., pattern="^(moving_task|custom_task)$"),
    item_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
) -> Response:
    sb = get_supabase()
    sb.table("user_daily_board").delete().eq("user_id", user.id).eq(
        "item_type", item_type
    ).eq("item_id", item_id).execute()
    return Response(status_code=204)
