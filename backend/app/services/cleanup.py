"""Ephemeral-data sweeper: delete expired body photos + previews (rows + objects).

Body photos are sensitive (intimate body parts) — we keep them no longer than
necessary (config TTL). Previews are derived from them and expire too.
"""

from sqlalchemy import select

from app.models import BodyPhoto, Preview, _now
from app.storage import Storage


async def sweep_expired(session, storage: Storage) -> int:
    now = _now()
    deleted = 0

    previews = (
        await session.execute(select(Preview).where(Preview.expires_at < now))
    ).scalars().all()
    for p in previews:
        try:
            await storage.delete(f"ephemeral/preview/{p.id}.png")
        except Exception:  # noqa: BLE001 — best-effort object delete
            pass
        await session.delete(p)
        deleted += 1

    bodies = (
        await session.execute(select(BodyPhoto).where(BodyPhoto.expires_at < now))
    ).scalars().all()
    for b in bodies:
        if b.storage_ref:
            try:
                await storage.delete(b.storage_ref)
            except Exception:  # noqa: BLE001
                pass
        await session.delete(b)
        deleted += 1

    await session.commit()
    return deleted
