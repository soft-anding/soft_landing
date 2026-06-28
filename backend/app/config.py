"""Application settings loaded from environment variables / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Supabase project connection
    supabase_url: str = ""
    supabase_service_key: str = ""   # service-role key (server-side only, never exposed)
    supabase_anon_key: str = ""      # used to verify user access tokens against Supabase Auth

    # CORS: comma-separated list of allowed origins (Vite dev + the deployed URL)
    frontend_origin: str = "http://localhost:5173"

    # When false, only items with verified = true are surfaced (matches the spec's
    # "review then publish" workflow). Defaults to true so the MVP shows the seeded data.
    show_unverified: bool = True

    # AI agents (Claude)
    anthropic_api_key: str = ""   # Anthropic Claude — for form expert + task planning agents

    # Tasks AI agent (OpenAI) — powers the in-app "סוכן AI למשימות" chat
    tasks_agent_openai_api_key: str = ""
    # Documents AI agent (OpenAI) — powers the documents/forms chat
    documents_agent_openai_api_key: str = ""
    open_ai_model: str = "gpt-4o-mini"
    open_ai_model_backup: str = "gpt-4o"

    # Shared secret for the manual /api/internal/notifications/run trigger —
    # not a user JWT, since the job acts on every user, not one logged-in caller.
    internal_job_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


settings = Settings()
