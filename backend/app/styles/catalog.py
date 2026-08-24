"""Style catalog — loaded from recipes.json (static reference data).

Each recipe is a hand-/AI-authored prompt recipe. Internal prompt cues
(positive_cues / negative_cues / base_qualifiers) drive generation and are NOT
exposed to the client (the "secret sauce"); only public fields are served.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_RECIPES_PATH = Path(__file__).parent / "recipes.json"


@dataclass(frozen=True)
class StyleRecipe:
    slug: str
    name: str
    category: str
    description: str
    positive_cues: str
    negative_cues: str
    base_qualifiers: str
    default_modifiers: dict
    tags: list[str]


@lru_cache
def load_recipes() -> dict[str, StyleRecipe]:
    data = json.loads(_RECIPES_PATH.read_text(encoding="utf-8"))
    rows = data["recipes"] if isinstance(data, dict) else data
    out: dict[str, StyleRecipe] = {}
    for r in rows:
        out[r["slug"]] = StyleRecipe(
            slug=r["slug"],
            name=r["name"],
            category=r.get("category", "other"),
            description=r.get("description", ""),
            positive_cues=r.get("positive_cues", ""),
            negative_cues=r.get("negative_cues", ""),
            base_qualifiers=r.get("base_qualifiers", ""),
            default_modifiers=r.get("default_modifiers", {}),
            tags=r.get("tags", []),
        )
    return out


def all_recipes() -> list[StyleRecipe]:
    return sorted(load_recipes().values(), key=lambda r: (r.category, r.name))


def get_recipe(slug: str) -> StyleRecipe | None:
    return load_recipes().get(slug)
