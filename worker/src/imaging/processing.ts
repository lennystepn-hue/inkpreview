/**
 * Image post-processing — a port of the former Pillow code
 * (backend/app/imaging/processing.py + watermark.py):
 * thumbnails, the placement guide for the composite, the moderation auto-crop,
 * export watermark/resize (free vs. artist file) and the stencil.
 */

import { type Placement } from "./engine";
import { applyOrientation, decodeJpeg, encodeJpeg, exifOrientation, isJpeg, jpegSize } from "./jpeg";
import { decodePng, encodePng, isPng, pngSize } from "./png";
import {
  type Raster,
  alphaComposite,
  autocontrastLut,
  createRaster,
  crop,
  dropAlpha,
  flattenOnWhite,
  grayToRaster,
  resize,
  rotate,
  thumbnail,
  toGray,
  whiteToTransparent,
} from "./raster";
import { drawText, textLength } from "./text";

/** Print target for the artist file: 2048 px @ 300 DPI ≈ 17 cm. */
export const ARTIST_PX = 2048;
export const PRINT_DPI = 300;

export class InvalidImage extends Error {}

/** Python's ``round()`` (half to even) — keeps crop boxes/LUTs identical to the Pillow version. */
export function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Decode a PNG or JPEG (EXIF orientation applied) into RGBA. */
export async function decodeImage(bytes: Uint8Array): Promise<Raster> {
  if (isPng(bytes)) return decodePng(bytes);
  if (isJpeg(bytes)) return applyOrientation(decodeJpeg(bytes), exifOrientation(bytes));
  throw new InvalidImage("unsupported image format");
}

/** Pixel dimensions from the file header, without decoding. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } {
  if (isPng(bytes)) return pngSize(bytes);
  if (isJpeg(bytes)) return jpegSize(bytes);
  throw new InvalidImage("unsupported image format");
}

// ───────────────────────── Body photos ─────────────────────────

/** Longest edge kept for uploaded body photos (the composite renders at 1024 px). */
export const BODY_MAX_PX = 2048;
/**
 * Refuse to decode anything bigger. Decoding costs ~9 bytes per pixel at peak
 * and a Worker isolate has 128 MB; the frontend already shrinks photos to
 * ≤ 2048 px before uploading, so only raw API uploads can hit this.
 */
const BODY_MAX_PIXELS = 6_300_000;

/**
 * Validate + orient + strip a body photo: decode, honor the EXIF orientation,
 * cap the size and re-encode as JPEG q90 — re-encoding drops ALL metadata
 * (GPS, device, ...).
 */
export async function cleanBodyPhoto(bytes: Uint8Array): Promise<Uint8Array> {
  let size: { width: number; height: number };
  try {
    size = imageSize(bytes);
  } catch {
    throw new InvalidImage("Not a valid image");
  }
  if (!size.width || !size.height) throw new InvalidImage("Not a valid image");
  if (size.width * size.height > BODY_MAX_PIXELS) throw new InvalidImage("Photo resolution too high");
  let img: Raster;
  try {
    img = await decodeImage(bytes);
  } catch {
    throw new InvalidImage("Not a valid image");
  }
  img = thumbnail(img, BODY_MAX_PX);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  return encodeJpeg(img, 90);
}

// ───────────────────────── Designs ─────────────────────────

export async function makeThumbnail(png: Uint8Array, maxPx = 512): Promise<Uint8Array> {
  const img = await decodePng(png);
  return encodePng(thumbnail(img, maxPx));
}

/**
 * Crop the body photo to a window around the tattoo spot and re-express the
 * placement in the crop's coordinates (moderation auto-retry: a tighter crop
 * often excludes whatever the provider's safety system flagged).
 */
export async function cropAroundPlacement(
  body: Uint8Array,
  placement: Placement,
): Promise<{ image: Uint8Array; placement: Placement }> {
  const img = dropAlpha(await decodeImage(body));
  const w = img.width;
  const h = img.height;
  const tattooW = Math.max(1, placement.scale * w);
  const cw = Math.min(w, Math.max(w * 0.5, tattooW * 2.5));
  const ch = Math.min(h, Math.max(h * 0.5, cw * (h / w)));
  const cx = placement.x_pct * w;
  const cy = placement.y_pct * h;
  const left = Math.min(Math.max(0, cx - cw / 2), w - cw);
  const top = Math.min(Math.max(0, cy - ch / 2), h - ch);
  const cropped = crop(img, pyRound(left), pyRound(top), pyRound(left + cw), pyRound(top + ch));
  return {
    image: await encodePng(cropped, { channels: 3 }),
    placement: {
      x_pct: (cx - left) / cw,
      y_pct: (cy - top) / ch,
      scale: Math.min(0.95, tattooW / cw),
      rotation: placement.rotation,
    },
  };
}

/** Scale + rotate the (motif-only) design and return it with its top-left paste position. */
function placeDesign(body: Raster, design: Raster, placement: Placement): { img: Raster; x: number; y: number } {
  const targetW = Math.max(1, Math.trunc(body.width * placement.scale));
  const ratio = targetW / design.width;
  const targetH = Math.max(1, Math.trunc(design.height * ratio));
  let img = resize(design, targetW, targetH);
  if (placement.rotation) {
    // Pillow rotates counter-clockwise; user rotation is clockwise-positive.
    img = rotate(img, -placement.rotation, { expand: true, resample: "bicubic" });
  }
  const cx = Math.trunc(body.width * placement.x_pct);
  const cy = Math.trunc(body.height * placement.y_pct);
  const x = Math.max(0, Math.min(body.width - img.width, cx - Math.floor(img.width / 2)));
  const y = Math.max(0, Math.min(body.height - img.height, cy - Math.floor(img.height / 2)));
  return { img, x, y };
}

/**
 * Roughly paste the design's inked motif onto the body at the tapped point/size —
 * the spatial "guide" the image model refines into a realistic tattoo. The
 * design's white (or transparent) background is dropped so only the ink overlays.
 */
export async function overlayDesignGuide(
  body: Uint8Array,
  design: Uint8Array,
  placement: Placement,
): Promise<Uint8Array> {
  const bodyImg = await decodeImage(body);
  const motif = await decodeImage(design);
  whiteToTransparent(motif);
  const { img, x, y } = placeDesign(bodyImg, motif, placement);
  alphaComposite(bodyImg, img, x, y);
  return encodePng(bodyImg, { channels: 3 });
}

/** The placeholder composite of the mock engine (85% opacity paste, no AI). */
export async function mockComposite(body: Uint8Array, design: Uint8Array, placement: Placement): Promise<Raster> {
  const bodyImg = await decodeImage(body);
  const designImg = await decodeImage(design);
  const { img, x, y } = placeDesign(bodyImg, designImg, placement);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.trunc(img.data[i] * 0.85);
  alphaComposite(bodyImg, img, x, y);
  return dropAlpha(bodyImg);
}

// ───────────────────────── Exports ─────────────────────────

const WATERMARK_TEXT = "INKPREVIEW ✦";

/**
 * Free exports: diagonal tiled watermark (same lattice as the Pillow version:
 * 240×110 px steps on a 2× layer rotated 30°, white at alpha 40).
 */
function applyWatermark(img: Raster, text: string): void {
  const lw = img.width * 2;
  const lh = img.height * 2;
  const layer = createRaster(lw, lh);
  const stepX = 240;
  const stepY = 110;
  for (let row = 0, y = 0; y < lh; row++, y += stepY) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = -stepX; x < lw; x += stepX) drawText(layer, x + offset, y, text, [255, 255, 255, 40]);
  }
  const rotated = rotate(layer, 30);
  const left = Math.floor((rotated.width - img.width) / 2);
  const top = Math.floor((rotated.height - img.height) / 2);
  alphaComposite(img, crop(rotated, left, top, left + img.width, top + img.height));
}

export interface WatermarkOptions {
  maxPx?: number | null;
  watermark?: boolean;
  text?: string;
  brand?: string | null;
  upscaleTo?: number | null;
}

/** Downscale+watermark (free) or upscale to print size (paid). Returns a new raster. */
export function watermarkRaster(src: Raster, opts: WatermarkOptions = {}): Raster {
  const watermark = opts.watermark ?? true;
  let img: Raster = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };

  if (opts.maxPx && (img.width > opts.maxPx || img.height > opts.maxPx)) {
    img = thumbnail(img, opts.maxPx);
  } else if (opts.upscaleTo && Math.max(img.width, img.height) < opts.upscaleTo) {
    const ratio = opts.upscaleTo / Math.max(img.width, img.height);
    img = resize(img, pyRound(img.width * ratio), pyRound(img.height * ratio));
  }

  if (opts.brand) {
    // B2B studio branding: a single subtle label in the bottom-right corner.
    const label = opts.brand.trim().slice(0, 40);
    if (label) {
      const pad = Math.max(10, Math.floor(img.width / 60));
      const tw = textLength(label);
      drawText(img, img.width - tw - pad, img.height - pad - 14, label, [255, 255, 255, 180]);
    }
  }

  if (watermark) applyWatermark(img, opts.text ?? WATERMARK_TEXT);
  return img;
}

/** PNG (RGBA) with 300-DPI metadata so print shops get real-world sizing. */
export async function watermarkAndResize(png: Uint8Array, opts: WatermarkOptions = {}): Promise<Uint8Array> {
  return encodePng(watermarkRaster(await decodeImage(png), opts), { channels: 4, dpi: PRINT_DPI });
}

export const encodePrintPng = (img: Raster) => encodePng(img, { channels: 4, dpi: PRINT_DPI });

/**
 * Stencil-ready linework from a clean black-on-white design: flatten on white →
 * grayscale → autocontrast → soft threshold (≤110 ink, ≥190 paper, smooth ramp).
 */
export function stencilRaster(src: Raster): Raster {
  const img = flattenOnWhite(src);
  const gray = toGray(img);
  const auto = autocontrastLut(gray);
  const lo = 110;
  const hi = 190;
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = v <= lo ? 0 : v >= hi ? 255 : pyRound(((v - lo) * 255) / (hi - lo));
  for (let i = 0; i < gray.length; i++) gray[i] = lut[auto[gray[i]]];
  return grayToRaster(gray, img.width, img.height);
}

export async function makeStencil(png: Uint8Array): Promise<Uint8Array> {
  return encodePng(stencilRaster(await decodeImage(png)), { channels: 3, dpi: PRINT_DPI });
}
