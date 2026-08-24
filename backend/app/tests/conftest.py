"""Shared test fixtures.

The ``client`` fixture builds the real app and overrides the DB dependency with
an in-memory SQLite engine (StaticPool so the in-memory DB is shared across the
single connection). httpx ASGITransport does not run lifespan, so the dev DB
file / storage bucket are never touched by tests.
"""

# Force deterministic, keyless test settings BEFORE any app import triggers
# get_settings() — env vars take precedence over a local backend/.env (which may
# point at the real OpenAI engine for dev).
import os

os.environ["IMAGE_ENGINE"] = "mock"
os.environ["JOB_MODE"] = "inline"
os.environ["STORAGE_BACKEND"] = "fs"
os.environ["STORAGE_DIR"] = "./data/media_test"
os.environ["MEDIA_BASE_URL"] = "http://test/media"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_unused.db"
# Generous quota by default so behavior tests aren't throttled; quota tests
# monkeypatch these down on the cached settings object.
os.environ["GUEST_GENERATION_LIMIT"] = "1000"
os.environ["FREE_MONTHLY_GENERATION_LIMIT"] = "100000"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import Base, get_session
from app.main import create_app


@pytest.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_session():
        async with maker() as s:
            yield s

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac._maker = maker  # expose for tests that need direct DB access
        yield ac

    await engine.dispose()
