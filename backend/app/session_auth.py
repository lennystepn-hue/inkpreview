"""Anonymous signed-session tokens.

On first visit the client POSTs /api/session → we create an anonymous ``users``
row and return a signed token carrying its id. The token is sent on every
request (Authorization: Bearer / X-Session-Token). Email magic-link (later) will
simply attach an email to the same row — no migration, no token change.
"""

from fastapi import Depends, Header, HTTPException, status
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import User

_serializer = URLSafeSerializer(get_settings().session_secret, salt="inkpreview-session")


def issue_token(user_id: str) -> str:
    return _serializer.dumps(user_id)


def read_user_id(token: str) -> str | None:
    try:
        value = _serializer.loads(token)
        return value if isinstance(value, str) else None
    except BadSignature:
        return None


def extract_token(authorization: str | None, x_session_token: str | None) -> str | None:
    if x_session_token:
        return x_session_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return None


async def current_user(
    authorization: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    session: AsyncSession = Depends(get_session),
) -> User:
    token = extract_token(authorization, x_session_token)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing session token")
    user_id = read_user_id(token)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session token")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown session")
    return user
