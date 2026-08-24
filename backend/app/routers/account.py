"""GDPR self-service endpoints: data export (Art. 20) + erasure (Art. 17)."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import User
from app.schemas import BrandUpdate, UserOut
from app.services import account
from app.session_auth import current_user
from app.storage import get_storage

router = APIRouter(prefix="/api/account", tags=["account"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        user_id=user.id,
        credits=user.credits,
        plan=user.plan,
        is_anonymous=user.is_anonymous,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        brand_name=user.brand_name,
    )


@router.post("/brand", response_model=UserOut)
async def set_brand(
    payload: BrandUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    """Set the studio brand stamped on exports (Studio plan only)."""
    if user.plan != "studio":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Studio plan required")
    user.brand_name = payload.brand_name.strip() or None
    await session.commit()
    return _user_out(user)


@router.get("/export")
async def export_data(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Download a machine-readable copy of all data we hold (Art. 20)."""
    data = await account.export_account(session, user)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": 'attachment; filename="inkpreview-data.json"'},
    )


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Permanently erase the account and ALL associated data + files (Art. 17)."""
    await account.delete_account(session, get_storage(settings), user, settings)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
