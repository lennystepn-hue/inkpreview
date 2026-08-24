"""Saved on-skin mockups (logged-in, opt-in).

Saving COPIES the composite output to a persistent object and records a row
with no link back to the source body photo — so the photo (and its ephemeral
Preview) still expire on the normal 24h schedule while the mockup persists.
"""

import contextlib

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Design, JobStatus, Mockup, Preview, User, _uid
from app.schemas import MockupCreate, MockupOut
from app.session_auth import current_user
from app.storage import get_storage

router = APIRouter(prefix="/api/mockups", tags=["mockups"])


@router.post("", response_model=MockupOut, status_code=status.HTTP_201_CREATED)
async def save_mockup(
    payload: MockupCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Mockup:
    if user.is_anonymous:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign in to save mockups")
    preview = await session.get(Preview, payload.preview_id)
    if preview is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preview not found")
    design = await session.get(Design, preview.design_id)
    if design is None or design.user_id != user.id:  # ownership via parent design
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preview not found")
    if preview.status != JobStatus.DONE or not preview.output_url:
        raise HTTPException(status.HTTP_409_CONFLICT, "Mockup not ready")

    storage = get_storage(settings)
    src = await storage.get(f"ephemeral/preview/{preview.id}.png")
    mid = _uid()
    url = await storage.put(f"mockups/{mid}.png", src, "image/png")
    mockup = Mockup(id=mid, user_id=user.id, design_id=preview.design_id, output_url=url)
    session.add(mockup)
    await session.commit()
    await session.refresh(mockup)
    return mockup


@router.get("", response_model=list[MockupOut])
async def list_mockups(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Mockup]:
    rows = await session.execute(
        select(Mockup)
        .where(Mockup.user_id == user.id)
        .order_by(Mockup.created_at.desc())
        .limit(100)
    )
    return list(rows.scalars().all())


@router.delete("/{mockup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mockup(
    mockup_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    mockup = await session.get(Mockup, mockup_id)
    if mockup is None or mockup.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mockup not found")
    storage = get_storage(settings)
    with contextlib.suppress(Exception):
        await storage.delete(f"mockups/{mockup_id}.png")
    await session.delete(mockup)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
