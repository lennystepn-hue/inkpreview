from fastapi import APIRouter

from app.schemas import StylePublic
from app.styles.catalog import all_recipes

router = APIRouter(prefix="/api", tags=["styles"])


@router.get("/styles", response_model=list[StylePublic])
async def list_styles() -> list[StylePublic]:
    """Public style catalog (internal prompt cues are intentionally not exposed)."""
    return [
        StylePublic(
            slug=r.slug,
            name=r.name,
            category=r.category,
            description=r.description,
            tags=r.tags,
            default_modifiers=r.default_modifiers,
        )
        for r in all_recipes()
    ]
