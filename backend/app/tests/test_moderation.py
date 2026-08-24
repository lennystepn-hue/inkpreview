"""Graceful moderation handling: typed errors, quota refund, auto-crop-retry."""

import io
from datetime import timedelta

from PIL import Image
from sqlalchemy import func, select

from app.config import get_settings
from app.imaging.engine import ModerationError, PlacedPreview
from app.models import BodyPhoto, Design, JobStatus, Preview, UsageLedger, User, _now
from app.storage import get_storage
from app.worker import run_composite, run_generation


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


class _GenBlocked:
    async def generate_design(self, spec):
        raise ModerationError("blocked")


class _CompFlaky:
    """Blocks the first composite, succeeds on the (cropped) retry."""

    def __init__(self):
        self.calls = 0

    async def composite_on_body(self, body, design, placement):
        self.calls += 1
        if self.calls == 1:
            raise ModerationError("blocked")
        return PlacedPreview(png_bytes=_png(), width=10, height=10)


class _CompBlocked:
    async def composite_on_body(self, body, design, placement):
        raise ModerationError("blocked")


async def test_generation_moderation_is_typed_and_refunded(client):
    storage = get_storage(get_settings())
    async with client._maker() as s:
        u = User()
        s.add(u)
        await s.flush()
        d = Design(user_id=u.id, prompt="x")
        s.add(d)
        await s.flush()
        s.add(UsageLedger(user_id=u.id, delta=1, reason="generation", design_id=d.id))
        await s.commit()
        did, uid = d.id, u.id

        await run_generation(did, s, storage, _GenBlocked())

        failed = await s.get(Design, did)
        assert failed.status == JobStatus.FAILED
        assert failed.error == "moderation_blocked"
        net = await s.scalar(
            select(func.coalesce(func.sum(UsageLedger.delta), 0)).where(
                UsageLedger.user_id == uid
            )
        )
        assert net == 0  # unit consumed then refunded


async def _make_preview_row(s, storage) -> str:
    u = User()
    s.add(u)
    await s.flush()
    d = Design(user_id=u.id, prompt="x", status=JobStatus.DONE, clean_png_url="u")
    s.add(d)
    await s.flush()
    await storage.put(f"designs/{d.id}.png", _png(), "image/png")
    body = BodyPhoto(
        user_id=u.id, storage_ref=f"bodies/{d.id}.png", expires_at=_now() + timedelta(hours=24)
    )
    s.add(body)
    await s.flush()
    await storage.put(body.storage_ref, _png(), "image/png")
    p = Preview(
        design_id=d.id,
        body_photo_id=body.id,
        x_pct=0.5,
        y_pct=0.5,
        scale=0.3,
        rotation=0.0,
        expires_at=_now() + timedelta(hours=24),
    )
    s.add(p)
    await s.commit()
    return p.id


async def test_composite_auto_crop_retry_recovers(client):
    storage = get_storage(get_settings())
    async with client._maker() as s:
        pid = await _make_preview_row(s, storage)
        engine = _CompFlaky()
        await run_composite(pid, s, storage, engine)
        done = await s.get(Preview, pid)
        assert engine.calls == 2  # first blocked, retried on the crop
        assert done.status == JobStatus.DONE
        assert done.output_url


async def test_composite_moderation_typed_when_retry_also_blocked(client):
    storage = get_storage(get_settings())
    async with client._maker() as s:
        pid = await _make_preview_row(s, storage)
        await run_composite(pid, s, storage, _CompBlocked())
        failed = await s.get(Preview, pid)
        assert failed.status == JobStatus.FAILED
        assert failed.error == "moderation_blocked"
