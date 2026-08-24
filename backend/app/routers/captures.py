"""Desktop→phone camera handoff.

Desktop creates a capture session (token) and shows a QR for {origin}/scan/{token}.
The phone opens that page and uploads a body photo via the TOKEN-authorized
endpoint (no login on the phone) — the photo lands in the desktop user's session.
Desktop polls the status and continues to tap-to-place.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import BodyPhoto, CaptureSession, Design, User, _now
from app.routers.body_photos import store_body_photo
from app.schemas import CaptureCreate, CaptureInfoOut, CaptureOut, CaptureStatusOut
from app.session_auth import current_user
from app.storage import get_storage

router = APIRouter(prefix="/api", tags=["captures"])

_CAPTURE_TTL_MIN = 20


def _is_expired(expires: datetime) -> bool:
    # SQLite returns naive datetimes; normalize to UTC before comparing.
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    return expires < _now()


@router.post("/captures", response_model=CaptureOut, status_code=status.HTTP_201_CREATED)
async def create_capture(
    payload: CaptureCreate | None = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CaptureOut:
    design_id = payload.design_id if payload else None
    if design_id:
        # Only bind the user's OWN design (never expose someone else's via /info).
        design = await session.get(Design, design_id)
        if design is None or design.user_id != user.id:
            design_id = None
    cap = CaptureSession(
        user_id=user.id,
        design_id=design_id,
        expires_at=_now() + timedelta(minutes=_CAPTURE_TTL_MIN),
    )
    session.add(cap)
    await session.commit()
    return CaptureOut(token=cap.id)


# NO auth — the (unguessable, short-lived) token authorizes the phone to learn
# which design to overlay on its live camera.
@router.get("/captures/{token}/info", response_model=CaptureInfoOut)
async def capture_info(
    token: str,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> CaptureInfoOut:
    cap = await session.get(CaptureSession, token)
    if cap is None or _is_expired(cap.expires_at):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture link is invalid or expired")
    thumb: str | None = None
    if cap.design_id:
        design = await session.get(Design, cap.design_id)
        if design is not None and (design.thumb_url or design.clean_png_url):
            # clean_png_url/thumb_url are public /media URLs (no auth on the phone).
            thumb = design.thumb_url or design.clean_png_url
    return CaptureInfoOut(status=cap.status, design_thumb_url=thumb)


@router.get("/captures/{token}", response_model=CaptureStatusOut)
async def capture_status(
    token: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> CaptureStatusOut:
    cap = await session.get(CaptureSession, token)
    if cap is None or cap.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture not found")
    url: str | None = None
    if cap.body_photo_id:
        bp = await session.get(BodyPhoto, cap.body_photo_id)
        if bp is not None:
            url = await get_storage(settings).url(bp.storage_ref)
    return CaptureStatusOut(
        status=cap.status,
        body_photo_id=cap.body_photo_id,
        url=url,
        x_pct=cap.x_pct,
        y_pct=cap.y_pct,
        scale=cap.scale,
        rotation=cap.rotation,
    )


# NO auth — the (unguessable, short-lived) token is the authorization.
@router.post("/captures/{token}/photo", status_code=status.HTTP_201_CREATED)
async def capture_upload(
    token: str,
    file: UploadFile = File(...),
    x_pct: float | None = Form(default=None),
    y_pct: float | None = Form(default=None),
    scale: float | None = Form(default=None),
    rotation: float | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    cap = await session.get(CaptureSession, token)
    if cap is None or _is_expired(cap.expires_at):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capture link is invalid or expired")
    if cap.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This link was already used")

    bp, _ = await store_body_photo(await file.read(), cap.user_id, session, settings)
    cap.body_photo_id = bp.id
    # Placement from the phone's live-camera flow (optional) — the desktop reads
    # it on poll and auto-composites without re-positioning. Clamp to the same
    # ranges PreviewCreate enforces so a tampered phone client can't poison it.
    if None not in (x_pct, y_pct, scale, rotation):
        cap.x_pct = min(1.0, max(0.0, x_pct))
        cap.y_pct = min(1.0, max(0.0, y_pct))
        cap.scale = min(1.0, max(0.05, scale))
        cap.rotation = min(180.0, max(-180.0, rotation))
    cap.status = "uploaded"
    await session.commit()
    return {"ok": True}
