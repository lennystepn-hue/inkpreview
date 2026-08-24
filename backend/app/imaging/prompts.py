"""Turn user input + style recipes into generation / composite prompts.

This is where the catalog's prompt cues become the actual instruction sent to
the image engine. Generation prompts enforce the canonical-design rules
(transparent background, no skin). Composite prompts forbid altering the motif.
"""

from app.imaging.engine import GenSpec, Placement
from app.styles.catalog import StyleRecipe, get_recipe

# "medium" is the default and means "no explicit cue" — leaving it out lets the
# model match the complexity/weight to the subject (so a minimal idea stays
# minimal and a busy one gets busy) instead of homogenising every design.
_LINE_WEIGHT = {
    "thin": "thin delicate linework",
    "medium": "",
    "bold": "bold heavy linework",
}
_COMPLEXITY = {
    "simple": "simple and minimal, just a few clean lines",
    "medium": "",
    "detailed": "highly detailed and intricate",
}
def _size_word(scale: float) -> str:
    if scale < 0.22:
        return "small"
    if scale < 0.40:
        return "medium-sized"
    if scale < 0.60:
        return "large"
    return "very large"

_DEFAULT_BASE = (
    "isolated and centered, no skin, no body part, no photographic background, "
    "no watermark, no frame, no text"
)


def _resolve_styles(slugs: list[str]) -> list[StyleRecipe]:
    return [r for r in (get_recipe(s) for s in slugs) if r is not None]


def build_generation_prompt(spec: GenSpec, recipes: list[StyleRecipe] | None = None) -> str:
    recipes = recipes if recipes is not None else _resolve_styles(spec.style_slugs)
    parts: list[str] = [f"A tattoo design of {spec.prompt.strip()}."]

    if recipes:
        parts.append("Style: " + ", ".join(r.name for r in recipes) + ".")
        pos = "; ".join(r.positive_cues for r in recipes if r.positive_cues)
        if pos:
            parts.append(pos + ".")

    parts.append("vivid saturated color" if spec.color else "black and grey, no color")
    parts.append(_LINE_WEIGHT.get(spec.line_weight, ""))
    parts.append(_COMPLEXITY.get(spec.complexity, ""))
    parts.append(recipes[0].base_qualifiers if recipes else _DEFAULT_BASE)

    negs = "; ".join(r.negative_cues for r in recipes if r.negative_cues)
    if negs:
        parts.append(f"Avoid: {negs}.")

    return " ".join(p for p in parts if p).strip()


def build_composite_prompt(placement: Placement) -> str:
    """Prompt for the THREE-image gpt-image-2 composite edit.

    Images sent (see openai_engine.composite_on_body): (1) the placement guide
    (body photo with the design pre-pasted at the exact spot — geometry authority),
    (2) the clean line art (linework reference), (3) the UNTOUCHED original photo
    (occlusion + lighting ground truth). The flattened guide destroyed the pixels of
    whatever is in front of the skin, so the original is the only truth for what must
    occlude the ink. The prompt locks geometry first, then permits exactly two
    render-only edits: subtractive occlusion (front objects cover the ink) and
    in-place integration (3D skin-wrap + scene lighting) — never a move/resize/rotate.
    """
    size = _size_word(placement.scale)
    return (
        "You are compositing a realistic tattoo onto a body photo. You are given THREE "
        "images of the SAME scene. Use each ONLY for its stated role.\n\n"
        "(1) PLACEMENT GUIDE: the body photo with the tattoo design pre-pasted as flat "
        "black lines at the EXACT position, size, and rotation/tilt the finished tattoo "
        f"must have (a {size} tattoo). This image is the SINGLE source of truth for the "
        "tattoo's location, scale, and angle. Do NOT take position, size, or angle from "
        "any other image. Its flatness, its hard edges, and the fact that it paints "
        "straight over everything (including fingers, hands, clothing, and hair that are "
        "actually in front of the skin) are DELIBERATELY WRONG and are NOT how the result "
        "should look — do not copy that flat layering.\n\n"
        "(2) CLEAN DESIGN: the same artwork as crisp black line art on white. Use this "
        "ONLY to reproduce the exact linework, shapes, and fine detail. Ignore its white "
        "background, its framing, and its upright orientation; take no position, size, or "
        "angle from it.\n\n"
        "(3) ORIGINAL PHOTO: the identical scene with NO overlay, fully untouched. Use "
        "this ONLY as the truth for the real scene — real skin tone, real lighting and "
        "shadows, the 3D curvature of the body part, EXISTING tattoos already inked on "
        "the skin, moles, freckles, scars, and, critically, which pixels are "
        "objects physically IN FRONT of the skin (fingers, hands, fingernails, a thumb "
        "resting on the limb, clothing, fabric, straps, hair, jewelry, or another limb). "
        "Do NOT take position or framing as a license to re-place the tattoo from this "
        "image.\n\n"
        "TASK: Produce a photorealistic version of the ORIGINAL PHOTO (3) with the design "
        "from (2) applied as a REAL tattoo inked INTO the skin at the precise placement "
        "shown in the PLACEMENT GUIDE (1) — pigment sitting just beneath the top layer of "
        "skin, not a sticker, decal, or print laid on top.\n\n"
        "GEOMETRY LOCK (highest priority — obey before anything else): Reproduce the "
        "tattoo at the IDENTICAL center point, size, scale, and rotation/tilt angle shown "
        "in the PLACEMENT GUIDE (1). The motif's center, its width, and its angle must "
        "match image (1) exactly. Do NOT move, recenter, straighten, level, rotate, "
        "re-orient, resize, scale, crop, zoom, mirror, flip, simplify, or redesign the "
        "motif. If image (1) shows it tilted, keep that exact tilt. Reproduce the full "
        "motif from image (2), complete — never omit, shrink, or relocate it to avoid an "
        "obstacle. NONE of the instructions below are permission to relocate, shrink, "
        "enlarge, rotate, straighten, or omit the tattoo; they only change how the ink is "
        "RENDERED, never where it is or how big it is.\n\n"
        "EXISTING SKIN FEATURES (non-negotiable): If the ORIGINAL PHOTO (3) shows any "
        "EXISTING tattoos, they are permanent parts of this person's skin — reproduce "
        "every existing tattoo pixel-faithful in the result: same artwork, same position, "
        "same colors, same aging. NEVER remove, erase, fade, blur, lighten, 'clean up', "
        "redraw, or replace an existing tattoo, and never treat the skin as if it were "
        "blank. The NEW tattoo is ADDED to the skin alongside what is already there; the "
        "result shows BOTH. If the new design's footprint overlaps an existing tattoo, "
        "the new ink is simply inked over/across it the way a real artist would layer it, "
        "and the existing tattoo remains fully visible everywhere outside the new design's "
        "actual strokes. The same applies to moles, freckles, birthmarks, and scars: keep "
        "them all; where they fall inside the new tattoo they remain subtly visible "
        "beneath the fresh ink, exactly as on real skin.\n\n"
        "You will perform exactly two render-only transformations and nothing else:\n\n"
        "A) OCCLUSION (the most important fix — subtractive, erase-where-covered only): "
        "The ink lives on the SKIN SURFACE, BEHIND anything physically in front of that "
        "skin. Compare the PLACEMENT GUIDE (1) against the ORIGINAL PHOTO (3): wherever the "
        "guide painted lines over an object that the ORIGINAL PHOTO shows resting on or "
        "hovering over the skin — a finger, hand, fingernail, thumb, clothing, fabric, "
        "strap, hair, jewelry, or another limb — that object stays fully IN FRONT and "
        "COVERS the ink. In those covered regions, remove the ink and show the original "
        "object on top, pixel-identical to image (3): same shape, color, texture, and "
        "edges, including the soft contact shadow it casts onto the skin. Paint NO ink "
        "onto fingers, nails, hands, fabric, hair, or jewelry. The tattoo lines must break "
        "cleanly at the silhouette edge of each occluder and continue on the bare skin on "
        "the far side, exactly as a real tattoo would when a hand rests across it. This is "
        "a local erase-where-covered operation: it must NOT shift, shrink, rotate, or move "
        "the rest of the tattoo — the visible ink stays exactly where image (1) shows it. "
        "The ink is not deleted, only hidden: it continues underneath the obstruction and "
        "would be revealed if the obstruction moved. For semi-transparent occluders (sheer "
        "fabric, thin wisps of hair), let the ink show faintly through them rather than "
        "vanish. On every bare-skin patch inside the footprint, reproduce the FULL design "
        "— do not under-ink or leave it faint.\n\n"
        "B) INTEGRATION (render in place on bare skin only): Where the ink IS visible on "
        "bare skin, make it read as real tattoo under the skin surface without moving it. "
        "Gently bow the linework over the rounded limb so straight lines curve to follow "
        "the body's contour — wrap it to the surface, riding over the pores, fine creases, "
        "and tendons present in image (3) — but do NOT warp the motif's proportions or "
        "distort its shapes. Light the ink with the SAME single light field as image (3): "
        "the same light direction, shadows, and highlights; where the skin is in shadow the "
        "ink is correspondingly darker and muted, where light grazes the skin or a "
        "highlight falls the ink lifts and catches that same sheen. The ink must never look "
        "brighter, flatter, or more saturated than the surrounding skin. The pigment sits "
        "just beneath the skin with believable saturation and settling, edges slightly "
        "diffused as ink settles into skin, a subtle skin-sheen overlay over the lines, and "
        "subtle pore/skin texture showing through — never a hard crisp decal floating above "
        "the surface. The ink takes faint color from the skin tone; it is never pure flat "
        "black on top. Keep every line at the same place, scale, and angle as image (1) — "
        "bend it onto the surface, do not relocate it.\n\n"
        "Everything else in the photo must remain identical to the ORIGINAL PHOTO (3): "
        "same person, same pose, same hands and fingers, same clothing, same hair, same "
        "background, same lighting, same framing and crop, and the SAME existing tattoos, "
        "moles, freckles, and scars. Output only the finished photo, "
        "correctly occluded by anything in front of it and naturally integrated into the "
        "skin."
    )
