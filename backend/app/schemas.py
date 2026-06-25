"""Pydantic response/request models for the API."""
from typing import Any, Literal

from pydantic import BaseModel, Field

from .constants import STATUSES


class Category(BaseModel):
    slug: str
    label_he: str
    count: int


class Item(BaseModel):
    item_type: Literal["moving_task", "rights_item"]
    item_id: int
    title_he: str | None = None
    summary: str | None = None
    category: str | None = None
    category_label: str | None = None
    source_url: str | None = None
    links: list[Any] = Field(default_factory=list)
    # moving_task extras
    action_steps: list[Any] = Field(default_factory=list)
    # rights_item extras
    eligibility_conditions: list[Any] = Field(default_factory=list)
    required_documents: list[Any] = Field(default_factory=list)
    discount_amount: str | None = None
    deadlines: str | None = None
    # per-user tracking
    status: str = STATUSES[0]
    notes: str | None = None
    next_action: str | None = None


class StatusUpdate(BaseModel):
    status: str
    notes: str | None = None
    next_action: str | None = None


class ProgressSummary(BaseModel):
    total: int
    tracked: int
    completed: int
    completed_pct: int
    by_status: dict[str, int]
