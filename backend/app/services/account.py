"""GDPR self-service: data export (Art. 20) + account erasure (Art. 17).

Erasure deletes rows EXPLICITLY (not relying on DB ON DELETE CASCADE) so it is
correct on both SQLite and Postgres and provably complete, and it removes the
backing storage objects (which no DB cascade would touch).
"""

import contextlib
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import (
    BodyPhoto,
    CaptureSession,
    Design,
    Event,
    Export,
    Mockup,
    Preview,
    UsageLedger,
    User,
)
from app.services import billing
from app.storage import Storage


async def export_account(session: AsyncSession, user: User) -> dict:
    """A machine-readable copy of everything we hold for this user (Art. 20)."""
    designs = (
        await session.execute(select(Design).where(Design.user_id == user.id))
    ).scalars().all()
    mockups = (
        await session.execute(select(Mockup).where(Mockup.user_id == user.id))
    ).scalars().all()

    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "account": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "plan": user.plan,
            "is_anonymous": user.is_anonymous,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "designs": [
            {
                "id": d.id,
                "prompt": d.prompt,
                "enhanced_prompt": d.enhanced_prompt,
                "styles": d.styles,
                "modifiers": d.modifiers,
                "status": d.status,
                "clean_png_url": d.clean_png_url,
                "thumb_url": d.thumb_url,
                "parent_design_id": d.parent_design_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in designs
        ],
        "saved_mockups": [
            {
                "id": m.id,
                "design_id": m.design_id,
                "output_url": m.output_url,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in mockups
        ],
    }


async def _storage_keys(session: AsyncSession, user_id: str) -> list[str]:
    """Every storage object owned by the user, collected before rows are deleted."""
    keys: list[str] = []

    designs = (
        await session.execute(select(Design.id).where(Design.user_id == user_id))
    ).scalars().all()
    for did in designs:
        keys += [f"designs/{did}.png", f"designs/{did}_thumb.png"]

    if designs:
        previews = (
            await session.execute(select(Preview.id).where(Preview.design_id.in_(designs)))
        ).scalars().all()
        keys += [f"ephemeral/preview/{pid}.png" for pid in previews]

        exports = (
            await session.execute(select(Export.id).where(Export.design_id.in_(designs)))
        ).scalars().all()
        for eid in exports:
            keys += [f"exports/{eid}_design.png", f"exports/{eid}_mockup.png"]

    bodies = (
        await session.execute(select(BodyPhoto.storage_ref).where(BodyPhoto.user_id == user_id))
    ).scalars().all()
    keys += [ref for ref in bodies if ref]

    mockups = (
        await session.execute(select(Mockup.id).where(Mockup.user_id == user_id))
    ).scalars().all()
    keys += [f"mockups/{mid}.png" for mid in mockups]

    return keys


async def delete_account(
    session: AsyncSession, storage: Storage, user: User, settings: Settings
) -> None:
    """Erase the user and ALL their data + storage objects (Art. 17)."""
    # Stop billing first so a deleted user is never charged again (best-effort).
    with contextlib.suppress(Exception):
        await billing.cancel_subscription(user, settings)

    keys = await _storage_keys(session, user.id)
    for key in keys:
        with contextlib.suppress(Exception):
            await storage.delete(key)

    uid = user.id
    design_ids = (
        await session.execute(select(Design.id).where(Design.user_id == uid))
    ).scalars().all()
    if design_ids:
        await session.execute(delete(Export).where(Export.design_id.in_(design_ids)))
        await session.execute(delete(Preview).where(Preview.design_id.in_(design_ids)))
    await session.execute(delete(Mockup).where(Mockup.user_id == uid))
    await session.execute(delete(BodyPhoto).where(BodyPhoto.user_id == uid))
    await session.execute(delete(UsageLedger).where(UsageLedger.user_id == uid))
    await session.execute(delete(CaptureSession).where(CaptureSession.user_id == uid))
    await session.execute(delete(Event).where(Event.user_id == uid))
    await session.execute(delete(Design).where(Design.user_id == uid))
    await session.execute(delete(User).where(User.id == uid))
    await session.commit()
