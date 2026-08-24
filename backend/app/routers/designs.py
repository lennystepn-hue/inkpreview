from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Design, JobStatus, User
from app.schemas import DesignCreate, DesignOut, FeedItemOut
from app.services import quota
from app.services.ratelimit import generation_limiter
from app.session_auth import current_user
from app.worker import enqueue_generation

router = APIRouter(prefix="/api", tags=["designs"])


def _quota_402(exc: quota.QuotaExceeded) -> HTTPException:
    """Map a quota overflow to HTTP 402 with a structured body the client can act on."""
    s = exc.status
    return HTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "quota_exceeded",
            "plan": s.plan,
            "limit": s.limit,
            "used": s.used,
            "remaining": s.remaining,
            "reset_at": s.reset_at.isoformat() if s.reset_at else None,
        },
    )


@router.get("/feed", response_model=list[FeedItemOut])
async def feed(
    limit: int = 24,
    session: AsyncSession = Depends(get_session),
) -> list[Design]:
    """Public 'fresh ink' feed — newest finished designs across everyone."""
    limit = max(1, min(limit, 60))
    rows = await session.execute(
        select(Design)
        .where(Design.status == JobStatus.DONE, Design.clean_png_url.is_not(None))
        .order_by(Design.created_at.desc())
        .limit(limit)
    )
    return list(rows.scalars().all())


@router.post("/designs", response_model=DesignOut, status_code=status.HTTP_202_ACCEPTED)
async def create_design(
    payload: DesignCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Design:
    if not generation_limiter.allow(user.id):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — please wait a moment."
        )
    design = Design(
        user_id=user.id,
        prompt=payload.prompt,
        styles=payload.styles,
        modifiers={
            "color": payload.color,
            "line_weight": payload.line_weight,
            "complexity": payload.complexity,
        },
    )
    session.add(design)
    await session.flush()  # assign design.id for the ledger entry
    try:
        await quota.consume(session, user, design_ids=[design.id], reason="generation")
    except quota.QuotaExceeded as exc:
        await session.rollback()
        raise _quota_402(exc) from exc
    await session.commit()

    await enqueue_generation(settings, design.id, session)
    await session.refresh(design)
    return design


@router.get("/designs", response_model=list[DesignOut])
async def list_designs(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Design]:
    rows = await session.execute(
        select(Design)
        .where(Design.user_id == user.id)
        .order_by(Design.created_at.desc())
        .limit(100)
    )
    return list(rows.scalars().all())


@router.post(
    "/designs/{design_id}/variants",
    response_model=list[DesignOut],
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_variants(
    design_id: str,
    count: int = 2,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> list[Design]:
    parent = await session.get(Design, design_id)
    if parent is None or parent.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Design not found")
    if not generation_limiter.allow(user.id):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — please wait a moment."
        )

    count = max(1, min(count, 4))
    children = [
        Design(
            user_id=user.id,
            prompt=parent.prompt,
            styles=parent.styles,
            modifiers=parent.modifiers,
            parent_design_id=parent.id,
        )
        for _ in range(count)
    ]
    session.add_all(children)
    await session.flush()  # assign child ids for the ledger
    try:
        await quota.consume(
            session, user, design_ids=[c.id for c in children], reason="variants"
        )
    except quota.QuotaExceeded as exc:
        await session.rollback()
        raise _quota_402(exc) from exc
    await session.commit()

    for child in children:
        await enqueue_generation(settings, child.id, session)
    for child in children:
        await session.refresh(child)
    return children


class RefineCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=600)


@router.post(
    "/designs/{design_id}/refine",
    response_model=DesignOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refine_design(
    design_id: str,
    payload: RefineCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Design:
    """Generate a new design from a parent + a free-text adjustment.

    Generation is text→image, so a 'refine' is a re-generation with the
    instruction appended to the parent's prompt (same styles/modifiers).
    """
    parent = await session.get(Design, design_id)
    if parent is None or parent.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Design not found")
    if not generation_limiter.allow(user.id):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — please wait a moment."
        )

    instruction = payload.prompt.strip()
    if not instruction:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty adjustment")
    combined = f"{parent.prompt.strip()}, {instruction}"

    child = Design(
        user_id=user.id,
        prompt=combined,
        styles=parent.styles,
        modifiers=parent.modifiers,
        parent_design_id=parent.id,
    )
    session.add(child)
    await session.flush()  # assign child.id for the ledger
    try:
        await quota.consume(session, user, design_ids=[child.id], reason="refine")
    except quota.QuotaExceeded as exc:
        await session.rollback()
        raise _quota_402(exc) from exc
    await session.commit()
    await enqueue_generation(settings, child.id, session)
    await session.refresh(child)
    return child


@router.get("/designs/{design_id}", response_model=DesignOut)
async def get_design(
    design_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Design:
    design = await session.get(Design, design_id)
    if design is None or design.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Design not found")
    return design
