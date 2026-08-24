import io
from datetime import timedelta

from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import Base
from app.models import BodyPhoto, User, _now
from app.services.cleanup import sweep_expired
from app.storage import FsStorage


def _png(w: int = 120, h: int = 160) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (180, 150, 140)).save(buf, "PNG")
    return buf.getvalue()


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_upload_body_photo(client):
    h = await _auth(client)
    r = await client.post(
        "/api/body-photos", files={"file": ("arm.png", _png(), "image/png")}, headers=h
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"]
    assert data["url"]
    assert data["expires_at"]


async def test_upload_rejects_non_image(client):
    h = await _auth(client)
    r = await client.post(
        "/api/body-photos", files={"file": ("x.txt", b"not an image", "text/plain")}, headers=h
    )
    assert r.status_code == 400


async def test_upload_requires_auth(client):
    r = await client.post("/api/body-photos", files={"file": ("arm.png", _png(), "image/png")})
    assert r.status_code == 401


async def test_sweep_deletes_expired(tmp_path):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    storage = FsStorage(Settings(_env_file=None, storage_dir=str(tmp_path)))
    await storage.ensure_ready()

    async with maker() as s:
        user = User()
        s.add(user)
        await s.flush()
        key = "ephemeral/body/old.jpg"
        await storage.put(key, b"x", "image/jpeg")
        s.add(
            BodyPhoto(
                user_id=user.id, storage_ref=key, expires_at=_now() - timedelta(hours=1)
            )
        )
        await s.commit()

        deleted = await sweep_expired(s, storage)
        assert deleted >= 1
        remaining = (await s.execute(select(BodyPhoto))).scalars().all()
        assert remaining == []

    await engine.dispose()
