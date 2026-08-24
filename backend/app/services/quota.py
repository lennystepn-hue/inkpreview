"""Durable per-user generation quota — the cost kill-switch.

One unit = one generated design image. Units are consumed at REQUEST time (before
the expensive OpenAI job runs) so concurrent requests can't slip past the cap, and
refunded if the job fails. All movement is recorded in ``usage_ledger`` as signed
deltas; usage in a period is the SUM of those deltas.

Tiers:
- anonymous guest .......... lifetime cap (``guest_generation_limit``, default 2)
- logged-in free ........... per-calendar-month cap (``free_monthly_generation_limit``, default 10)
- pro ...................... unlimited (recorded for analytics, never blocked)
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import UsageLedger, User


class QuotaExceeded(Exception):
    """Raised by :func:`consume` when a request would exceed the user's cap."""

    def __init__(self, status: "QuotaStatus") -> None:
        self.status = status
        super().__init__(f"quota exceeded: {status.used}/{status.limit}")


@dataclass
class QuotaStatus:
    plan: str
    period: str  # "lifetime" | "month"
    limit: int | None  # None == unlimited
    used: int
    remaining: int | None  # None == unlimited
    reset_at: datetime | None  # start of next month; None if lifetime/unlimited


def _plan_quota(user: User) -> tuple[int | None, str]:
    """(effective limit, period) for a user. limit None == unlimited.

    Referral/bonus ``credits`` are added on top of the plan's base allowance.
    """
    settings = get_settings()
    if settings.promo_unlimited:  # launch promo: everyone unlimited (still ledgered)
        return None, "month"
    if user.plan in ("pro", "studio"):  # studio (B2B) is unlimited like Pro
        return None, "month"
    bonus = max(0, user.credits or 0)
    if user.is_anonymous:
        return settings.guest_generation_limit + bonus, "lifetime"
    return settings.free_monthly_generation_limit + bonus, "month"


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _next_month_start(now: datetime) -> datetime:
    year, month = (now.year + 1, 1) if now.month == 12 else (now.year, now.month + 1)
    return now.replace(
        year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0
    )


async def _used(session: AsyncSession, user_id: str, period_start: datetime | None) -> int:
    stmt = select(func.coalesce(func.sum(UsageLedger.delta), 0)).where(
        UsageLedger.user_id == user_id
    )
    if period_start is not None:
        stmt = stmt.where(UsageLedger.created_at >= period_start)
    return int(await session.scalar(stmt) or 0)


async def usage_status(session: AsyncSession, user: User) -> QuotaStatus:
    now = datetime.now(UTC)
    limit, period = _plan_quota(user)
    period_start = _month_start(now) if period == "month" else None
    used = await _used(session, user.id, period_start)
    remaining = None if limit is None else max(0, limit - used)
    reset_at = _next_month_start(now) if (period == "month" and limit is not None) else None
    return QuotaStatus(
        plan=user.plan,
        period=period,
        limit=limit,
        used=used,
        remaining=remaining,
        reset_at=reset_at,
    )


async def consume(
    session: AsyncSession,
    user: User,
    *,
    design_ids: list[str],
    reason: str = "generation",
) -> QuotaStatus:
    """Reserve ``len(design_ids)`` units for ``user`` or raise :class:`QuotaExceeded`.

    Locks the user row (``FOR UPDATE`` on Postgres; no-op on SQLite) so concurrent
    requests from the same user can't both pass the check. Adds ledger rows but does
    NOT commit — the caller commits together with the designs so the two are atomic.
    """
    n = len(design_ids)
    limit, period = _plan_quota(user)
    if limit is not None:
        # Serialize this user's quota check against concurrent requests.
        await session.execute(select(User.id).where(User.id == user.id).with_for_update())
        period_start = _month_start(datetime.now(UTC)) if period == "month" else None
        used = await _used(session, user.id, period_start)
        if used + n > limit:
            raise QuotaExceeded(await usage_status(session, user))
    for did in design_ids:
        session.add(UsageLedger(user_id=user.id, delta=1, reason=reason, design_id=did))
    return await usage_status(session, user)


async def refund(
    session: AsyncSession,
    *,
    user_id: str,
    design_id: str,
    reason: str = "refund:failed",
) -> bool:
    """Credit back one unit for a failed design. Idempotent: only refunds if the
    design has a net positive consumption (a consume with no matching refund).
    Commits on success. Returns True if a refund was written."""
    net = int(
        await session.scalar(
            select(func.coalesce(func.sum(UsageLedger.delta), 0)).where(
                UsageLedger.design_id == design_id
            )
        )
        or 0
    )
    if net <= 0:
        return False
    session.add(
        UsageLedger(user_id=user_id, delta=-1, reason=reason, design_id=design_id)
    )
    await session.commit()
    return True
