from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import User
from app.schemas import QuotaOut, SessionOut, UserOut
from app.services import quota
from app.session_auth import current_user, extract_token, issue_token, read_user_id

router = APIRouter(prefix="/api", tags=["session"])


@router.post("/session", response_model=SessionOut)
async def create_session(
    authorization: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    session: AsyncSession = Depends(get_session),
) -> SessionOut:
    """Idempotent: a valid token returns the same session; otherwise a new anon user."""
    token = extract_token(authorization, x_session_token)
    if token:
        uid = read_user_id(token)
        if uid:
            existing = await session.get(User, uid)
            if existing:
                return SessionOut(
                    token=token,
                    user_id=existing.id,
                    credits=existing.credits,
                    plan=existing.plan,
                    is_anonymous=existing.is_anonymous,
                    email=existing.email,
                    name=existing.name,
                    avatar_url=existing.avatar_url,
                )

    user = User()
    session.add(user)
    await session.commit()
    return SessionOut(
        token=issue_token(user.id),
        user_id=user.id,
        credits=user.credits,
        plan=user.plan,
        is_anonymous=user.is_anonymous,
    )


@router.get("/session/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(
        user_id=user.id,
        credits=user.credits,
        plan=user.plan,
        is_anonymous=user.is_anonymous,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        brand_name=user.brand_name,
    )


@router.get("/usage", response_model=QuotaOut)
async def usage(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> QuotaOut:
    """Live generation quota for the current user — drives the meter/paywall."""
    s = await quota.usage_status(session, user)
    return QuotaOut(
        plan=s.plan,
        period=s.period,
        limit=s.limit,
        used=s.used,
        remaining=s.remaining,
        reset_at=s.reset_at,
        promo=get_settings().promo_unlimited,
    )
