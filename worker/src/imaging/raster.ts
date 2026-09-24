/**
 * Minimal RGBA raster toolkit — the pixel operations the former Pillow backend
 * used (resize/thumbnail, rotate, crop, alpha-composite, grayscale, LUTs),
 * written for the Workers runtime (no native deps, typed arrays only).
 *
 * All rasters are 8-bit RGBA with straight (non-premultiplied) alpha. Resampling
 * works on premultiplied floats internally so transparent pixels never bleed
 * their color into edges.
 */

export interface Raster {
  width: number;
  height: number;
  /** RGBA bytes, row-major, straight alpha. */
  data: Uint8ClampedArray;
}

export type Rgba = readonly [number, number, number, number];

export function createRaster(width: number, height: number, fill: Rgba = [0, 0, 0, 0]): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill[0] || fill[1] || fill[2] || fill[3]) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
    }
  }
  return { width, height, data };
}

export function isOpaque(r: Raster): boolean {
  const d = r.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return false;
  return true;
}

/** Pillow ``Image.crop(box)`` — box is (left, top, right, bottom), right/bottom exclusive. */
export function crop(r: Raster, left: number, top: number, right: number, bottom: number): Raster {
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  const out = createRaster(w, h);
  for (let y = 0; y < h; y++) {
    const sy = top + y;
    if (sy < 0 || sy >= r.height) continue;
    for (let x = 0; x < w; x++) {
      const sx = left + x;
      if (sx < 0 || sx >= r.width) continue;
      const si = (sy * r.width + sx) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = r.data[si];
      out.data[di + 1] = r.data[si + 1];
      out.data[di + 2] = r.data[si + 2];
      out.data[di + 3] = r.data[si + 3];
    }
  }
  return out;
}

// ───────────────────────── Resampling (Lanczos3) ─────────────────────────

function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

function lanczos3(x: number): number {
  return x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0;
}

interface Coeffs {
  start: Int32Array;
  count: Int32Array;
  weights: Float32Array;
  stride: number;
}

/** Same coefficient layout as Pillow's ``precompute_coeffs`` (Resample.c). */
function precompute(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  const stride = Math.ceil(support) * 2 + 1;
  const start = new Int32Array(outSize);
  const count = new Int32Array(outSize);
  const weights = new Float32Array(outSize * stride);
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    const n = Math.min(xmax - xmin, stride);
    let total = 0;
    for (let x = 0; x < n; x++) {
      const w = lanczos3((x + xmin - center + 0.5) / filterscale);
      weights[xx * stride + x] = w;
      total += w;
    }
    if (total !== 0) for (let x = 0; x < n; x++) weights[xx * stride + x] /= total;
    start[xx] = xmin;
    count[xx] = n;
  }
  return { start, count, weights, stride };
}

/** Resize with a Lanczos3 filter (Pillow ``Image.LANCZOS``). */
export function resize(r: Raster, width: number, height: number): Raster {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  if (width === r.width && height === r.height) {
    return { width, height, data: new Uint8ClampedArray(r.data) };
  }
  const opaque = isOpaque(r);
  const src = r.data;
  const sw = r.width;
  const sh = r.height;

  // Horizontal pass: sw×sh → width×sh, premultiplied, kept in 8 bits per channel
  // like Pillow does — a float intermediate would cost 4× the memory, and the
  // isolate only has 128 MB.
  const hc = precompute(sw, width);
  const tmp = new Uint8ClampedArray(width * sh * 4);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    for (let x = 0; x < width; x++) {
      const s = hc.start[x];
      const n = hc.count[x];
      const wo = x * hc.stride;
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let k = 0; k < n; k++) {
        const w = hc.weights[wo + k];
        const i = row + (s + k) * 4;
        const a = src[i + 3];
        if (opaque) {
          cr += src[i] * w;
          cg += src[i + 1] * w;
          cb += src[i + 2] * w;
        } else {
          const aw = (a / 255) * w;
          cr += src[i] * aw;
          cg += src[i + 1] * aw;
          cb += src[i + 2] * aw;
        }
        ca += a * w;
      }
      const o = (y * width + x) * 4;
      tmp[o] = cr;
      tmp[o + 1] = cg;
      tmp[o + 2] = cb;
      tmp[o + 3] = ca;
    }
  }

  // Vertical pass: width×sh → width×height, back to straight alpha bytes.
  const vc = precompute(sh, height);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const s = vc.start[y];
    const n = vc.count[y];
    const wo = y * vc.stride;
    for (let x = 0; x < width; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let k = 0; k < n; k++) {
        const w = vc.weights[wo + k];
        const i = ((s + k) * width + x) * 4;
        cr += tmp[i] * w;
        cg += tmp[i + 1] * w;
        cb += tmp[i + 2] * w;
        ca += tmp[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      if (opaque) {
        out[o] = cr;
        out[o + 1] = cg;
        out[o + 2] = cb;
        out[o + 3] = 255;
      } else if (ca <= 0.5) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        const a = Math.min(255, ca);
        const f = 255 / a;
        out[o] = cr * f;
        out[o + 1] = cg * f;
        out[o + 2] = cb * f;
        out[o + 3] = a;
      }
    }
  }
  return { width, height, data: out };
}

/**
 * Target size for Pillow's ``Image.thumbnail((max_w, max_h))`` — keeps the aspect
 * ratio, only ever shrinks. Returns null when the image already fits.
 */
export function thumbnailSize(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): [number, number] | null {
  let x = Math.floor(maxW);
  let y = Math.floor(maxH);
  if (x >= w && y >= h) return null;
  const aspect = w / h;
  const roundAspect = (n: number, key: (v: number) => number) => {
    const lo = Math.floor(n);
    const hi = Math.ceil(n);
    return Math.max(key(lo) <= key(hi) ? lo : hi, 1);
  };
  if (x / y >= aspect) {
    x = roundAspect(y * aspect, (n) => Math.abs(aspect - n / y));
  } else {
    y = roundAspect(x / aspect, (n) => (n === 0 ? 0 : Math.abs(aspect - x / n)));
  }
  return [x, y];
}

/** Pillow ``Image.thumbnail`` equivalent (returns a new raster, or the same one if it fits). */
export function thumbnail(r: Raster, maxPx: number): Raster {
  const size = thumbnailSize(r.width, r.height, maxPx, maxPx);
  return size ? resize(r, size[0], size[1]) : r;
}

// ───────────────────────── Rotation (Pillow semantics) ─────────────────────────

function cubic(x: number): number {
  // Pillow's bicubic kernel (a = -0.5).
  const a = -0.5;
  x = Math.abs(x);
  if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
  return 0;
}

/**
 * Pillow ``Image.rotate(angle, expand=..., resample=...)``: counter-clockwise by
 * ``angle`` degrees around the center, transparent fill.
 */
export function rotate(
  r: Raster,
  angle: number,
  opts: { expand?: boolean; resample?: "nearest" | "bicubic" } = {},
): Raster {
  const expand = opts.expand ?? false;
  const resample = opts.resample ?? "nearest";
  let w = r.width;
  let h = r.height;
  const rad = -(angle * Math.PI) / 180;
  const round15 = (v: number) => Math.round(v * 1e15) / 1e15;
  const m = [round15(Math.cos(rad)), round15(Math.sin(rad)), 0, round15(-Math.sin(rad)), round15(Math.cos(rad)), 0];
  const tf = (x: number, y: number): [number, number] => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
  const cx = w / 2;
  const cy = h / 2;
  [m[2], m[5]] = tf(-cx, -cy);
  m[2] += cx;
  m[5] += cy;
  if (expand) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]] as const) {
      const [tx, ty] = tf(x, y);
      xs.push(tx);
      ys.push(ty);
    }
    const nw = Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs));
    const nh = Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys));
    [m[2], m[5]] = tf(-(nw - w) / 2, -(nh - h) / 2);
    w = nw;
    h = nh;
  }

  const out = new Uint8ClampedArray(w * h * 4);
  const src = r.data;
  const sw = r.width;
  const sh = r.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xin = m[0] * (x + 0.5) + m[1] * (y + 0.5) + m[2];
      const yin = m[3] * (x + 0.5) + m[4] * (y + 0.5) + m[5];
      const o = (y * w + x) * 4;
      if (resample === "nearest") {
        const ix = Math.floor(xin);
        const iy = Math.floor(yin);
        if (ix < 0 || iy < 0 || ix >= sw || iy >= sh) continue;
        const i = (iy * sw + ix) * 4;
        out[o] = src[i];
        out[o + 1] = src[i + 1];
        out[o + 2] = src[i + 2];
        out[o + 3] = src[i + 3];
        continue;
      }
      // Bicubic on premultiplied values; samples outside the source are transparent.
      const fx = xin - 0.5;
      const fy = yin - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      if (x0 + 2 < 0 || y0 + 2 < 0 || x0 - 1 >= sw || y0 - 1 >= sh) continue;
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let j = -1; j <= 2; j++) {
        const sy = y0 + j;
        if (sy < 0 || sy >= sh) continue;
        const wy = cubic(fy - sy);
        for (let i = -1; i <= 2; i++) {
          const sx = x0 + i;
          if (sx < 0 || sx >= sw) continue;
          const wgt = wy * cubic(fx - sx);
          const si = (sy * sw + sx) * 4;
          const a = src[si + 3];
          const aw = (a / 255) * wgt;
          cr += src[si] * aw;
          cg += src[si + 1] * aw;
          cb += src[si + 2] * aw;
          ca += a * wgt;
        }
      }
      if (ca <= 0.5) continue;
      const a = Math.min(255, ca);
      const f = 255 / a;
      out[o] = cr * f;
      out[o + 1] = cg * f;
      out[o + 2] = cb * f;
      out[o + 3] = a;
    }
  }
  return { width: w, height: h, data: out };
}

// ───────────────────────── Compositing ─────────────────────────

/** Pillow ``Image.alpha_composite`` of ``src`` onto ``dst`` at (dx, dy), in place. */
export function alphaComposite(dst: Raster, src: Raster, dx = 0, dy = 0): void {
  const d = dst.data;
  const s = src.data;
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const si = (y * src.width + x) * 4;
      const sa = s[si + 3];
      if (sa === 0) continue;
      const di = (ty * dst.width + tx) * 4;
      if (sa === 255) {
        d[di] = s[si];
        d[di + 1] = s[si + 1];
        d[di + 2] = s[si + 2];
        d[di + 3] = 255;
        continue;
      }
      const saf = sa / 255;
      const daf = (d[di + 3] / 255) * (1 - saf);
      const oa = saf + daf;
      d[di] = (s[si] * saf + d[di] * daf) / oa;
      d[di + 1] = (s[si + 1] * saf + d[di + 1] * daf) / oa;
      d[di + 2] = (s[si + 2] * saf + d[di + 2] * daf) / oa;
      d[di + 3] = oa * 255;
    }
  }
}

/** Near-white (or already transparent) pixels → fully transparent, in place. */
export function whiteToTransparent(r: Raster): void {
  const d = r.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0 || d[i] + d[i + 1] + d[i + 2] >= 735) d[i + 3] = 0;
  }
}

/** Multiply every alpha value by ``factor`` (Pillow ``point(lambda a: int(a*f))``), in place. */
export function scaleAlpha(r: Raster, factor: number): void {
  const d = r.data;
  for (let i = 3; i < d.length; i += 4) d[i] = Math.trunc(d[i] * factor);
}

/** Set alpha to 255 (Pillow ``convert("RGB")`` drops alpha without compositing). */
export function dropAlpha(r: Raster): Raster {
  const data = new Uint8ClampedArray(r.data);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: r.width, height: r.height, data };
}

/** Composite onto an opaque white page (transparent → paper white). */
export function flattenOnWhite(r: Raster): Raster {
  const out = createRaster(r.width, r.height, [255, 255, 255, 255]);
  alphaComposite(out, r);
  return out;
}

// ───────────────────────── Grayscale + LUTs ─────────────────────────

/** Pillow RGB → "L" (ITU-R 601-2 luma, same fixed-point rounding). */
export function toGray(r: Raster): Uint8Array {
  const d = r.data;
  const out = new Uint8Array(r.width * r.height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (d[i] * 19595 + d[i + 1] * 38470 + d[i + 2] * 7471 + 0x8000) >> 16;
  }
  return out;
}

/** Pillow ``ImageOps.autocontrast`` (cutoff=0) lookup table for an "L" image. */
export function autocontrastLut(gray: Uint8Array): Uint8Array {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  let lo = 0;
  while (lo < 256 && hist[lo] === 0) lo++;
  let hi = 255;
  while (hi >= 0 && hist[hi] === 0) hi--;
  const lut = new Uint8Array(256);
  if (hi <= lo) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const scale = 255 / (hi - lo);
  const offset = -lo * scale;
  for (let i = 0; i < 256; i++) {
    const v = Math.trunc(i * scale + offset);
    lut[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return lut;
}

/** Grayscale bytes → opaque RGBA raster. */
export function grayToRaster(gray: Uint8Array, width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    data[i] = data[i + 1] = data[i + 2] = gray[j];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

// ───────────────────────── Shapes (mock engine) ─────────────────────────

function blendPixel(r: Raster, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return;
  const i = (y * r.width + x) * 4;
  r.data[i] = c[0];
  r.data[i + 1] = c[1];
  r.data[i + 2] = c[2];
  r.data[i + 3] = c[3];
}

/** Outline of a rounded rectangle (inclusive box), ``width`` px thick, drawn inward. */
export function strokeRoundedRect(
  r: Raster,
  box: [number, number, number, number],
  radius: number,
  width: number,
  color: Rgba,
): void {
  const [x0, y0, x1, y1] = box;
  const inside = (x: number, y: number, inset: number) => {
    const l = x0 + inset;
    const t = y0 + inset;
    const rr = x1 - inset;
    const b = y1 - inset;
    if (x < l || x > rr || y < t || y > b) return false;
    const rad = Math.max(0, radius - inset);
    const cx = x < l + rad ? l + rad : x > rr - rad ? rr - rad : x;
    const cy = y < t + rad ? t + rad : y > b - rad ? b - rad : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inside(x, y, 0) && !inside(x, y, width)) blendPixel(r, x, y, color);
    }
  }
}

/** Outline of the ellipse inscribed in the (inclusive) box, ``width`` px thick. */
export function strokeEllipse(
  r: Raster,
  box: [number, number, number, number],
  width: number,
  color: Rgba,
): void {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const ax = (x1 - x0) / 2;
  const ay = (y1 - y0) / 2;
  const inEllipse = (x: number, y: number, a: number, b: number) =>
    a > 0 && b > 0 && ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inEllipse(x, y, ax, ay) && !inEllipse(x, y, ax - width, ay - width)) {
        blendPixel(r, x, y, color);
      }
    }
  }
}
