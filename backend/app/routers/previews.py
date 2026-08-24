from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import BodyPhoto, Design, Preview, User, _now
from app.schemas import PreviewCreate, PreviewOut
from app.services.ratelimit import generation_limiter
from app.session_auth import current_user
from app.worker import enqueue_composite

router = APIRouter(prefix="/api", tags=["previews"])


async def _owned_design(session: AsyncSession, design_id: str, user: User) -> Design:
    design = await session.get(Design, design_id)
    if design is None or design.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Design not found")
    return design


@router.post("/previews", response_model=PreviewOut, status_code=status.HTTP_202_ACCEPTED)
async def create_preview(
    payload: PreviewCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Preview:
    await _owned_design(session, payload.design_id, user)
    body = await session.get(BodyPhoto, payload.body_photo_id)
    if body is None or body.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    if not generation_limiter.allow(user.id):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — please wait a moment."
        )

    preview = Preview(
        design_id=payload.design_id,
        body_photo_id=payload.body_photo_id,
        x_pct=payload.x_pct,
        y_pct=payload.y_pct,
        scale=payload.scale,
        rotation=payload.rotation,
        expires_at=_now() + timedelta(hours=settings.preview_ttl_hours),
    )
    session.add(preview)
    await session.commit()

    await enqueue_composite(settings, preview.id, session)
    await session.refresh(preview)
    return preview


@router.get("/previews/{preview_id}", response_model=PreviewOut)
async def get_preview(
    preview_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Preview:
    preview = await session.get(Preview, preview_id)
    if preview is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preview not found")
    await _owned_design(session, preview.design_id, user)  # ownership via parent design
    return preview
