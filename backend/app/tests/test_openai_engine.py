import base64
import io
from types import SimpleNamespace

from PIL import Image

from app.config import Settings
from app.imaging.engine import GenSpec, Placement
from app.imaging.openai_engine import OpenAIImageEngine


def _white_b64(w: int = 256, h: int = 256) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (255, 255, 255)).save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _white_bytes() -> bytes:
    return base64.b64decode(_white_b64())


class _FakeImages:
    def __init__(self, b64: str) -> None:
        self.b64 = b64
        self.generate_kwargs: dict | None = None
        self.edit_kwargs: dict | None = None

    async def generate(self, **kwargs):
        self.generate_kwargs = kwargs
        n = kwargs.get("n", 1)
        return SimpleNamespace(data=[SimpleNamespace(b64_json=self.b64) for _ in range(n)])

    async def edit(self, **kwargs):
        self.edit_kwargs = kwargs
        return SimpleNamespace(data=[SimpleNamespace(b64_json=self.b64)])


class _FakeChatCompletions:
    def __init__(self) -> None:
        self.kwargs: dict | None = None

    async def create(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="a richly detailed wolf ✦"))]
        )


class _FakeClient:
    def __init__(self, b64: str) -> None:
        self.images = _FakeImages(b64)
        self.chat = SimpleNamespace(completions=_FakeChatCompletions())


def _engine() -> tuple[OpenAIImageEngine, _FakeClient]:
    client = _FakeClient(_white_b64())
    settings = Settings(
        _env_file=None,
        image_engine="openai",
        openai_api_key="sk-test",
        openai_image_model="gpt-image-2",
        openai_composite_model="gpt-image-2",
    )
    return OpenAIImageEngine(settings, client=client), client


async def test_generate_on_white_no_transparent_param():
    eng, client = _engine()
    designs = await eng.generate_design(
        GenSpec(prompt="a wolf", style_slugs=["fine-line"], n=2)
    )
    assert len(designs) == 2
    assert designs[0].png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    kw = client.images.generate_kwargs
    assert kw["model"] == "gpt-image-2"
    assert "background" not in kw  # gpt-image-2 rejects transparent; we use white
    assert "white background" in kw["prompt"]
    assert "wolf" in kw["prompt"]


async def test_composite_sends_guide_design_and_original():
    eng, client = _engine()
    out = await eng.composite_on_body(
        _white_bytes(), _white_bytes(), Placement(x_pct=0.5, y_pct=0.5, scale=0.3)
    )
    assert out.png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    kw = client.images.edit_kwargs
    assert kw["model"] == "gpt-image-2"
    # guide (geometry) + clean design (linework) + untouched original (occlusion)
    assert len(kw["image"]) == 3
    assert [img[0] for img in kw["image"]] == [
        "placement.png",
        "design.png",
        "original.png",
    ]
    assert "rotation" in kw["prompt"]
    assert "straighten" in kw["prompt"]
    assert "occlu" in kw["prompt"].lower()  # the occlusion fix is in the prompt


async def test_enhance_calls_chat_model():
    eng, client = _engine()
    out = await eng.enhance_prompt("wolf", ["fine-line"])
    assert "wolf" in out.lower()
    assert client.chat.completions.kwargs["model"] == "gpt-4o-mini"
