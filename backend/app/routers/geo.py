"""Locale hint for the frontend's first-visit language auto-detect.

Behind Cloudflare we get the visitor country for free via the `CF-IPCountry`
header; `Accept-Language` is the fallback when there's no edge geo (e.g. local dev).
"""

from fastapi import APIRouter, Header

router = APIRouter(prefix="/api", tags=["geo"])

# German-speaking regions → default the UI to German.
_DE_COUNTRIES = {"DE", "AT", "CH", "LI"}


@router.get("/geo")
async def geo(
    cf_ipcountry: str | None = Header(default=None, alias="CF-IPCountry"),
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> dict:
    country = (cf_ipcountry or "").strip().upper()
    if country in _DE_COUNTRIES:
        lang = "de"
    elif not country and (accept_language or "").strip().lower().startswith("de"):
        lang = "de"
    else:
        lang = "en"
    return {"country": country or None, "lang": lang}
