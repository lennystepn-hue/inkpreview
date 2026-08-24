import io

from PIL import Image, ImageDraw

from app.imaging.engine import Placement
from app.imaging.processing import overlay_design_guide


def _design_white_with_black_center() -> bytes:
    img = Image.new("RGB", (200, 200), (255, 255, 255))
    ImageDraw.Draw(img).rectangle([70, 70, 130, 130], fill=(10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _skin(w: int = 400, h: int = 600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (210, 170, 140)).save(buf, "PNG")
    return buf.getvalue()


def test_guide_overlays_motif_at_tapped_spot_and_drops_white():
    guide = overlay_design_guide(
        _skin(), _design_white_with_black_center(), Placement(x_pct=0.5, y_pct=0.3, scale=0.45)
    )
    img = Image.open(io.BytesIO(guide)).convert("RGB")
    assert img.size == (400, 600)
    # design's white background dropped → corner stays skin
    assert img.getpixel((5, 5)) == (210, 170, 140)
    # the design's black center lands at the tapped point (0.5, 0.3) → (200, 180)
    r, g, b = img.getpixel((200, 180))
    assert r < 120 and g < 120 and b < 120
