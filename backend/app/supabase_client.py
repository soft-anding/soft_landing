"""Singleton Supabase client using the service-role key.

The service key bypasses Row Level Security, so every per-user query in this
backend MUST filter by the authenticated user_id explicitly. Shared knowledge-base
reads (moving_tasks / rights_items) are public content.
"""
from functools import lru_cache

from supabase import Client, create_client

from .config import settings


@lru_cache
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (see backend/.env.example)."
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)
