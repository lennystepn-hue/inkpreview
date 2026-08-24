import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def _design(client, headers) -> str:
    return (
        await client.post("/api/designs", json={"prompt": "a rose", "styles": []}, headers=headers)
    ).json()["id"]


async def _preview(client, headers, design_id) -> str:
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


async def test_export_design_only_free_is_watermarked(client):
    h = await _auth(client)
    design_id = await _design(client, h)
    r = await client.post("/api/exports", json={"design_id": design_id}, headers=h)
    assert r.status_code == 201
    data = r.json()
    assert data["watermarked"] is True
    assert data["hires_url"]
    assert data["stencil_url"]  # stencil ships with every export
    assert data["mockup_url"] is None


async def test_export_paid_is_print_grade(client):
    from app.config import get_settings
    from app.models import User
    from app.session_auth import issue_token
    from app.storage import get_storage

    async with client._maker() as s:
        u = User(email="pro@x.com", is_anonymous=False, plan="pro")
        s.add(u)
        await s.commit()
        uid = u.id
    h = {"Authorization": f"Bearer {issue_token(uid)}"}
    design_id = await _design(client, h)

    r = await client.post("/api/exports", json={"design_id": design_id}, headers=h)
    assert r.status_code == 201
    data = r.json()
    assert data["watermarked"] is False
    assert data["stencil_url"]

    # The stored artist file is upscaled to print size with 300-DPI metadata.
    storage = get_storage(get_settings())
    png = await storage.get(f"exports/{data['id']}_design.png")
    img = Image.open(io.BytesIO(png))
    assert max(img.size) == 2048
    assert round(img.info["dpi"][0]) == 300

    stencil = Image.open(io.BytesIO(await storage.get(f"exports/{data['id']}_stencil.png")))
    assert max(stencil.size) == 2048


async def test_export_with_mockup(client):
    h = await _auth(client)
    design_id = await _design(client, h)
    preview_id = await _preview(client, h, design_id)
    r = await client.post(
        "/api/exports", json={"design_id": design_id, "preview_id": preview_id}, headers=h
    )
    assert r.status_code == 201
    data = r.json()
    assert data["hires_url"]
    assert data["mockup_url"]


async def test_get_export(client):
    h = await _auth(client)
    design_id = await _design(client, h)
    eid = (await client.post("/api/exports", json={"design_id": design_id}, headers=h)).json()["id"]
    g = await client.get(f"/api/exports/{eid}", headers=h)
    assert g.status_code == 200
    assert g.json()["id"] == eid


async def test_export_foreign_design_404(client):
    h1 = await _auth(client)
    design_id = await _design(client, h1)
    h2 = await _auth(client)
    r = await client.post("/api/exports", json={"design_id": design_id}, headers=h2)
    assert r.status_code == 404
