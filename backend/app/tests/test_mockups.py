"""Saved on-skin mockups: login-gated, and decoupled from the ephemeral source."""

import io
from datetime import timedelta

from PIL import Image
from sqlalchemy import update

from app.config import get_settings
from app.models import BodyPhoto, Preview, User, _now
from app.services.cleanup import sweep_expired
from app.session_auth import issue_token
from app.storage import get_storage


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


async def _anon(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def _login(client) -> dict[str, str]:
    async with client._maker() as s:
        u = User(email="pro@x.com", is_anonymous=False)
        s.add(u)
        await s.commit()
        uid = u.id
    return {"Authorization": f"Bearer {issue_token(uid)}"}


async def _make_preview(client, headers) -> str:
    design_id = (
        await client.post("/api/designs", json={"prompt": "rose", "styles": []}, headers=headers)
    ).json()["id"]
    body_id = (
        await client.post(
            "/api/body-photos", files={"file": ("a.png", _png(), "image/png")}, headers=headers
        )
    ).json()["id"]
    return (
        await client.post(
            "/api/previews",
            json={"design_id": design_id, "body_photo_id": body_id, "x_pct": 0.5, "y_pct": 0.5},
            headers=headers,
        )
    ).json()["id"]


async def test_save_requires_login(client):
    h = await _anon(client)
    pid = await _make_preview(client, h)
    r = await client.post("/api/mockups", json={"preview_id": pid}, headers=h)
    assert r.status_code == 403


async def test_save_and_list(client):
    h = await _login(client)
    pid = await _make_preview(client, h)
    r = await client.post("/api/mockups", json={"preview_id": pid}, headers=h)
    assert r.status_code == 201
    mid = r.json()["id"]
    assert r.json()["output_url"]
    listed = (await client.get("/api/mockups", headers=h)).json()
    assert any(m["id"] == mid for m in listed)


async def test_mockup_survives_body_photo_sweep(client):
    h = await _login(client)
    pid = await _make_preview(client, h)
    mid = (await client.post("/api/mockups", json={"preview_id": pid}, headers=h)).json()["id"]

    storage = get_storage(get_settings())
    async with client._maker() as s:
        past = _now() - timedelta(hours=1)
        await s.execute(update(BodyPhoto).values(expires_at=past))
        await s.execute(update(Preview).values(expires_at=past))
        await s.commit()
        deleted = await sweep_expired(s, storage)
    assert deleted >= 2  # the source photo + its preview were swept

    assert (await client.get(f"/api/previews/{pid}", headers=h)).status_code == 404
    listed = (await client.get("/api/mockups", headers=h)).json()
    assert any(m["id"] == mid for m in listed)  # mockup persisted
    assert await storage.get(f"mockups/{mid}.png")  # its image object survived


async def test_delete_mockup(client):
    h = await _login(client)
    pid = await _make_preview(client, h)
    mid = (await client.post("/api/mockups", json={"preview_id": pid}, headers=h)).json()["id"]
    assert (await client.delete(f"/api/mockups/{mid}", headers=h)).status_code == 204
    listed = (await client.get("/api/mockups", headers=h)).json()
    assert all(m["id"] != mid for m in listed)
