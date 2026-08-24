"""Select the concrete image engine from settings."""

from app.config import Settings
from app.imaging.engine import ImageEngine
from app.imaging.mock_engine import MockImageEngine


def get_engine(settings: Settings) -> ImageEngine:
    if settings.image_engine == "openai":
        # Lazy import so the openai engine (and its requirements) only load when used.
        from app.imaging.openai_engine import OpenAIImageEngine

        return OpenAIImageEngine(settings)
    return MockImageEngine()
