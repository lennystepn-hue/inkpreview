from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.imaging.factory import get_engine
from app.models import User
from app.schemas import PromptEnhanceIn, PromptEnhanceOut
from app.session_auth import current_user

router = APIRouter(prefix="/api", tags=["prompt"])


@router.post("/prompt/enhance", response_model=PromptEnhanceOut)
async def enhance_prompt(
    payload: PromptEnhanceIn,
    user: User = Depends(current_user),
    settings: Settings = Depends(get_settings),
) -> PromptEnhanceOut:
    engine = get_engine(settings)
    enhanced = await engine.enhance_prompt(payload.prompt, payload.styles)
    return PromptEnhanceOut(enhanced=enhanced)
