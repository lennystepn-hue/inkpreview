"""Deterministic stand-in image engine.

Builds real PNGs with Pillow so the entire pipeline (jobs, storage, watermark,
composite, frontend) is exercisable with no API key and no spend. Output is
obviously placeholder art — styled enough to validate layout/flow, not to ship.
"""

import io

from PIL import Image, ImageDraw

from app.imaging.engine import CleanDesign, GenSpec, ImageEngine, PlacedPreview, Placement

# Acid-Ink accent palette (R,G,B) cycled across variants.
_ACCENTS = [
    (198, 255, 0),  # acid lime
    (0, 229, 255),  # electric cyan
    (255, 0, 153),  # hot magenta
    (167, 139, 250),  # uv violet
]

_DESIGN_SIZE = 1024


def _wrap(text: str, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        candidate = f"{cur} {w}".strip()
        if len(candidate) > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = candidate
    if cur:
        lines.append(cur)
    return lines[:6]


class MockImageEngine(ImageEngine):
    async def generate_design(self, spec: GenSpec) -> list[CleanDesign]:
        out: list[CleanDesign] = []
        for i in range(max(1, spec.n)):
            accent = _ACCENTS[i % len(_ACCENTS)]
            img = Image.new("RGBA", (_DESIGN_SIZE, _DESIGN_SIZE), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            m = int(_DESIGN_SIZE * 0.10)  # keep corners transparent
            # framed "flash" placeholder
            draw.rounded_rectangle(
                [m, m, _DESIGN_SIZE - m, _DESIGN_SIZE - m],
                radius=48,
                outline=accent + (255,),
                width=10,
            )
            draw.ellipse(
                [m * 2, m * 2, _DESIGN_SIZE - m * 2, _DESIGN_SIZE - m * 2],
                outline=accent + (180,),
                width=4,
            )
            label = f"{spec.prompt}"
            sub = " / ".join(spec.style_slugs) or "no-style"
            tag = f"variant {i + 1} - {'color' if spec.color else 'b&w'}"
            lines = _wrap(label, 18)
            y = _DESIGN_SIZE // 2 - (len(lines) * 44) // 2 - 60
            for ln in lines:
                draw.text((_DESIGN_SIZE // 2, y), ln, fill=accent + (255,), anchor="mm")
                y += 44
            draw.text(
                (_DESIGN_SIZE // 2, _DESIGN_SIZE // 2 + 120),
                sub,
                fill=(255, 255, 255, 220),
                anchor="mm",
            )
            draw.text(
                (_DESIGN_SIZE // 2, _DESIGN_SIZE - m - 30),
                tag,
                fill=(255, 255, 255, 160),
                anchor="mm",
            )
            buf = io.BytesIO()
            img.save(buf, "PNG")
            out.append(CleanDesign(png_bytes=buf.getvalue(), width=img.width, height=img.height))
        return out

    async def composite_on_body(
        self, body_png: bytes, design_png: bytes, placement: Placement
    ) -> PlacedPreview:
        body = Image.open(io.BytesIO(body_png)).convert("RGBA")
        design = Image.open(io.BytesIO(design_png)).convert("RGBA")

        target_w = max(1, int(body.width * placement.scale))
        ratio = target_w / design.width
        target_h = max(1, int(design.height * ratio))
        design = design.resize((target_w, target_h), Image.LANCZOS)
        if placement.rotation:
            design = design.rotate(-placement.rotation, expand=True, resample=Image.BICUBIC)

        tw, th = design.size
        cx = int(body.width * placement.x_pct)
        cy = int(body.height * placement.y_pct)
        x = max(0, min(body.width - tw, cx - tw // 2))
        y = max(0, min(body.height - th, cy - th // 2))

        # slight transparency to fake "on skin" for the placeholder
        faded = design.copy()
        alpha = faded.getchannel("A").point(lambda a: int(a * 0.85))
        faded.putalpha(alpha)

        body.alpha_composite(faded, (x, y))
        out = body.convert("RGB")
        buf = io.BytesIO()
        out.save(buf, "PNG")
        return PlacedPreview(png_bytes=buf.getvalue(), width=out.width, height=out.height)

    async def enhance_prompt(self, prompt: str, style_slugs: list[str]) -> str:
        styles = ", ".join(style_slugs) if style_slugs else "tattoo"
        return (
            f"{prompt}, rendered as a {styles} tattoo design — clean confident linework, "
            f"balanced composition, high contrast, crisp edges, isolated on a transparent "
            f"background, stencil-ready, professional flash sheet quality"
        )
