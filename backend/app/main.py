"""FastAPI entrypoint for the Soft Landing Moving Assistant.

Serves the JSON API under /api and, in production, the built React SPA from
frontend/dist at the root (so a single Railway service hosts both).
"""
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import CurrentUser, get_current_user
from .config import settings
from .constants import STATUSES
from .routers import catalog, health, task_agent, tracking

app = FastAPI(title="Soft Landing Moving Assistant API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(health.router)
api.include_router(catalog.router)
api.include_router(tracking.router)
api.include_router(task_agent.router)


@api.get("/statuses", tags=["meta"])
def list_statuses() -> list[str]:
    """The 7 fixed statuses, in display order."""
    return STATUSES


@api.get("/me", tags=["meta"])
def me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email}


app.include_router(api)

# ── Serve the built frontend (production / Railway) ───────────────
# Repo root = backend/app/main.py -> parents[2]
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="spa")
