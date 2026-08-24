"""ORM models for the core loop.

Persistence policy:
- ``designs`` are PERSISTENT (the canonical clean PNG the artist receives).
- ``body_photos`` and ``previews`` are EPHEMERAL (``expires_at`` + sweeper).
"""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


def _uid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    # OAuth identity (Google). Anonymous users have these null; on login we attach
    # them to the existing anonymous row so their designs carry over.
    google_sub: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    locale: Mapped[str] = mapped_column(String(8), default="de", nullable=False)
    # Stripe billing (Pro subscription). All null for free/anon users.
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pro_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Referral: the user id that referred this account (set once, on first sign-in).
    referred_by: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    # B2B studio tier: the studio's brand, stamped on exports instead of the
    # InkPreview watermark (only honored when plan == "studio").
    brand_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Design(Base):
    __tablename__ = "designs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    prompt: Mapped[str] = mapped_column(Text)
    enhanced_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    styles: Mapped[list] = mapped_column(JSON, default=list)
    modifiers: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default=JobStatus.QUEUED, index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    clean_png_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    thumb_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent_design_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("designs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class BodyPhoto(Base):
    __tablename__ = "body_photos"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    storage_ref: Mapped[str] = mapped_column(String(1024))
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Preview(Base):
    __tablename__ = "previews"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    design_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("designs.id", ondelete="CASCADE"), index=True
    )
    body_photo_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("body_photos.id", ondelete="CASCADE"), index=True
    )
    x_pct: Mapped[float] = mapped_column(Float)
    y_pct: Mapped[float] = mapped_column(Float)
    scale: Mapped[float] = mapped_column(Float, default=0.30)  # fraction of body width
    rotation: Mapped[float] = mapped_column(Float, default=0.0)  # degrees, clockwise
    status: Mapped[str] = mapped_column(String(16), default=JobStatus.QUEUED, index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Mockup(Base):
    """A persisted on-skin mockup, saved by a logged-in user who opted in.

    DECOUPLED from the source ``body_photo`` on purpose: the composite bytes are
    COPIED to a persistent object, and there is no FK back to the body photo —
    so the source photo (and its ``Preview``) still expire and get swept on the
    normal 24h schedule while the saved mockup lives on in the user's account.
    """

    __tablename__ = "mockups"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    design_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("designs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    output_url: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    design_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("designs.id", ondelete="CASCADE"), index=True
    )
    preview_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("previews.id", ondelete="SET NULL"), nullable=True
    )
    hires_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    mockup_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Pure-linework version for thermal stencil printers (derived from the design).
    stencil_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    watermarked: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UsageLedger(Base):
    """Append-only record of metered image generations — the cost kill-switch.

    Each billable generation writes a ``delta=+1`` row at request time; a failed
    job writes a compensating ``delta=-1`` refund. Quota used in a period is the
    SUM of deltas, so refunds and grants are all auditable from one table.
    """

    __tablename__ = "usage_ledger"
    __table_args__ = (Index("ix_usage_ledger_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # +1 = consumed a unit, -1 = refunded a unit.
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    # "generation" | "variants" | "refine" | "refund:failed" — free-form audit tag.
    reason: Mapped[str] = mapped_column(String(32), default="generation")
    # The design this entry relates to (string id, no FK so design lifecycle is
    # independent of the ledger). Used to make refunds idempotent.
    design_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class CaptureSession(Base):
    """Desktop→phone handoff: a short-lived token the phone uses to upload a body
    photo into the desktop user's session (no login needed on the phone)."""

    __tablename__ = "capture_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)  # token
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    body_photo_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("body_photos.id", ondelete="SET NULL"), nullable=True
    )
    # The design the phone overlays on its live camera (set by the desktop).
    design_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Placement the phone chose live — flows back so the desktop auto-composites.
    x_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    y_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotation: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | uploaded
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
