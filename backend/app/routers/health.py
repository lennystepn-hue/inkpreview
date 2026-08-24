import contextlib

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.config import Settings, get_settings
from app.db import get_session
from app.schemas import HealthOut, ReadyOut

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    """Liveness: the process is up and serving. Never touches dependencies."""
    return HealthOut(status="ok", version=__version__)


@router.get("/ready", response_model=ReadyOut)
async def ready(
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ReadyOut:
    """Readiness: verifies the backend can actually reach its dependencies.

    Returns 200 when every check is ``ok``, 503 otherwise — suitable for the
    container healthcheck and an external uptime monitor.
    """
    checks: dict[str, str] = {}

    try:
        await session.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:  # noqa: BLE001 — report the failure, don't raise
        checks["db"] = "error"

    # Redis is only on the critical path when jobs are dispatched through it.
    if settings.job_mode == "arq":
        checks["redis"] = "error"
        with contextlib.suppress(Exception):
            from app.queue import get_arq_pool

            pool = await get_arq_pool(settings)
            await pool.ping()
            checks["redis"] = "ok"

    ok = all(v == "ok" for v in checks.values())
    response.status_code = status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadyOut(status="ready" if ok else "degraded", version=__version__, checks=checks)
