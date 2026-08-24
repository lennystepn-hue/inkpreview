import io

from PIL import Image

from app.imaging.watermark import watermark_and_resize


def _png(size: int = 1024) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (size, size), (200, 255, 0, 255)).save(buf, "PNG")
    return buf.getvalue()


def _dims(b: bytes) -> tuple[int, int]:
    return Image.open(io.BytesIO(b)).size


def test_resize_downscales():
    out = watermark_and_resize(_png(1024), max_px=512, watermark=False)
    w, h = _dims(out)
    assert max(w, h) <= 512


def test_watermark_changes_pixels():
    plain = watermark_and_resize(_png(512), max_px=512, watermark=False)
    marked = watermark_and_resize(_png(512), max_px=512, watermark=True)
    assert plain != marked


def test_full_res_paid_keeps_size():
    out = watermark_and_resize(_png(1024), max_px=None, watermark=False)
    assert _dims(out) == (1024, 1024)


def test_studio_brand_stamps_and_keeps_full_res():
    plain = watermark_and_resize(_png(1024), max_px=None, watermark=False)
    branded = watermark_and_resize(_png(1024), max_px=None, watermark=False, brand="Studio X")
    assert _dims(branded) == (1024, 1024)  # full resolution, no downscale
    assert branded != plain  # the brand label changed pixels


def test_artist_file_upscales_with_print_dpi():
    out = watermark_and_resize(_png(1024), watermark=False, upscale_to=2048)
    img = Image.open(io.BytesIO(out))
    assert img.size == (2048, 2048)
    assert round(img.info["dpi"][0]) == 300


def test_stencil_is_pure_linework():
    from app.imaging.watermark import make_stencil

    # black line on white + a light-gray wash that must drop out
    src = Image.new("RGB", (200, 200), (255, 255, 255))
    for x in range(40, 160):
        for y in range(95, 105):
            src.putpixel((x, y), (10, 10, 10))  # dark stroke
        src.putpixel((x, 30), (225, 225, 225))  # faint wash
    buf = io.BytesIO()
    src.save(buf, "PNG")

    out = Image.open(io.BytesIO(make_stencil(buf.getvalue()))).convert("L")
    assert out.getpixel((100, 100)) == 0  # stroke → pure black
    assert out.getpixel((100, 30)) == 255  # wash → paper white
