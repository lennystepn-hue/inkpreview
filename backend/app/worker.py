"""Image job execution + dispatch.

Three job modes (config ``JOB_MODE``):
- ``inline``   — run in-request (default; instant with the mock engine, used by tests)
- ``background`` — fire-and-forget asyncio task (real OpenAI locally, no Redis)
- ``arq``      — enqueue to Redis for the worker process (prod)

``run_generation`` is pure given its deps (session/storage/engine), so it is the
same code path in every mode.
"""

import asyncio
import contextlib

from arq.connections import RedisSettings

from app.config import Settings, assert_secure_prod, get_settings
from app.db import SessionLocal
from app.imaging.engine import GenSpec, ModerationError, Placement
from app.imaging.factory import get_engine
from app.imaging.processing import crop_around_placement, make_thumbnail
from app.models import BodyPhoto, Design, JobStatus, Preview
from app.observability import init_sentry
from app.services import quota
from app.storage import Storage, get_storage


async def _fail_design(session, design_id: str, error: str) -> None:
    """Mark a design FAILED with a (typed) error code and refund its quota unit."""
    failed = await session.get(Design, design_id)
    if failed is None:
        return
    failed.status = JobStatus.FAILED
    failed.error = error
    await session.commit()
    with contextlib.suppress(Exception):
        await quota.refund(session, user_id=failed.user_id, design_id=failed.id)


async def _fail_preview(session, preview_id: str, error: str) -> None:
    """Mark a preview FAILED (composites aren't metered, so no refund)."""
    failed = await session.get(Preview, preview_id)
    if failed is not None:
        failed.status = JobStatus.FAILED
        failed.error = error
        await session.commit()


async def run_generation(design_id: str, session, storage: Storage, engine) -> None:
    design = await session.get(Design, design_id)
    if design is None:
        return
    design.status = JobStatus.PROCESSING
    await session.commit()
    try:
        mods = design.modifiers or {}
        spec = GenSpec(
            prompt=design.prompt,
            style_slugs=list(design.styles or []),
            color=bool(mods.get("color", True)),
            line_weight=mods.get("line_weight", "medium"),
            complexity=mods.get("complexity", "medium"),
            n=1,
        )
        results = await engine.generate_design(spec)
        clean = results[0]
        url = await storage.put(f"designs/{design.id}.png", clean.png_bytes, "image/png")
        thumb_url = await storage.put(
            f"designs/{design.id}_thumb.png", make_thumbnail(clean.png_bytes), "image/png"
        )
        design.clean_png_url = url
        design.thumb_url = thumb_url
        design.width = clean.width
        design.height = clean.height
        design.status = JobStatus.DONE
        design.error = None
        await session.commit()
    except ModerationError:
        # Typed error the client maps to a clear message; quota is refunded.
        await session.rollback()
        await _fail_design(session, design_id, "moderation_blocked")
    except Exception as exc:  # noqa: BLE001 — record the failure on the row, never crash the worker
        await session.rollback()
        await _fail_design(session, design_id, str(exc)[:500])


async def run_composite(preview_id: str, session, storage: Storage, engine) -> None:
    preview = await session.get(Preview, preview_id)
    if preview is None:
        return
    preview.status = JobStatus.PROCESSING
    await session.commit()
    try:
        design = await session.get(Design, preview.design_id)
        body = await session.get(BodyPhoto, preview.body_photo_id)
        if design is None or body is None:
            raise ValueError("design or body photo missing")
        # The CANONICAL clean design is fetched untouched and composited onto the body.
        design_png = await storage.get(f"designs/{design.id}.png")
        body_png = await storage.get(body.storage_ref)
        placement = Placement(
            x_pct=preview.x_pct,
            y_pct=preview.y_pct,
            scale=preview.scale,
            rotation=preview.rotation,
        )
        try:
            result = await engine.composite_on_body(body_png, design_png, placement)
        except ModerationError:
            # Auto-crop-retry once: a tighter crop around the tapped spot often
            # excludes whatever the safety system flagged.
            cropped, cropped_placement = crop_around_placement(body_png, placement)
            result = await engine.composite_on_body(cropped, design_png, cropped_placement)
        url = await storage.put(
            f"ephemeral/preview/{preview.id}.png", result.png_bytes, "image/png"
        )
        preview.output_url = url
        preview.status = JobStatus.DONE
        preview.error = None
        await session.commit()
    except ModerationError:
        await session.rollback()
        await _fail_preview(session, preview_id, "moderation_blocked")
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        await _fail_preview(session, preview_id, str(exc)[:500])


async def _bg_generation(settings: Settings, design_id: str) -> None:
    storage = get_storage(settings)
    engine = get_engine(settings)
    async with SessionLocal() as session:
        await run_generation(design_id, session, storage, engine)


async def _bg_composite(settings: Settings, preview_id: str) -> None:
    storage = get_storage(settings)
    engine = get_engine(settings)
    async with SessionLocal() as session:
        await run_composite(preview_id, session, storage, engine)


async def enqueue_generation(settings: Settings, design_id: str, session) -> None:
    mode = settings.job_mode
    if mode == "inline":
        await run_generation(design_id, session, get_storage(settings), get_engine(settings))
    elif mode == "arq":
        from app.queue import get_arq_pool

        pool = await get_arq_pool(settings)
        await pool.enqueue_job("generate_task", design_id)
    else:  # background
        asyncio.create_task(_bg_generation(settings, design_id))


async def enqueue_composite(settings: Settings, preview_id: str, session) -> None:
    mode = settings.job_mode
    if mode == "inline":
        await run_composite(preview_id, session, get_storage(settings), get_engine(settings))
    elif mode == "arq":
        from app.queue import get_arq_pool

        pool = await get_arq_pool(settings)
        await pool.enqueue_job("composite_task", preview_id)
    else:  # background
        asyncio.create_task(_bg_composite(settings, preview_id))


# ───────────────────────── Arq worker (prod) ─────────────────────────
async def generate_task(ctx, design_id: str) -> None:
    await _bg_generation(get_settings(), design_id)


async def composite_task(ctx, preview_id: str) -> None:
    await _bg_composite(get_settings(), preview_id)


async def _worker_startup(ctx) -> None:
    settings = get_settings()
    assert_secure_prod(settings)
    init_sentry(settings)


class WorkerSettings:
    functions = [generate_task, composite_task]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    on_startup = _worker_startup
