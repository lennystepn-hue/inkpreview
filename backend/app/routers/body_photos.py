import hashlib
import io
from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, ImageOps
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import BodyPhoto, User, _now, _uid
from app.schemas import BodyPhotoOut
from app.session_auth import current_user
from app.storage import get_storage

router = APIRouter(prefix="/api", tags=["body"])


async def store_body_photo(
    data: bytes, user_id: str, session: AsyncSession, settings: Settings
) -> tuple[BodyPhoto, str]:
    """Validate + EXIF-strip + store a body photo (ephemeral). Reused by the
    direct upload and the phone-capture handoff."""
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Photo too large")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # honor orientation, then drop EXIF
        img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a valid image") from exc

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)  # re-encode strips all metadata
    clean = buf.getvalue()

    bid = _uid()
    key = f"ephemeral/body/{bid}.jpg"
    url = await get_storage(settings).put(key, clean, "image/jpeg")

    bp = BodyPhoto(
        id=bid,
        user_id=user_id,
        storage_ref=key,
        content_hash=hashlib.sha256(clean).hexdigest(),
        expires_at=_now() + timedelta(hours=settings.body_photo_ttl_hours),
    )
    session.add(bp)
    await session.commit()
    return bp, url


@router.post("/body-photos", response_model=BodyPhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_body_photo(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> BodyPhotoOut:
    bp, url = await store_body_photo(await file.read(), user.id, session, settings)
    return BodyPhotoOut(id=bp.id, url=url, expires_at=bp.expires_at)
