/**
 * PNG decode/encode on top of the runtime's native zlib streams
 * (DecompressionStream/CompressionStream "deflate"), so no WASM or JS inflate is
 * needed. Decoding handles every standard PNG (all color types, bit depths 1-16,
 * palettes, tRNS, Adam7 interlacing) into straight-alpha RGBA8.
 */

import { type Raster } from "./raster";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) return false;
  return true;
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/** Width/height from the IHDR chunk, without decoding pixels. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  if (!isPng(bytes) || bytes.length < 24) throw new Error("not a PNG");
  return { width: u32(bytes, 16), height: u32(bytes, 20) };
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const body = new Blob([data]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export const inflate = (data: Uint8Array) => pipe(data, new DecompressionStream("deflate"));
export const deflate = (data: Uint8Array) => pipe(data, new CompressionStream("deflate"));

// ───────────────────────── Decode ─────────────────────────

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Undo the per-scanline filters of one (sub)image in place; returns the raw rows. */
function unfilter(data: Uint8Array, offset: number, rowBytes: number, rows: number, bpp: number): Uint8Array {
  const out = new Uint8Array(rowBytes * rows);
  let p = offset;
  for (let y = 0; y < rows; y++) {
    const type = data[p++];
    const cur = y * rowBytes;
    const prev = cur - rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const raw = data[p++];
      const a = x >= bpp ? out[cur + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let v: number;
      switch (type) {
        case 0: v = raw; break;
        case 1: v = raw + a; break;
        case 2: v = raw + b; break;
        case 3: v = raw + ((a + b) >> 1); break;
        case 4: v = raw + paeth(a, b, c); break;
        default: throw new Error(`bad PNG filter ${type}`);
      }
      out[cur + x] = v & 0xff;
    }
  }
  return out;
}

export async function decodePng(bytes: Uint8Array): Promise<Raster> {
  if (!isPng(bytes)) throw new Error("not a PNG");
  let pos = 8;
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const len = u32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") {
      width = u32(body, 0);
      height = u32(body, 4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "tRNS") {
      trns = body;
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
  }
  if (!width || !height) throw new Error("PNG without IHDR");
  if (width * height > 40_000_000) throw new Error("PNG too large");

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  const bitsPerPixel = channels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);

  let total = 0;
  for (const c of idat) total += c.length;
  const joined = new Uint8Array(total);
  let o = 0;
  for (const c of idat) {
    joined.set(c, o);
    o += c.length;
  }
  const inflated = await inflate(joined);

  const out = new Uint8ClampedArray(width * height * 4);
  const maxVal = (1 << depth) - 1;
  const sample = (row: Uint8Array, rowStart: number, index: number): number => {
    // index-th sample of the row (for sub-byte depths), scaled to the raw value.
    if (depth === 8) return row[rowStart + index];
    if (depth === 16) return (row[rowStart + index * 2] << 8) | row[rowStart + index * 2 + 1];
    const bit = index * depth;
    const byte = row[rowStart + (bit >> 3)];
    const shift = 8 - depth - (bit & 7);
    return (byte >> shift) & maxVal;
  };
  const to8 = (v: number) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / maxVal));
  const trnsGray = trns && colorType === 0 ? (trns[0] << 8) | trns[1] : -1;
  const trnsRgb =
    trns && colorType === 2
      ? [(trns[0] << 8) | trns[1], (trns[2] << 8) | trns[3], (trns[4] << 8) | trns[5]]
      : null;

  const writeRows = (rows: Uint8Array, rowBytes: number, pw: number, ph: number, x0: number, y0: number, dx: number, dy: number) => {
    for (let y = 0; y < ph; y++) {
      const rs = y * rowBytes;
      const ty = y0 + y * dy;
      for (let x = 0; x < pw; x++) {
        const tx = x0 + x * dx;
        const t = (ty * width + tx) * 4;
        let r: number, g: number, b: number, a = 255;
        switch (colorType) {
          case 0: {
            const v = sample(rows, rs, x);
            r = g = b = to8(v);
            if (v === trnsGray) a = 0;
            break;
          }
          case 2: {
            const rv = sample(rows, rs, x * 3), gv = sample(rows, rs, x * 3 + 1), bv = sample(rows, rs, x * 3 + 2);
            r = to8(rv); g = to8(gv); b = to8(bv);
            if (trnsRgb && rv === trnsRgb[0] && gv === trnsRgb[1] && bv === trnsRgb[2]) a = 0;
            break;
          }
          case 3: {
            const idx = sample(rows, rs, x);
            if (!palette || idx * 3 + 2 >= palette.length) {
              r = g = b = 0;
            } else {
              r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
            }
            if (trns && idx < trns.length) a = trns[idx];
            break;
          }
          case 4: {
            r = g = b = to8(sample(rows, rs, x * 2));
            a = to8(sample(rows, rs, x * 2 + 1));
            break;
          }
          default: {
            r = to8(sample(rows, rs, x * 4)); g = to8(sample(rows, rs, x * 4 + 1));
            b = to8(sample(rows, rs, x * 4 + 2)); a = to8(sample(rows, rs, x * 4 + 3));
          }
        }
        out[t] = r; out[t + 1] = g; out[t + 2] = b; out[t + 3] = a;
      }
    }
  };

  if (interlace === 0) {
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
    const rows = unfilter(inflated, 0, rowBytes, height, bpp);
    writeRows(rows, rowBytes, width, height, 0, 0, 1, 1);
  } else {
    let off = 0;
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = Math.ceil((width - x0) / dx);
      const ph = Math.ceil((height - y0) / dy);
      if (pw <= 0 || ph <= 0) continue;
      const rowBytes = Math.ceil((pw * bitsPerPixel) / 8);
      const rows = unfilter(inflated, off, rowBytes, ph, bpp);
      off += (rowBytes + 1) * ph;
      writeRows(rows, rowBytes, pw, ph, x0, y0, dx, dy);
    }
  }
  return { width, height, data: out };
}

// ───────────────────────── Encode ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  const t = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  out.set(t, 4);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32([t, body]));
  return out;
}

export interface EncodeOptions {
  /** 3 = RGB (alpha dropped), 4 = RGBA. Default: 4 unless the raster is fully opaque. */
  channels?: 3 | 4;
  /** Write a pHYs chunk with this resolution (e.g. 300 for print). */
  dpi?: number;
}

/** Encode as an 8-bit RGB/RGBA PNG with adaptive (min-sum) per-row filtering. */
export async function encodePng(r: Raster, opts: EncodeOptions = {}): Promise<Uint8Array> {
  const { width, height, data } = r;
  let channels = opts.channels;
  if (!channels) {
    channels = 3;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) {
        channels = 4;
        break;
      }
    }
  }
  const rowBytes = width * channels;
  const raw = new Uint8Array((rowBytes + 1) * height);
  const row = new Uint8Array(rowBytes);
  const prev = new Uint8Array(rowBytes);
  const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(rowBytes));
  const bpp = channels;
  for (let y = 0; y < height; y++) {
    // Pack the row (dropping alpha for RGB output).
    const src = y * width * 4;
    if (channels === 4) {
      row.set(data.subarray(src, src + rowBytes));
    } else {
      for (let x = 0, i = src, j = 0; x < width; x++, i += 4, j += 3) {
        row[j] = data[i];
        row[j + 1] = data[i + 1];
        row[j + 2] = data[i + 2];
      }
    }
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f];
      let sum = 0;
      for (let x = 0; x < rowBytes; x++) {
        const a = x >= bpp ? row[x - bpp] : 0;
        const b = y > 0 ? prev[x] : 0;
        const cc = y > 0 && x >= bpp ? prev[x - bpp] : 0;
        let v: number;
        switch (f) {
          case 0: v = row[x]; break;
          case 1: v = row[x] - a; break;
          case 2: v = row[x] - b; break;
          case 3: v = row[x] - ((a + b) >> 1); break;
          default: v = row[x] - paeth(a, b, cc);
        }
        v &= 0xff;
        c[x] = v;
        sum += v < 128 ? v : 256 - v;
        if (sum >= bestSum) break;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    // Recompute the winner fully (the loop above may have bailed out early).
    const c = cand[best];
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = y > 0 ? prev[x] : 0;
      const cc = y > 0 && x >= bpp ? prev[x - bpp] : 0;
      let v: number;
      switch (best) {
        case 0: v = row[x]; break;
        case 1: v = row[x] - a; break;
        case 2: v = row[x] - b; break;
        case 3: v = row[x] - ((a + b) >> 1); break;
        default: v = row[x] - paeth(a, b, cc);
      }
      c[x] = v & 0xff;
    }
    const o = y * (rowBytes + 1);
    raw[o] = best;
    raw.set(c, o + 1);
    prev.set(row);
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  const parts: Uint8Array[] = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr)];
  if (opts.dpi) {
    const ppm = Math.trunc(opts.dpi / 0.0254 + 0.5);
    const phys = new Uint8Array(9);
    const pv = new DataView(phys.buffer);
    pv.setUint32(0, ppm);
    pv.setUint32(4, ppm);
    phys[8] = 1;
    parts.push(chunk("pHYs", phys));
  }
  parts.push(chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array(0)));
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
