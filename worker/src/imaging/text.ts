/**
 * Tiny bitmap text renderer for watermark / studio-brand / mock-engine labels.
 *
 * Glyphs come from ``glyphs.json`` (Pillow's default font, Aileron 10px — the
 * font the former backend drew these labels with; regenerate with
 * ``scripts/gen_glyphs.py``). Drawing follows Pillow's ``ImageDraw.text`` on an
 * RGBA image: the fill color is pasted through the antialiased glyph mask on
 * every channel, alpha included.
 */

import font from "./glyphs.json";
import { type Raster, type Rgba } from "./raster";

interface Glyph {
  w: number;
  h: number;
  x: number;
  y: number;
  adv: number;
  mask: Uint8Array;
}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const GLYPHS = new Map<string, Glyph>();
for (const [ch, g] of Object.entries(font.glyphs as Record<string, { w: number; h: number; x: number; y: number; adv: number; a: string }>)) {
  GLYPHS.set(ch, { w: g.w, h: g.h, x: g.x, y: g.y, adv: g.adv, mask: b64(g.a) });
}
const UMLAUTS: Record<string, string> = { "ä": "a", "ö": "o", "ü": "u", "Ä": "A", "Ö": "O", "Ü": "U" };

/** Characters the font can't draw are folded to ASCII (é → e, ß → ss); umlauts get their dots back. */
function glyphsFor(text: string): { glyph: Glyph; dots: boolean }[] {
  const out: { glyph: Glyph; dots: boolean }[] = [];
  for (const ch of text) {
    const direct = GLYPHS.get(ch);
    if (direct) {
      out.push({ glyph: direct, dots: false });
      continue;
    }
    if (UMLAUTS[ch]) {
      out.push({ glyph: GLYPHS.get(UMLAUTS[ch])!, dots: true });
      continue;
    }
    const folded = (ch === "ß" ? "ss" : ch.normalize("NFKD").replace(/[̀-ͯ]/g, "")) || "?";
    for (const c of folded) out.push({ glyph: GLYPHS.get(c) ?? GLYPHS.get("?")!, dots: false });
  }
  return out;
}

/** Advance width of ``text`` in pixels (Pillow ``font.getlength``). */
export function textLength(text: string): number {
  let w = 0;
  for (const { glyph } of glyphsFor(text)) w += glyph.adv;
  return w;
}

function paste(r: Raster, x: number, y: number, m: number, fill: Rgba): void {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height || m === 0) return;
  const i = (y * r.width + x) * 4;
  const f = m / 255;
  const d = r.data;
  d[i] = d[i] + (fill[0] - d[i]) * f;
  d[i + 1] = d[i + 1] + (fill[1] - d[i + 1]) * f;
  d[i + 2] = d[i + 2] + (fill[2] - d[i + 2]) * f;
  d[i + 3] = d[i + 3] + (fill[3] - d[i + 3]) * f;
}

/**
 * Draw ``text`` with its top-left at (x, y) (Pillow's default "la" anchor), or
 * centered on (x, y) with ``anchor: "mm"``.
 */
export function drawText(
  r: Raster,
  x: number,
  y: number,
  text: string,
  fill: Rgba,
  anchor: "la" | "mm" = "la",
): void {
  if (anchor === "mm") {
    x -= textLength(text) / 2;
    y -= (font.ascent + font.descent) / 2 - font.descent / 2;
  }
  let pen = x;
  for (const { glyph, dots } of glyphsFor(text)) {
    const gx = Math.round(pen) + glyph.x;
    const gy = Math.round(y) + glyph.y;
    for (let j = 0; j < glyph.h; j++) {
      for (let i = 0; i < glyph.w; i++) paste(r, gx + i, gy + j, glyph.mask[j * glyph.w + i], fill);
    }
    if (dots) {
      const top = gy - 2;
      paste(r, gx + 1, top, 255, fill);
      paste(r, gx + Math.max(2, glyph.w - 2), top, 255, fill);
    }
    pen += glyph.adv;
  }
}
