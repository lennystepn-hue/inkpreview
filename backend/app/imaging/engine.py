"""The image-engine contract.

The whole pipeline talks to this Protocol, never to a concrete provider. Two
implementations exist: ``MockImageEngine`` (deterministic stand-in art, no key,
no spend — used for dev + tests) and ``OpenAIImageEngine`` (real, wired in P5).

The clean design produced by ``generate_design`` is CANONICAL: it is what the
tattoo artist receives and is never round-tripped through ``composite_on_body``.
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


class ModerationError(Exception):
    """The provider's safety system rejected the prompt or image.

    Distinct from a transient/technical failure: the caller turns this into a
    typed, user-facing message (and, for composites, an auto-crop retry) rather
    than a generic 'generation failed'.
    """


@dataclass(frozen=True)
class GenSpec:
    prompt: str
    style_slugs: list[str] = field(default_factory=list)
    color: bool = True
    line_weight: str = "medium"  # thin | medium | bold
    complexity: str = "medium"  # simple | medium | detailed
    n: int = 1


@dataclass(frozen=True)
class CleanDesign:
    png_bytes: bytes  # transparent-background PNG (canonical)
    width: int
    height: int


@dataclass(frozen=True)
class Placement:
    x_pct: float  # 0..1 tapped point on the body photo (center of the tattoo)
    y_pct: float
    scale: float = 0.30  # free: fraction of the body-photo width the tattoo occupies
    rotation: float = 0.0  # free: degrees, clockwise


@dataclass(frozen=True)
class PlacedPreview:
    png_bytes: bytes
    width: int
    height: int


@runtime_checkable
class ImageEngine(Protocol):
    async def generate_design(self, spec: GenSpec) -> list[CleanDesign]:
        """Generate one or more clean, transparent-background tattoo designs."""
        ...

    async def composite_on_body(
        self, body_png: bytes, design_png: bytes, placement: Placement
    ) -> PlacedPreview:
        """Place the (untouched) design realistically onto the body photo."""

    async def enhance_prompt(self, prompt: str, style_slugs: list[str]) -> str:
        """Expand a terse prompt into a rich, style-aware generation prompt."""
