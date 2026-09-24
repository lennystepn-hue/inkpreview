/**
 * JPEG decode/encode (pure-JS jpeg-js) plus the bits of EXIF handling the old
 * Pillow code relied on: reading the orientation tag so photos can be rotated
 * upright before every piece of metadata is dropped by re-encoding.
 */

import jpeg from "jpeg-js";

import { type Raster } from "./raster";

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Walk the JPEG marker segments (stops at the start of scan). */
function* segments(bytes: Uint8Array): Generator<{ marker: number; start: number; length: number }> {
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) return;
    const marker = bytes[p + 1];
    if (marker === 0xff) {
      p++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return; // EOI / SOS
    if (marker >= 0xd0 && marker <= 0xd7) {
      p += 2;
      continue;
    }
    const length = (bytes[p + 2] << 8) | bytes[p + 3];
    yield { marker, start: p + 4, length: length - 2 };
    p += 2 + length;
  }
}

/** Width/height from the SOFn segment, without decoding. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  for (const s of segments(bytes)) {
    const m = s.marker;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const height = (bytes[s.start + 1] << 8) | bytes[s.start + 2];
      const width = (bytes[s.start + 3] << 8) | bytes[s.start + 4];
      return { width, height };
    }
  }
  throw new Error("JPEG without SOF");
}

/** EXIF orientation (1-8); 1 when absent or unreadable. */
export function exifOrientation(bytes: Uint8Array): number {
  for (const s of segments(bytes)) {
    if (s.marker !== 0xe1 || s.length < 14) continue;
    const b = bytes.subarray(s.start, s.start + s.length);
    // "Exif\0\0" header
    if (b[0] !== 0x45 || b[1] !== 0x78 || b[2] !== 0x69 || b[3] !== 0x66 || b[4] !== 0 || b[5] !== 0) continue;
    const t = 6;
    const le = b[t] === 0x49 && b[t + 1] === 0x49;
    const be = b[t] === 0x4d && b[t + 1] === 0x4d;
    if (!le && !be) return 1;
    const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
    const u32 = (o: number) =>
      le
        ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
        : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const ifd = t + u32(t + 4);
    if (ifd + 2 > b.length) return 1;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > b.length) break;
      if (u16(e) === 0x0112) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : 1;
      }
    }
    return 1;
  }
  return 1;
}

/** Pillow ``ImageOps.exif_transpose`` for an already-decoded raster. */
export function applyOrientation(r: Raster, orientation: number): Raster {
  if (orientation <= 1 || orientation > 8) return r;
  const { width: w, height: h, data } = r;
  const swap = orientation >= 5;
  const ow = swap ? h : w;
  const oh = swap ? w : h;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let tx: number, ty: number;
      switch (orientation) {
        case 2: tx = w - 1 - x; ty = y; break; // mirror horizontal
        case 3: tx = w - 1 - x; ty = h - 1 - y; break; // rotate 180
        case 4: tx = x; ty = h - 1 - y; break; // mirror vertical
        case 5: tx = y; ty = x; break; // transpose
        case 6: tx = h - 1 - y; ty = x; break; // rotate 90 CW
        case 7: tx = h - 1 - y; ty = w - 1 - x; break; // transverse
        default: tx = y; ty = w - 1 - x; // 8: rotate 270 CW
      }
      const si = (y * w + x) * 4;
      const di = (ty * ow + tx) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { width: ow, height: oh, data: out };
}

export function decodeJpeg(bytes: Uint8Array, maxMegapixels = 25): Raster {
  const img = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: true,
    maxResolutionInMP: maxMegapixels,
    maxMemoryUsageInMB: 200,
  });
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength),
  };
}

/** Baseline JPEG (alpha ignored). No metadata is ever written. */
export function encodeJpeg(r: Raster, quality = 90): Uint8Array {
  const out = jpeg.encode({ width: r.width, height: r.height, data: r.data }, quality);
  return new Uint8Array(out.data.buffer, out.data.byteOffset, out.data.byteLength);
}
