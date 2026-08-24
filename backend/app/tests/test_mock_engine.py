import io

from PIL import Image

from app.imaging.engine import GenSpec, Placement
from app.imaging.factory import get_engine
from app.imaging.mock_engine import MockImageEngine

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _open(b: bytes) -> Image.Image:
    return Image.open(io.BytesIO(b))


async def test_generate_returns_transparent_pngs():
    eng = MockImageEngine()
    designs = await eng.generate_design(
        GenSpec(prompt="a howling wolf", style_slugs=["fine-line"], n=2)
    )
    assert len(designs) == 2
    for d in designs:
        assert d.png_bytes[:8] == PNG_MAGIC
        img = _open(d.png_bytes)
        assert img.mode == "RGBA"
        assert img.size == (d.width, d.height)
        # canonical design must be transparent-background (corner fully transparent)
        assert img.getpixel((0, 0))[3] == 0


async def test_variants_differ():
    eng = MockImageEngine()
    designs = await eng.generate_design(GenSpec(prompt="rose", style_slugs=["traditional"], n=2))
    assert designs[0].png_bytes != designs[1].png_bytes


async def test_composite_keeps_body_dimensions():
    eng = MockImageEngine()
    body = Image.new("RGB", (400, 600), (200, 180, 160))
    buf = io.BytesIO()
    body.save(buf, "PNG")
    body_png = buf.getvalue()

    design = (await eng.generate_design(GenSpec(prompt="rose", style_slugs=["traditional"])))[0]
    preview = await eng.composite_on_body(
        body_png, design.png_bytes, Placement(x_pct=0.5, y_pct=0.5, scale=0.3)
    )
    assert preview.png_bytes[:8] == PNG_MAGIC
    assert _open(preview.png_bytes).size == (400, 600)
    assert (preview.width, preview.height) == (400, 600)


async def test_enhance_prompt_expands():
    eng = MockImageEngine()
    out = await eng.enhance_prompt("wolf", ["fine-line"])
    assert "wolf" in out.lower()
    assert len(out) > len("wolf")


def test_factory_returns_mock_by_default():
    from app.config import Settings

    eng = get_engine(Settings(_env_file=None))
    assert isinstance(eng, MockImageEngine)
