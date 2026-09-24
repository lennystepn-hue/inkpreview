import type { Style } from "./api";

/** FNV-1a — a tiny stable string hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Flash-sheet number for a design, stable across views ("№ 417"). */
export function flashNo(id: string): string {
  return `№ ${(hash(id) % 900) + 100}`;
}

/** A small deterministic tilt (−max…max degrees) so a wall of cards looks pinned by hand. */
export function flashTilt(id: string, max = 2): number {
  return ((hash(id + "tilt") % 1000) / 1000) * max * 2 - max;
}

/** Display name of a design's first style ("Fine Line"), if the catalog knows it. */
export function styleName(slugs: string[] | undefined, styles: Style[]): string | null {
  const slug = slugs?.[0];
  if (!slug) return null;
  return styles.find((s) => s.slug === slug)?.name ?? null;
}
