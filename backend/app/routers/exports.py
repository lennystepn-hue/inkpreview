from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.imaging.watermark import ARTIST_PX, make_stencil, watermark_and_resize
from app.models import Design, Export, JobStatus, Preview, User, _uid
from app.schemas import ExportCreate, ExportOut
from app.session_auth import current_user
from app.storage import get_storage

router = APIRouter(prefix="/api", tags=["exports"])


@router.post("/exports", response_model=ExportOut, status_code=status.HTTP_201_CREATED)
async def create_export(
    payload: ExportCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Export:
    design = await session.get(Design, payload.design_id)
    if design is None or design.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Design not found")
    if design.status != JobStatus.DONE or not design.clean_png_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Design not ready yet")

    # Payment gating: free tier is watermarked + downscaled; paid (pro/studio/
    # credits) gets the ARTIST FILE — upscaled to print size (2048 px @ 300 DPI),
    # un-watermarked. Studio exports carry the studio's brand.
    paid = user.plan != "free" or user.credits > 0
    watermarked = not paid
    max_px = None if paid else settings.free_export_max_px
    upscale_to = ARTIST_PX if paid else None
    brand = user.brand_name if user.plan == "studio" else None

    storage = get_storage(settings)
    eid = _uid()

    # The artist file is ALWAYS the canonical clean design — never the body composite.
    design_png = await storage.get(f"designs/{design.id}.png")
    hires = watermark_and_resize(
        design_png, max_px=max_px, watermark=watermarked, brand=brand, upscale_to=upscale_to
    )
    hires_url = await storage.put(f"exports/{eid}_design.png", hires, "image/png")

    # Stencil-ready linework — what the studio feeds a thermal stencil printer.
    stencil = watermark_and_resize(
        make_stencil(design_png),
        max_px=max_px,
        watermark=watermarked,
        brand=brand,
        upscale_to=upscale_to,
    )
    stencil_url = await storage.put(f"exports/{eid}_stencil.png", stencil, "image/png")

    mockup_url = None
    if payload.preview_id:
        preview = await session.get(Preview, payload.preview_id)
        if preview is not None and preview.design_id == design.id and preview.output_url:
            mock_png = await storage.get(f"ephemeral/preview/{preview.id}.png")
            mock = watermark_and_resize(
                mock_png, max_px=max_px, watermark=watermarked, brand=brand
            )
            mockup_url = await storage.put(f"exports/{eid}_mockup.png", mock, "image/png")

    export = Export(
        id=eid,
        design_id=design.id,
        preview_id=payload.preview_id,
        hires_url=hires_url,
        mockup_url=mockup_url,
        stencil_url=stencil_url,
        watermarked=watermarked,
    )
    session.add(export)
    await session.commit()
    return export


@router.get("/exports/{export_id}", response_model=ExportOut)
async def get_export(
    export_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Export:
    export = await session.get(Export, export_id)
    if export is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Export not found")
    design = await session.get(Design, export.design_id)
    if design is None or design.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Export not found")
    return export
