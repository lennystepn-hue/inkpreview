/**
 * Deterministic stand-in image engine: real PNGs, no API key, no spend. Used for
 * local dev and tests so the whole pipeline (jobs, storage, watermark,
 * composite, frontend) works end-to-end. Output is obviously placeholder art.
 */

import { type EncodedImage, type GenSpec, type ImageEngine, type Placement } from "./engine";
import { encodePng } from "./png";
import { mockComposite } from "./processing";
import { type Rgba, createRaster, strokeEllipse, strokeRoundedRect } from "./raster";
import { drawText } from "./text";

// Acid-Ink accent palette cycled across variants.
const ACCENTS: [number, number, number][] = [
  [198, 255, 0], // acid lime
  [0, 229, 255], // electric cyan
  [255, 0, 153], // hot magenta
  [167, 139, 250], // uv violet
];

const SIZE = 1024;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const candidate = `${cur} ${w}`.trim();
    if (candidate.length > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

export class MockImageEngine implements ImageEngine {
  async generateDesign(spec: GenSpec): Promise<EncodedImage[]> {
    const out: EncodedImage[] = [];
    for (let i = 0; i < Math.max(1, spec.n); i++) {
      const [r, g, b] = ACCENTS[i % ACCENTS.length];
      const img = createRaster(SIZE, SIZE);
      const m = Math.trunc(SIZE * 0.1);
      strokeRoundedRect(img, [m, m, SIZE - m, SIZE - m], 48, 10, [r, g, b, 255]);
      strokeEllipse(img, [m * 2, m * 2, SIZE - m * 2, SIZE - m * 2], 4, [r, g, b, 180]);
      const accent: Rgba = [r, g, b, 255];
      const lines = wrap(spec.prompt, 18);
      let y = SIZE / 2 - Math.trunc((lines.length * 44) / 2) - 60;
      for (const ln of lines) {
        drawText(img, SIZE / 2, y, ln, accent, "mm");
        y += 44;
      }
      drawText(img, SIZE / 2, SIZE / 2 + 120, spec.style_slugs.join(" / ") || "no-style", [255, 255, 255, 220], "mm");
      const tag = `variant ${i + 1} - ${spec.color ? "color" : "b&w"}`;
      drawText(img, SIZE / 2, SIZE - m - 30, tag, [255, 255, 255, 160], "mm");
      out.push({ png: await encodePng(img, { channels: 4 }), width: SIZE, height: SIZE });
    }
    return out;
  }

  async compositeOnBody(body: Uint8Array, design: Uint8Array, placement: Placement): Promise<EncodedImage> {
    const img = await mockComposite(body, design, placement);
    return { png: await encodePng(img, { channels: 3 }), width: img.width, height: img.height };
  }

  async enhancePrompt(prompt: string, styleSlugs: string[]): Promise<string> {
    const styles = styleSlugs.length ? styleSlugs.join(", ") : "tattoo";
    return (
      `${prompt}, rendered as a ${styles} tattoo design — clean confident linework, ` +
      `balanced composition, high contrast, crisp edges, isolated on a transparent ` +
      `background, stencil-ready, professional flash sheet quality`
    );
  }
}
