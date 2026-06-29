"""FastAPI entrypoint for the Soft Landing Moving Assistant.

Serves the JSON API under /api and, in production, the built React SPA from
frontend/dist at the root (so a single Railway service hosts both).
"""
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import CurrentUser, get_current_user
from .config import settings
from .constants import STATUSES
from .notification_service import TZ, generate_daily_notifications
from .routers import catalog, daily_board, documents_agent, health, internal, task_agent, telegram, tracking
from .telegram_service import poll_updates

scheduler = BackgroundScheduler(timezone=TZ)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    scheduler.add_job(
        generate_daily_notifications,
        CronTrigger(hour=8, minute=0, timezone=TZ),
        id="daily_notifications",
    )
    if settings.telegram_bot_token:
        scheduler.add_job(poll_updates, IntervalTrigger(seconds=10), id="telegram_poll")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Soft Landing Moving Assistant API", version="0.1.0", lifespan=lifespan)

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
api.include_router(daily_board.router)
api.include_router(task_agent.router)
api.include_router(documents_agent.router)
api.include_router(internal.router)
api.include_router(telegram.router)


@api.get("/statuses", tags=["meta"])
def list_statuses() -> list[str]:
    """The 6 fixed statuses, in display order."""
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
