"""Pillow image post-processing (thumbnails + placement guide)."""

import io

from PIL import Image

from app.imaging.engine import Placement


def make_thumbnail(png_bytes: bytes, max_px: int = 512) -> bytes:
    img = Image.open(io.BytesIO(png_bytes))
    img.thumbnail((max_px, max_px), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def crop_around_placement(body_png: bytes, placement: Placement) -> tuple[bytes, Placement]:
    """Crop the body photo to a window around the tattoo spot, returning the
    cropped PNG and the placement re-expressed in the crop's coordinates.

    Used as a moderation auto-retry: a tighter crop around the limb the user
    tapped often excludes whatever the provider's safety system flagged, while
    keeping the area the tattoo actually lands on.
    """
    img = Image.open(io.BytesIO(body_png)).convert("RGB")
    w, h = img.size
    tattoo_w = max(1.0, placement.scale * w)
    cw = min(float(w), max(w * 0.5, tattoo_w * 2.5))
    ch = min(float(h), max(h * 0.5, cw * (h / w)))
    cx, cy = placement.x_pct * w, placement.y_pct * h
    left = min(max(0.0, cx - cw / 2), w - cw)
    top = min(max(0.0, cy - ch / 2), h - ch)
    box = (round(left), round(top), round(left + cw), round(top + ch))
    cropped = img.crop(box)

    buf = io.BytesIO()
    cropped.save(buf, "PNG")
    new = Placement(
        x_pct=(cx - left) / cw,
        y_pct=(cy - top) / ch,
        scale=min(0.95, tattoo_w / cw),
        rotation=placement.rotation,
    )
    return buf.getvalue(), new


def overlay_design_guide(body_png: bytes, design_png: bytes, placement: Placement) -> bytes:
    """Roughly paste the design's inked motif onto the body at the tapped point/size.

    This becomes the spatial 'guide' the image model refines into a realistic
    tattoo — it's how the model learns WHERE and HOW BIG the user wants it. The
    design's white (or transparent) background is dropped so only the ink overlays.
    """
    body = Image.open(io.BytesIO(body_png)).convert("RGBA")
    design = Image.open(io.BytesIO(design_png)).convert("RGBA")

    # near-white (or already transparent) → transparent, so only the motif shows
    design.putdata(
        [
            (r, g, b, 0) if (a == 0 or r + g + b >= 735) else (r, g, b, a)
            for (r, g, b, a) in design.getdata()
        ]
    )

    target_w = max(1, int(body.width * placement.scale))
    ratio = target_w / design.width
    target_h = max(1, int(design.height * ratio))
    design = design.resize((target_w, target_h), Image.LANCZOS)

    if placement.rotation:
        # PIL rotates counter-clockwise; user rotation is clockwise-positive.
        design = design.rotate(-placement.rotation, expand=True, resample=Image.BICUBIC)

    tw, th = design.size
    cx = int(body.width * placement.x_pct)
    cy = int(body.height * placement.y_pct)
    x = max(0, min(body.width - tw, cx - tw // 2))
    y = max(0, min(body.height - th, cy - th // 2))

    body.alpha_composite(design, (x, y))
    buf = io.BytesIO()
    body.convert("RGB").save(buf, "PNG")
    return buf.getvalue()
