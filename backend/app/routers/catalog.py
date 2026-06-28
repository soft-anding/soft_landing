"""Catalog endpoints: categories and items (with the user's status merged in)."""
from collections import Counter

from fastapi import APIRouter, Depends, Query

from ..auth import CurrentUser, get_current_user
from ..catalog_service import fetch_catalog, fetch_items_with_status
from ..constants import category_label
from ..schemas import Category, Item

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[Category])
def list_categories(_user: CurrentUser = Depends(get_current_user)) -> list[Category]:
    counts = Counter(item["category"] for item in fetch_catalog())
    cats = [
        Category(slug=slug or "other", label_he=category_label(slug), count=count)
        for slug, count in counts.items()
    ]
    cats.sort(key=lambda c: c.count, reverse=True)
    return cats


@router.get("/items", response_model=list[Item])
def list_items(
    user: CurrentUser = Depends(get_current_user),
    category: str | None = Query(default=None),
    type: str | None = Query(default=None, pattern="^(moving_task|rights_item|custom_task)$"),
    city: str | None = Query(default=None, description="Destination city slug (e.g. 'jerusalem', 'tel_aviv')"),
) -> list[Item]:
    return fetch_items_with_status(user.id, category=category, item_type=type, city_slug=city)
