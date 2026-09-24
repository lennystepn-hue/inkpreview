/**
 * Turn user input + style recipes into generation / composite prompts — a
 * verbatim port of backend/app/imaging/prompts.py (the wording is tuned; keep
 * it identical).
 */

import { type GenSpec, type Placement } from "./engine";
import { type StyleRecipe, getRecipe } from "../styles/catalog";

// "medium" is the default and means "no explicit cue" — leaving it out lets the
// model match the complexity/weight to the subject.
const LINE_WEIGHT: Record<string, string> = {
  thin: "thin delicate linework",
  medium: "",
  bold: "bold heavy linework",
};
const COMPLEXITY: Record<string, string> = {
  simple: "simple and minimal, just a few clean lines",
  medium: "",
  detailed: "highly detailed and intricate",
};

export function sizeWord(scale: number): string {
  if (scale < 0.22) return "small";
  if (scale < 0.4) return "medium-sized";
  if (scale < 0.6) return "large";
  return "very large";
}

const DEFAULT_BASE =
  "isolated and centered, no skin, no body part, no photographic background, " +
  "no watermark, no frame, no text";

function resolveStyles(slugs: string[]): StyleRecipe[] {
  return slugs.map((s) => getRecipe(s)).filter((r): r is StyleRecipe => r !== undefined);
}

export function buildGenerationPrompt(spec: GenSpec, recipes?: StyleRecipe[]): string {
  recipes = recipes ?? resolveStyles(spec.style_slugs);
  const parts: string[] = [`A tattoo design of ${spec.prompt.trim()}.`];

  if (recipes.length) {
    parts.push("Style: " + recipes.map((r) => r.name).join(", ") + ".");
    const pos = recipes.filter((r) => r.positive_cues).map((r) => r.positive_cues).join("; ");
    if (pos) parts.push(pos + ".");
  }

  parts.push(spec.color ? "vivid saturated color" : "black and grey, no color");
  parts.push(LINE_WEIGHT[spec.line_weight] ?? "");
  parts.push(COMPLEXITY[spec.complexity] ?? "");
  parts.push(recipes.length ? recipes[0].base_qualifiers : DEFAULT_BASE);

  const negs = recipes.filter((r) => r.negative_cues).map((r) => r.negative_cues).join("; ");
  if (negs) parts.push(`Avoid: ${negs}.`);

  return parts.filter((p) => p).join(" ").trim();
}

const COMPOSITE_BEFORE_SIZE = "You are compositing a realistic tattoo onto a body photo. You are given THREE images of the SAME scene. Use each ONLY for its stated role.\n\n(1) PLACEMENT GUIDE: the body photo with the tattoo design pre-pasted as flat black lines at the EXACT position, size, and rotation/tilt the finished tattoo must have (a ";
const COMPOSITE_AFTER_SIZE = " tattoo). This image is the SINGLE source of truth for the tattoo's location, scale, and angle. Do NOT take position, size, or angle from any other image. Its flatness, its hard edges, and the fact that it paints straight over everything (including fingers, hands, clothing, and hair that are actually in front of the skin) are DELIBERATELY WRONG and are NOT how the result should look — do not copy that flat layering.\n\n(2) CLEAN DESIGN: the same artwork as crisp black line art on white. Use this ONLY to reproduce the exact linework, shapes, and fine detail. Ignore its white background, its framing, and its upright orientation; take no position, size, or angle from it.\n\n(3) ORIGINAL PHOTO: the identical scene with NO overlay, fully untouched. Use this ONLY as the truth for the real scene — real skin tone, real lighting and shadows, the 3D curvature of the body part, EXISTING tattoos already inked on the skin, moles, freckles, scars, and, critically, which pixels are objects physically IN FRONT of the skin (fingers, hands, fingernails, a thumb resting on the limb, clothing, fabric, straps, hair, jewelry, or another limb). Do NOT take position or framing as a license to re-place the tattoo from this image.\n\nTASK: Produce a photorealistic version of the ORIGINAL PHOTO (3) with the design from (2) applied as a REAL tattoo inked INTO the skin at the precise placement shown in the PLACEMENT GUIDE (1) — pigment sitting just beneath the top layer of skin, not a sticker, decal, or print laid on top.\n\nGEOMETRY LOCK (highest priority — obey before anything else): Reproduce the tattoo at the IDENTICAL center point, size, scale, and rotation/tilt angle shown in the PLACEMENT GUIDE (1). The motif's center, its width, and its angle must match image (1) exactly. Do NOT move, recenter, straighten, level, rotate, re-orient, resize, scale, crop, zoom, mirror, flip, simplify, or redesign the motif. If image (1) shows it tilted, keep that exact tilt. Reproduce the full motif from image (2), complete — never omit, shrink, or relocate it to avoid an obstacle. NONE of the instructions below are permission to relocate, shrink, enlarge, rotate, straighten, or omit the tattoo; they only change how the ink is RENDERED, never where it is or how big it is.\n\nEXISTING SKIN FEATURES (non-negotiable): If the ORIGINAL PHOTO (3) shows any EXISTING tattoos, they are permanent parts of this person's skin — reproduce every existing tattoo pixel-faithful in the result: same artwork, same position, same colors, same aging. NEVER remove, erase, fade, blur, lighten, 'clean up', redraw, or replace an existing tattoo, and never treat the skin as if it were blank. The NEW tattoo is ADDED to the skin alongside what is already there; the result shows BOTH. If the new design's footprint overlaps an existing tattoo, the new ink is simply inked over/across it the way a real artist would layer it, and the existing tattoo remains fully visible everywhere outside the new design's actual strokes. The same applies to moles, freckles, birthmarks, and scars: keep them all; where they fall inside the new tattoo they remain subtly visible beneath the fresh ink, exactly as on real skin.\n\nYou will perform exactly two render-only transformations and nothing else:\n\nA) OCCLUSION (the most important fix — subtractive, erase-where-covered only): The ink lives on the SKIN SURFACE, BEHIND anything physically in front of that skin. Compare the PLACEMENT GUIDE (1) against the ORIGINAL PHOTO (3): wherever the guide painted lines over an object that the ORIGINAL PHOTO shows resting on or hovering over the skin — a finger, hand, fingernail, thumb, clothing, fabric, strap, hair, jewelry, or another limb — that object stays fully IN FRONT and COVERS the ink. In those covered regions, remove the ink and show the original object on top, pixel-identical to image (3): same shape, color, texture, and edges, including the soft contact shadow it casts onto the skin. Paint NO ink onto fingers, nails, hands, fabric, hair, or jewelry. The tattoo lines must break cleanly at the silhouette edge of each occluder and continue on the bare skin on the far side, exactly as a real tattoo would when a hand rests across it. This is a local erase-where-covered operation: it must NOT shift, shrink, rotate, or move the rest of the tattoo — the visible ink stays exactly where image (1) shows it. The ink is not deleted, only hidden: it continues underneath the obstruction and would be revealed if the obstruction moved. For semi-transparent occluders (sheer fabric, thin wisps of hair), let the ink show faintly through them rather than vanish. On every bare-skin patch inside the footprint, reproduce the FULL design — do not under-ink or leave it faint.\n\nB) INTEGRATION (render in place on bare skin only): Where the ink IS visible on bare skin, make it read as real tattoo under the skin surface without moving it. Gently bow the linework over the rounded limb so straight lines curve to follow the body's contour — wrap it to the surface, riding over the pores, fine creases, and tendons present in image (3) — but do NOT warp the motif's proportions or distort its shapes. Light the ink with the SAME single light field as image (3): the same light direction, shadows, and highlights; where the skin is in shadow the ink is correspondingly darker and muted, where light grazes the skin or a highlight falls the ink lifts and catches that same sheen. The ink must never look brighter, flatter, or more saturated than the surrounding skin. The pigment sits just beneath the skin with believable saturation and settling, edges slightly diffused as ink settles into skin, a subtle skin-sheen overlay over the lines, and subtle pore/skin texture showing through — never a hard crisp decal floating above the surface. The ink takes faint color from the skin tone; it is never pure flat black on top. Keep every line at the same place, scale, and angle as image (1) — bend it onto the surface, do not relocate it.\n\nEverything else in the photo must remain identical to the ORIGINAL PHOTO (3): same person, same pose, same hands and fingers, same clothing, same hair, same background, same lighting, same framing and crop, and the SAME existing tattoos, moles, freckles, and scars. Output only the finished photo, correctly occluded by anything in front of it and naturally integrated into the skin.";

/**
 * Prompt for the THREE-image composite edit: (1) placement guide (geometry
 * authority), (2) clean line art (linework reference), (3) untouched original
 * photo (occlusion + lighting ground truth).
 */
export function buildCompositePrompt(placement: Placement): string {
  return COMPOSITE_BEFORE_SIZE + sizeWord(placement.scale) + COMPOSITE_AFTER_SIZE;
}
