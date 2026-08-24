"""Env-driven settings.

Defaults are chosen so the backend boots with ZERO infrastructure on a dev
machine (no Docker): SQLite + in-process jobs + filesystem storage + the mock
image engine. Production selects Postgres + Redis/Arq + S3/MinIO + OpenAI via
environment variables.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "dev"
    debug: bool = True

    # --- Database ---
    database_url: str = "sqlite+aiosqlite:///./inkpreview.db"

    # --- Queue / jobs ---
    job_mode: str = "inline"  # inline | arq
    redis_url: str = "redis://localhost:6379"

    # --- Storage ---
    storage_backend: str = "fs"  # fs | s3
    storage_dir: str = "./data/media"
    media_base_url: str = "http://localhost:8000/media"
    s3_endpoint: str | None = None
    s3_region: str = "eu-central-1"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket: str = "inkpreview"

    # --- Image engine ---
    image_engine: str = "mock"  # mock | openai
    openai_api_key: str | None = None
    # Both steps use gpt-image-2. Designs are generated on a clean SOLID WHITE
    # background (the standard tattoo flash/stencil convention — black-on-white,
    # always visible, artist-ready; no transparency needed). The composite inks
    # only the motif and ignores the white background.
    openai_image_model: str = "gpt-image-2"
    openai_composite_model: str = "gpt-image-2"
    openai_image_size: str = "1024x1024"
    openai_image_quality: str = "medium"  # low | medium | high | auto
    # Composite (body preview) gets its own quality knob: the 3-image occlusion +
    # skin-wrap edit needs more fidelity than generation — at "low" the fine
    # linework under-inks (goes faint/mushy). Defaults higher than generation.
    openai_composite_quality: str = "medium"  # low | medium | high | auto
    openai_text_model: str = "gpt-4o-mini"

    # --- Observability ---
    # Sentry is opt-in: unset DSN => fully disabled (no init, no import cost).
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0  # 0 = errors only, no perf tracing

    # --- Auth / session ---
    session_secret: str = "dev-insecure-change-me"

    # --- Stripe billing (Pro subscription) ---
    # All unset => billing disabled (endpoints return 503, no upgrade UI).
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id: str | None = None  # the recurring Pro price (price_...)
    # Enable only once Stripe Tax is activated in the dashboard, else Checkout
    # errors. When on, VAT/OSS is computed automatically from the billing address.
    stripe_automatic_tax: bool = False

    # --- Google OAuth ---
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "https://ink-preview.com/api/auth/google/callback"
    # Where to send the browser back to after a successful login (token in URL fragment).
    frontend_base_url: str = "https://ink-preview.com"

    # --- Limits / privacy ---
    anon_rate_limit: int = 30  # image jobs per window per user (burst/abuse guard)
    rate_limit_window_s: int = 3600
    # Quota meter / cost kill-switch (durable, per-user, see services/quota.py):
    guest_generation_limit: int = 2  # anonymous: lifetime cap
    free_monthly_generation_limit: int = 10  # logged-in free plan: per calendar month
    # "pro" plan is unlimited (no cap enforced).
    # Launch promo: everyone unlimited ("preview — only for a few days"), shown as
    # a promo pill in the UI. Flip OFF once Stripe goes live. Usage is still
    # recorded in the ledger, and the hourly rate limiter still guards abuse.
    promo_unlimited: bool = False
    body_photo_ttl_hours: int = 24
    preview_ttl_hours: int = 24
    max_upload_mb: int = 12
    free_export_max_px: int = 1024

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


def assert_secure_prod(settings: Settings) -> None:
    """Fail fast: refuse to start in production with insecure/unset config.

    Guards against the misconfiguration class behind the .env outage — a missing
    env var silently falling back to a dev default (SQLite DB, insecure session
    secret, no image key).
    """
    if not settings.is_prod:
        return
    problems: list[str] = []
    if settings.session_secret == "dev-insecure-change-me":
        problems.append("SESSION_SECRET is the insecure default")
    if settings.database_url.startswith("sqlite"):
        problems.append("DATABASE_URL still points at SQLite (Postgres expected in prod)")
    if settings.image_engine == "openai" and not settings.openai_api_key:
        problems.append("IMAGE_ENGINE=openai but OPENAI_API_KEY is unset")
    if problems:
        raise RuntimeError(
            "Refusing to start in production with insecure configuration: " + "; ".join(problems)
        )
