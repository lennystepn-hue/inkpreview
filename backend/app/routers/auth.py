"""Google OAuth (sign in with Google).

Flow: the SPA redirects the browser to /api/auth/google/login (carrying the
current anonymous session token + language). We bounce to Google; Google calls
back to /api/auth/google/callback with a code; we exchange it, fetch the profile,
then UPGRADE the anonymous user in place (attach google_sub/email/name) so all
their existing designs carry over — or log into the matching account. Finally we
redirect back to the SPA with a fresh session token in the URL fragment.
"""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import User
from app.session_auth import issue_token, read_user_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

_GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"

_state = URLSafeTimedSerializer(get_settings().session_secret, salt="inkpreview-oauth-state")
_STATE_MAX_AGE = 600  # seconds


def _frontend_redirect(settings: Settings, lang: str, fragment: str) -> RedirectResponse:
    base = settings.frontend_base_url.rstrip("/")
    path = "/de" if lang == "de" else "/"
    return RedirectResponse(f"{base}{path}#{fragment}", status_code=status.HTTP_302_FOUND)


@router.get("/google/login")
async def google_login(
    token: str | None = None,
    lang: str = "en",
    ref: str | None = None,
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    if not (settings.google_client_id and settings.google_client_secret):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google login not configured")
    anon_uid = (read_user_id(token) if token else None) or ""
    state = _state.dumps(
        {"uid": anon_uid, "lang": "de" if lang == "de" else "en", "ref": ref or ""}
    )
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"{_GOOGLE_AUTH}?{params}", status_code=status.HTTP_302_FOUND)


async def _resolve_user(session: AsyncSession, anon_uid: str, info: dict) -> User:
    """Find/create the user for a Google profile, preferring to upgrade the anon row."""
    sub = info["sub"]
    email = info.get("email")
    name = info.get("name")
    pic = info.get("picture")

    existing = (
        await session.execute(select(User).where(User.google_sub == sub))
    ).scalar_one_or_none()
    if existing:
        existing.email = email or existing.email
        existing.name = name or existing.name
        existing.avatar_url = pic or existing.avatar_url
        return existing

    anon = await session.get(User, anon_uid) if anon_uid else None

    # If someone already owns this email, link the Google identity to that row.
    if email:
        owner = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if owner:
            owner.google_sub = sub
            owner.name = name or owner.name
            owner.avatar_url = pic or owner.avatar_url
            owner.is_anonymous = False
            return owner

    if anon is not None and anon.is_anonymous and anon.google_sub is None:
        anon.google_sub = sub
        anon.email = email
        anon.name = name
        anon.avatar_url = pic
        anon.is_anonymous = False
        return anon

    user = User(google_sub=sub, email=email, name=name, avatar_url=pic, is_anonymous=False)
    session.add(user)
    return user


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    # recover language + anon uid + referral code from state (default en on any failure)
    lang, anon_uid, ref = "en", "", ""
    if state:
        try:
            data = _state.loads(state, max_age=_STATE_MAX_AGE)
            lang = data.get("lang", "en")
            anon_uid = data.get("uid", "")
            ref = data.get("ref", "")
        except (BadSignature, SignatureExpired):
            return _frontend_redirect(settings, "en", "auth_error=state")

    if error or not code:
        return _frontend_redirect(settings, lang, "auth_error=denied")
    if not (settings.google_client_id and settings.google_client_secret):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google login not configured")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            tok = await client.post(
                _GOOGLE_TOKEN,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            tok.raise_for_status()
            access_token = tok.json()["access_token"]
            ui = await client.get(
                _GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access_token}"}
            )
            ui.raise_for_status()
            info = ui.json()
    except (httpx.HTTPError, KeyError):
        return _frontend_redirect(settings, lang, "auth_error=exchange")

    if not info.get("sub"):
        return _frontend_redirect(settings, lang, "auth_error=profile")

    user = await _resolve_user(session, anon_uid, info)
    await session.commit()
    await session.refresh(user)

    # Referral: credit the referrer once, the first time this user signs in.
    if ref and ref != user.id and user.referred_by is None:
        referrer = await session.get(User, ref)
        if referrer is not None:
            user.referred_by = ref
            referrer.credits = (referrer.credits or 0) + 1
            await session.commit()

    token = issue_token(user.id)
    return _frontend_redirect(settings, lang, f"auth_token={token}")
