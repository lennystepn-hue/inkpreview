/**
 * The image-engine contract. The pipeline talks to this interface, never to a
 * concrete provider: ``MockImageEngine`` (deterministic stand-in art, no key, no
 * spend — dev + tests) and ``OpenAIImageEngine`` (gpt-image-2).
 *
 * The clean design produced by ``generateDesign`` is CANONICAL: it is what the
 * tattoo artist receives and is never round-tripped through ``compositeOnBody``.
 */

/** The provider's safety system rejected the prompt or image (typed, user-facing). */
export class ModerationError extends Error {}

export interface GenSpec {
  prompt: string;
  style_slugs: string[];
  color: boolean;
  line_weight: string; // thin | medium | bold
  complexity: string; // simple | medium | detailed
  n: number;
}

export interface Placement {
  x_pct: number; // 0..1 tapped point on the body photo (center of the tattoo)
  y_pct: number;
  scale: number; // fraction of the body-photo width the tattoo occupies
  rotation: number; // degrees, clockwise
}

export interface EncodedImage {
  png: Uint8Array;
  width: number;
  height: number;
}

export interface ImageEngine {
  generateDesign(spec: GenSpec): Promise<EncodedImage[]>;
  /** ``body`` may be JPEG or PNG; ``design`` is the canonical clean PNG. */
  compositeOnBody(body: Uint8Array, design: Uint8Array, placement: Placement): Promise<EncodedImage>;
  enhancePrompt(prompt: string, styleSlugs: string[]): Promise<string>;
}
