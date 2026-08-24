"""Async SQLAlchemy engine, session factory, and schema init.

Cross-DB: the same models run on SQLite (local, zero-infra) and Postgres (prod)
because we use only portable column types (String/Integer/Boolean/DateTime/JSON/
Float/Text) and Python-side defaults.

Schema ownership splits by backend:
- SQLite (dev/test): ``init_db`` builds the schema directly from metadata
  (``create_all``) so the app boots with zero infrastructure and no migration step.
- Postgres (prod): the schema is owned by Alembic migrations, applied at deploy
  time (``alembic upgrade head``). ``init_db`` does NOT touch the schema there —
  it would mask a missing migration and race the deploy's migrate step.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
engine = create_async_engine(_settings.database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Bootstrap the dev/test SQLite schema from metadata.

    On Postgres (prod) this is a no-op: the schema is managed by Alembic and
    applied at deploy time. Importing models registers them on Base.metadata.
    """
    from app import models  # noqa: F401

    if not _settings.database_url.startswith("sqlite"):
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
