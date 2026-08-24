"""FastAPI app factory."""

import asyncio
import contextlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.config import Settings, assert_secure_prod, get_settings
from app.db import SessionLocal, init_db
from app.observability import init_sentry
from app.routers import (
    account,
    auth,
    billing,
    body_photos,
    captures,
    designs,
    exports,
    geo,
    health,
    mockups,
    previews,
    prompt,
    session,
    share,
    styles,
)
from app.services.cleanup import sweep_expired
from app.storage import Storage, get_storage

_SWEEP_INTERVAL_S = 3600


async def _sweeper_loop(storage: Storage) -> None:
    while True:
        await asyncio.sleep(_SWEEP_INTERVAL_S)
        with contextlib.suppress(Exception):
            async with SessionLocal() as s:
                await sweep_expired(s, storage)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = get_settings()
    await init_db()
    storage = get_storage(settings)
    await storage.ensure_ready()
    app.state.storage = storage
    sweeper = asyncio.create_task(_sweeper_loop(storage))
    try:
        yield
    finally:
        sweeper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await sweeper


def create_app() -> FastAPI:
    settings = get_settings()
    assert_secure_prod(settings)
    init_sentry(settings)
    app = FastAPI(title="InkPreview", version=__version__, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(geo.router)
    app.include_router(auth.router)
    app.include_router(billing.router)
    app.include_router(account.router)
    app.include_router(session.router)
    app.include_router(styles.router)
    app.include_router(designs.router)
    app.include_router(prompt.router)
    app.include_router(body_photos.router)
    app.include_router(previews.router)
    app.include_router(mockups.router)
    app.include_router(exports.router)
    app.include_router(captures.router)
    app.include_router(share.router)

    if settings.storage_backend == "fs":
        media_dir = Path(settings.storage_dir)
        media_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

    return app


app = create_app()
