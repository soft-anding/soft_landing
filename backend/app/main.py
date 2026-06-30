"""FastAPI entrypoint for the Soft Landing Moving Assistant.

Serves the JSON API under /api and, in production, the built React SPA from
frontend/dist at the root (so a single Railway service hosts both).
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    # RAILWAY_ENVIRONMENT is injected only on actual Railway deploys — gating on
    # it (not just the token) stops the poller from double-running if someone's
    # local .env happens to have the real bot token, which causes every Telegram
    # message to get answered twice (once per process) with different wording.
    if settings.telegram_bot_token and os.environ.get("RAILWAY_ENVIRONMENT"):
        scheduler.add_job(poll_updates, IntervalTrigger(seconds=10), id="telegram_poll")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Soft Landing Moving Assistant API", version="0.1.0", lifespan=lifespan)

# עדכון ה-Middleware כדי לאפשר גישה חופשית לפרונטנד ב-Railway ללא חסימות CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    # Mount /assets separately so JS/CSS are served efficiently.
    # The catch-all route below handles everything else — this avoids
    # app.mount("/", StaticFiles(html=True)) which can intercept /api/* routes
    # and return index.html instead of JSON.
    _assets = _dist / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = _dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_dist / "index.html"))