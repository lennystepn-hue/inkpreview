"""Real image engine backed by OpenAI's Images API (gpt-image-2).

- generate_design: images.generate on a clean SOLID WHITE background → the
  canonical artist file (black-on-white line art, the universal flash/stencil
  convention; no transparency needed).
- composite_on_body: images.edit with [body photo, design]; the prompt tells
  the model to ink only the motif and ignore the design's white background.
- enhance_prompt: a chat model expands a terse idea into a rich tattoo prompt.

The concrete client is injectable for testing.
"""

import base64
import io

from PIL import Image

from app.config import Settings
from app.imaging.engine import (
    CleanDesign,
    GenSpec,
    ImageEngine,
    ModerationError,
    PlacedPreview,
    Placement,
)
from app.imaging.processing import overlay_design_guide
from app.imaging.prompts import build_composite_prompt, build_generation_prompt


def _is_moderation(exc: Exception) -> bool:
    """Heuristic: did the provider reject this on safety/content-policy grounds?"""
    code = getattr(exc, "code", None) or ""
    msg = str(getattr(exc, "message", "") or exc).lower()
    return code in {"moderation_blocked", "content_policy_violation"} or any(
        k in msg
        for k in ("moderation", "safety system", "content policy", "content_policy")
    )

_ENHANCE_SYSTEM = (
    "You are a professional tattoo prompt engineer. Expand the user's idea into a single "
    "rich, vivid tattoo-design prompt (one paragraph, no preamble, no quotes). Honor the given "
    "styles. Focus on the motif, composition, and linework suitable for an image model. Do NOT "
    "mention skin, body placement, mockups, or backgrounds."
)

_WHITE_BG = (
    " Render the design on a plain solid white background — no checkerboard, no transparency "
    "pattern, no shadows, no border, no frame."
)


def _png_size(png: bytes) -> tuple[int, int]:
    return Image.open(io.BytesIO(png)).size


class OpenAIImageEngine(ImageEngine):
    def __init__(self, settings: Settings, client=None) -> None:
        self._settings = settings
        if client is None:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._client = client

    async def generate_design(self, spec: GenSpec) -> list[CleanDesign]:
        prompt = build_generation_prompt(spec) + _WHITE_BG
        try:
            resp = await self._client.images.generate(
                model=self._settings.openai_image_model,
                prompt=prompt,
                size=self._settings.openai_image_size,
                quality=self._settings.openai_image_quality,
                n=max(1, spec.n),
                output_format="png",
            )
        except Exception as exc:
            if _is_moderation(exc):
                raise ModerationError("Generation blocked by content moderation") from exc
            raise
        out: list[CleanDesign] = []
        for item in resp.data:
            png = base64.b64decode(item.b64_json)
            w, h = _png_size(png)
            out.append(CleanDesign(png_bytes=png, width=w, height=h))
        return out

    async def composite_on_body(
        self, body_png: bytes, design_png: bytes, placement: Placement
    ) -> PlacedPreview:
        # Pre-overlay the design at the tapped spot/size so the model knows WHERE
        # and HOW BIG (image 1 = geometry authority). The flattened guide paints
        # over whatever is in front of the skin, so we ALSO pass the untouched
        # original (image 3) as the occlusion + lighting ground truth — it's the
        # only signal for which pixels (fingers/hands/clothing) must cover the ink.
        guide = overlay_design_guide(body_png, design_png, placement)
        try:
            resp = await self._client.images.edit(
                model=self._settings.openai_composite_model,
                image=[
                    ("placement.png", guide, "image/png"),
                    ("design.png", design_png, "image/png"),
                    ("original.png", body_png, "image/png"),
                ],
                prompt=build_composite_prompt(placement),
                size=self._settings.openai_image_size,
                quality=self._settings.openai_composite_quality,
            )
        except Exception as exc:
            if _is_moderation(exc):
                raise ModerationError("Composite blocked by content moderation") from exc
            raise
        png = base64.b64decode(resp.data[0].b64_json)
        w, h = _png_size(png)
        return PlacedPreview(png_bytes=png, width=w, height=h)

    async def enhance_prompt(self, prompt: str, style_slugs: list[str]) -> str:
        styles = ", ".join(style_slugs) if style_slugs else "any tattoo style"
        resp = await self._client.chat.completions.create(
            model=self._settings.openai_text_model,
            messages=[
                {"role": "system", "content": _ENHANCE_SYSTEM},
                {"role": "user", "content": f"Idea: {prompt}\nStyles: {styles}"},
            ],
            temperature=0.8,
            max_tokens=220,
        )
        return (resp.choices[0].message.content or prompt).strip()
