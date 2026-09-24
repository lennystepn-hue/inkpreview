"""Generate src/imaging/glyphs.json — the tiny bitmap font the Worker uses for
watermark / studio-brand / mock-engine text.

It is rendered from Pillow's default font (Aileron, size 10), i.e. exactly the
font the former Python backend drew its watermark and brand labels with, so
exports look the same. Run from the backend's uv env:

    cd backend && uv run python ../worker/scripts/gen_glyphs.py
"""

import base64
import json
from pathlib import Path

from PIL import ImageFont

font = ImageFont.load_default()
asc, desc = font.getmetrics()
glyphs = {}
for code in range(32, 127):
    ch = chr(code)
    mask, (ox, oy) = font.getmask2(ch, "L")
    w, h = mask.size
    data = bytes(mask[i] for i in range(w * h)) if w and h else b""
    glyphs[ch] = {
        "w": w,
        "h": h,
        "x": ox,
        "y": oy,
        "adv": font.getlength(ch),
        "a": base64.b64encode(data).decode(),
    }

# The default font has no "✦" (it renders a notdef box), so ship a hand-drawn
# 7x7 four-point star with the same metrics as a capital letter.
star = [
    "...#...",
    "...#...",
    "..###..",
    "#######",
    "..###..",
    "...#...",
    "...#...",
]
sw, sh = 7, 7
cap = glyphs["A"]
star_bytes = bytes(255 if c == "#" else 0 for row in star for c in row)
glyphs["✦"] = {
    "w": sw,
    "h": sh,
    "x": 0,
    "y": cap["y"] + cap["h"] - sh,
    "adv": sw + 1.0,
    "a": base64.b64encode(star_bytes).decode(),
}

out = {"size": font.size, "ascent": asc, "descent": desc, "glyphs": glyphs}
dest = Path(__file__).resolve().parent.parent / "src" / "imaging" / "glyphs.json"
dest.write_text(json.dumps(out, separators=(",", ":")) + "\n")
print(f"wrote {dest} ({dest.stat().st_size} bytes, {len(glyphs)} glyphs)")
