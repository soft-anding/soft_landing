"""Pydantic response/request models for the API."""
from typing import Any, Literal

from pydantic import BaseModel, Field

from .constants import STATUSES


class Category(BaseModel):
    slug: str
    label_he: str
    count: int


class Item(BaseModel):
    item_type: Literal["moving_task", "rights_item", "custom_task"]
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
    # catalog-level timeline hint (moving_tasks only, read-only)
    timeline_stage: str | None = None
    # custom_task extras
    deadline_type: str | None = None
    deadline_date: str | None = None
    is_custom: bool = False
    # population tags (derived from registration profile)
    tags: list[str] = Field(default_factory=list)
    # per-user tracking
    status: str = STATUSES[0]
    notes: str | None = None
    next_action: str | None = None


class CustomTaskCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    deadline_type: Literal["before_move", "move_day", "after_move", "specific_date"]
    deadline_date: str | None = None  # ISO date string, required when deadline_type='specific_date'


class StatusUpdate(BaseModel):
    status: str
    notes: str | None = None
    next_action: str | None = None


class DeadlineUpdate(BaseModel):
    deadline_type: Literal["before_move", "move_day", "after_move", "specific_date"] | None = None
    deadline_date: str | None = None  # ISO date string, required when deadline_type='specific_date'


class ProgressSummary(BaseModel):
    total: int
    tracked: int
    completed: int
    completed_pct: int
    by_status: dict[str, int]
