"""Generate test fixtures from Pillow (the reference implementation the Worker
ports): PNGs in every color type / bit depth, an EXIF-rotated JPEG, and the
exact expected stencil pixels.

    cd backend && PYTHONPATH=. uv run python ../worker/scripts/gen_test_fixtures.py
"""

import base64
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

from app.imaging.watermark import make_stencil

OUT = Path(__file__).resolve().parent.parent / "test" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)

b64 = lambda b: base64.b64encode(b).decode()


def rgba_of(img: Image.Image) -> bytes:
    return img.convert("RGBA").tobytes()


def gradient(mode: str, w: int = 13, h: int = 7) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    for y in range(h):
        for x in range(w):
            img.putpixel((x, y), ((x * 19) % 256, (y * 37) % 256, (x * y * 11) % 256, (255 - x * 13) % 256))
    return img.convert(mode)


cases = []


def add(name: str, img: Image.Image, **save):
    buf = io.BytesIO()
    img.save(buf, "PNG", **save)
    data = buf.getvalue()
    decoded = Image.open(io.BytesIO(data))
    cases.append({"name": name, "png": b64(data), "w": decoded.width, "h": decoded.height, "rgba": b64(rgba_of(decoded))})


add("rgb8", gradient("RGB"))
add("rgba8", gradient("RGBA"))
add("gray8", gradient("L"))
add("gray_alpha8", gradient("LA"))
add("gray1", gradient("1"))
add("palette", gradient("RGB").quantize(colors=16))
add("palette_trns", gradient("RGBA").convert("P", palette=Image.Palette.ADAPTIVE, colors=8), transparency=0)

add("rgb_opt", gradient("RGB"), optimize=True)

# Pillow can't *write* Adam7-interlaced or 16-bit RGB PNGs; build them by hand
# via a tiny encoder so the decoder paths still get exercised.
import struct
import zlib


def chunk(t: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + t + body + struct.pack(">I", zlib.crc32(t + body) & 0xFFFFFFFF)


def raw_png(w, h, color_type, depth, rows: list[bytes], interlace=0) -> bytes:
    ihdr = struct.pack(">IIBBBBB", w, h, depth, color_type, 0, 0, interlace)
    raw = b"".join(b"\x00" + r for r in rows)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


# 16-bit grayscale (expected 8-bit value = high byte)
w, h = 6, 2
g16 = [[x * 12000 + y * 999 for x in range(w)] for y in range(h)]
data = raw_png(w, h, 0, 16, [b"".join(struct.pack(">H", v) for v in row) for row in g16])
exp = bytes(b for row in g16 for v in row for b in (v >> 8, v >> 8, v >> 8, 255))
cases.append({"name": "gray16", "png": b64(data), "w": w, "h": h, "rgba": b64(exp)})

# 16-bit RGBA
w, h = 5, 3
px = [[((x * 50) << 8 | 7, (y * 90) << 8 | 3, (x + y) * 4000, 65535 - x * 1000) for x in range(w)] for y in range(h)]
rows = [b"".join(struct.pack(">HHHH", *p) for p in row) for row in px]
data = raw_png(w, h, 6, 16, rows)
cases.append({"name": "rgba16", "png": b64(data), "w": w, "h": h, "rgba": b64(rgba_of(Image.open(io.BytesIO(data))))})

# Adam7 interlaced RGB 8-bit (9x9 covers every pass)
w, h = 9, 9
pix = [[((x * 28) % 256, (y * 28) % 256, (x * 9 + y) % 256) for x in range(w)] for y in range(h)]
passes = [(0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]
raw = b""
for x0, y0, dx, dy in passes:
    for y in range(y0, h, dy):
        xs = list(range(x0, w, dx))
        if not xs:
            continue
        raw += b"\x00" + b"".join(bytes(pix[y][x]) for x in xs)
ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 1)
data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
expected = Image.new("RGB", (w, h))
for y in range(h):
    for x in range(w):
        expected.putpixel((x, y), pix[y][x])
cases.append({"name": "adam7_rgb", "png": b64(data), "w": w, "h": h, "rgba": b64(rgba_of(expected))})

cases = [c for c in cases if c]
(OUT / "png-suite.json").write_text(json.dumps(cases) + "\n")

# EXIF orientation 6 (rotate 90° CW to display): 40x20 stored, 20x40 upright.
img = Image.new("RGB", (40, 20), (0, 0, 255))
for x in range(10):
    for y in range(10):
        img.putpixel((x, y), (255, 0, 0))  # stored top-left = red
exif = Image.Exif()
exif[0x0112] = 6
buf = io.BytesIO()
img.save(buf, "JPEG", quality=95, exif=exif.tobytes())
from PIL import ImageOps

upright = ImageOps.exif_transpose(Image.open(io.BytesIO(buf.getvalue())))
(OUT / "exif-jpeg.json").write_text(
    json.dumps({"jpeg": b64(buf.getvalue()), "w": upright.width, "h": upright.height,
                "topRight": upright.getpixel((upright.width - 3, 3))}) + "\n"
)

# Stencil reference: a design with strokes, washes and a gradient.
design = Image.new("RGB", (64, 48), (255, 255, 255))
for x in range(64):
    for y in range(48):
        v = int(255 * x / 63)
        if 10 <= y < 20:
            design.putpixel((x, y), (v, v, v))
        elif 30 <= y < 34:
            design.putpixel((x, y), (10, 20, 30))
        elif y == 40:
            design.putpixel((x, y), (225, 225, 225))
buf = io.BytesIO()
design.save(buf, "PNG")
stencil = Image.open(io.BytesIO(make_stencil(buf.getvalue()))).convert("L")
(OUT / "stencil.json").write_text(
    json.dumps({"design": b64(buf.getvalue()), "w": 64, "h": 48,
                "grayB64": b64(stencil.tobytes()), "sha256": hashlib.sha256(stencil.tobytes()).hexdigest()}) + "\n"
)
print("fixtures:", [c["name"] for c in cases])
