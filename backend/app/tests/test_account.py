"""GDPR export + account erasure."""

import io

import pytest
from PIL import Image

from app.config import get_settings
from app.models import Design, Mockup, User
from app.session_auth import issue_token
from app.storage import get_storage


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


async def _login(client) -> dict[str, str]:
    async with client._maker() as s:
        u = User(email="me@x.com", name="Me", is_anonymous=False)
        s.add(u)
        await s.commit()
        uid = u.id
    return {"Authorization": f"Bearer {issue_token(uid)}"}


async def test_export_includes_profile_and_designs(client):
    h = await _login(client)
    await client.post("/api/designs", json={"prompt": "a phoenix", "styles": []}, headers=h)
    r = await client.get("/api/account/export", headers=h)
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")
    data = r.json()
    assert data["account"]["email"] == "me@x.com"
    assert any(d["prompt"] == "a phoenix" for d in data["designs"])


async def test_delete_account_erases_rows_and_objects(client):
    h = await _login(client)
    design_id = (
        await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h)
    ).json()["id"]
    body_id = (
        await client.post(
            "/api/body-photos", files={"file": ("a.png", _png(), "image/png")}, headers=h
        )
    ).json()["id"]
    pid = (
        await client.post(
            "/api/previews",
            json={"design_id": design_id, "body_photo_id": body_id, "x_pct": 0.5, "y_pct": 0.5},
            headers=h,
        )
    ).json()["id"]
    mid = (await client.post("/api/mockups", json={"preview_id": pid}, headers=h)).json()["id"]

    storage = get_storage(get_settings())
    assert await storage.get(f"designs/{design_id}.png")  # exists before deletion

    r = await client.post("/api/account/delete", headers=h)
    assert r.status_code == 204

    # Token is now dead — the user no longer exists.
    assert (await client.get("/api/session/me", headers=h)).status_code == 401

    # Rows are gone.
    async with client._maker() as s:
        assert await s.get(Design, design_id) is None
        assert await s.get(Mockup, mid) is None

    # Storage objects are gone.
    with pytest.raises(FileNotFoundError):
        await storage.get(f"designs/{design_id}.png")
    with pytest.raises(FileNotFoundError):
        await storage.get(f"mockups/{mid}.png")


async def test_brand_requires_studio_plan(client):
    # A normal (free) logged-in user cannot set a studio brand.
    h = await _login(client)
    r = await client.post("/api/account/brand", json={"brand_name": "Acme Ink"}, headers=h)
    assert r.status_code == 403


async def test_studio_can_set_brand(client):
    from app.session_auth import issue_token

    async with client._maker() as s:
        u = User(email="studio@x.com", is_anonymous=False, plan="studio")
        s.add(u)
        await s.commit()
        uid = u.id
    h = {"Authorization": f"Bearer {issue_token(uid)}"}
    r = await client.post("/api/account/brand", json={"brand_name": "Acme Ink"}, headers=h)
    assert r.status_code == 200
    assert r.json()["brand_name"] == "Acme Ink"
    assert r.json()["plan"] == "studio"
