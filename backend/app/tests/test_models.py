from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app import models
from app.db import Base
from app.models import _now


@pytest.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as s:
        yield s
    await engine.dispose()


async def test_user_defaults_anonymous(session):
    user = models.User()
    session.add(user)
    await session.flush()
    assert user.id
    assert user.is_anonymous is True
    assert user.plan == "free"
    assert user.credits == 0


async def test_design_variant_self_fk_and_json(session):
    user = models.User()
    session.add(user)
    await session.flush()

    design = models.Design(
        user_id=user.id, prompt="a howling wolf", styles=["fine-line"], modifiers={"color": True}
    )
    session.add(design)
    await session.flush()
    assert design.status == "queued"

    variant = models.Design(
        user_id=user.id, prompt="a howling wolf", styles=["fine-line"], parent_design_id=design.id
    )
    session.add(variant)
    await session.commit()

    got = (
        await session.execute(
            select(models.Design).where(models.Design.parent_design_id == design.id)
        )
    ).scalar_one()
    assert got.id == variant.id
    assert got.styles == ["fine-line"]
    assert design.modifiers == {"color": True}


async def test_preview_and_export_chain(session):
    user = models.User()
    session.add(user)
    await session.flush()
    design = models.Design(user_id=user.id, prompt="rose")
    session.add(design)
    await session.flush()

    bp = models.BodyPhoto(
        user_id=user.id, storage_ref="ephemeral/x.png", expires_at=_now() + timedelta(hours=24)
    )
    session.add(bp)
    await session.flush()

    pv = models.Preview(
        design_id=design.id,
        body_photo_id=bp.id,
        x_pct=0.5,
        y_pct=0.4,
        scale=0.3,
        rotation=0.0,
        expires_at=bp.expires_at,
    )
    session.add(pv)
    await session.flush()
    assert pv.status == "queued"

    ex = models.Export(design_id=design.id, preview_id=pv.id, watermarked=True)
    session.add(ex)
    await session.commit()
    assert ex.watermarked is True
