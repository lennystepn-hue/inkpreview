"""Export-file preparation: watermark/downscale (free) vs artist-grade (paid).

Paid exports get the ARTIST FILE: the clean design upscaled to print size
(Lanczos), saved with 300-DPI metadata, un-watermarked. Free exports are
downscaled + watermarked. ``make_stencil`` derives a pure-linework version a
studio can run through a thermal stencil printer.
"""

import io

from PIL import Image, ImageDraw, ImageOps

# Print target for the artist file: 2048 px @ 300 DPI ≈ 17 cm — plenty for the
# vast majority of tattoo sizes; the source line art upscales cleanly (Lanczos).
ARTIST_PX = 2048
PRINT_DPI = 300


def watermark_and_resize(
    png_bytes: bytes,
    *,
    max_px: int | None = None,
    watermark: bool = True,
    text: str = "INKPREVIEW ✦",
    brand: str | None = None,
    upscale_to: int | None = None,
) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")

    if max_px and (img.width > max_px or img.height > max_px):
        img.thumbnail((max_px, max_px), Image.LANCZOS)
    elif upscale_to and max(img.size) < upscale_to:
        ratio = upscale_to / max(img.size)
        img = img.resize(
            (round(img.width * ratio), round(img.height * ratio)), Image.LANCZOS
        )

    if brand:
        # B2B studio branding: a single subtle label in the bottom-right corner.
        label = brand.strip()[:40]
        if label:
            draw = ImageDraw.Draw(img)
            pad = max(10, img.width // 60)
            try:
                tw = draw.textlength(label)
            except Exception:  # noqa: BLE001 — older Pillow without textlength
                tw = len(label) * 6
            draw.text(
                (img.width - tw - pad, img.height - pad - 14), label, fill=(255, 255, 255, 180)
            )

    if watermark:
        layer = Image.new("RGBA", (img.width * 2, img.height * 2), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        step_x, step_y = 240, 110
        for row, y in enumerate(range(0, layer.height, step_y)):
            offset = (row % 2) * (step_x // 2)
            for x in range(-step_x, layer.width, step_x):
                draw.text((x + offset, y), text, fill=(255, 255, 255, 40))
        layer = layer.rotate(30)
        left = (layer.width - img.width) // 2
        top = (layer.height - img.height) // 2
        layer = layer.crop((left, top, left + img.width, top + img.height))
        img = Image.alpha_composite(img, layer)

    buf = io.BytesIO()
    # DPI metadata so print shops / studios get real-world sizing out of the box.
    img.save(buf, "PNG", dpi=(PRINT_DPI, PRINT_DPI))
    return buf.getvalue()


def make_stencil(png_bytes: bytes) -> bytes:
    """Derive a stencil-ready linework version of a clean black-on-white design.

    Grayscale → autocontrast → soft threshold: dark strokes go pure black, light
    shading washes out to white, with a short ramp in between so line edges stay
    smooth. Output mirrors what studios feed a thermal stencil printer.
    """
    img = Image.open(io.BytesIO(png_bytes))
    # Flatten any transparency onto white first (stencils are paper-white).
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        flat = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        flat.alpha_composite(rgba)
        img = flat
    gray = ImageOps.autocontrast(img.convert("L"))

    lo, hi = 110, 190  # below → ink, above → paper, between → smooth ramp
    lut = [
        0 if v <= lo else 255 if v >= hi else round((v - lo) * 255 / (hi - lo))
        for v in range(256)
    ]
    out = gray.point(lut).convert("RGB")

    buf = io.BytesIO()
    out.save(buf, "PNG", dpi=(PRINT_DPI, PRINT_DPI))
    return buf.getvalue()
