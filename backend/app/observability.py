"""Error monitoring (Sentry) — opt-in via SENTRY_DSN.

When the DSN is unset (dev, tests, or before the user wires Sentry) this is a
no-op and ``sentry_sdk`` is never even imported, so it adds zero overhead.
``sentry_sdk.init`` auto-instruments FastAPI/Starlette and asyncio, so no
manual middleware is needed; the same init is called from the worker too.
"""

from app import __version__
from app.config import Settings

_initialized = False


def init_sentry(settings: Settings) -> None:
    global _initialized
    if _initialized or not settings.sentry_dsn:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        release=f"inkpreview@{__version__}",
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,  # never ship user prompts / body photos to Sentry
    )
    _initialized = True
