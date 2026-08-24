import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def _design_and_body(client, headers) -> tuple[str, str]:
    design_id = (
        await client.post("/api/designs", json={"prompt": "a rose", "styles": []}, headers=headers)
    ).json()["id"]
    body_id = (
        await client.post(
            "/api/body-photos", files={"file": ("arm.png", _png(), "image/png")}, headers=headers
        )
    ).json()["id"]
    return design_id, body_id


async def test_create_preview_composites(client):
    h = await _auth(client)
    design_id, body_id = await _design_and_body(client, h)
    r = await client.post(
        "/api/previews",
        json={
            "design_id": design_id,
            "body_photo_id": body_id,
            "x_pct": 0.5,
            "y_pct": 0.4,
            "scale": 0.5,
            "rotation": 20,
        },
        headers=h,
    )
    assert r.status_code == 202
    data = r.json()
    assert data["status"] == "done"  # inline mock finishes synchronously
    assert data["output_url"]
    assert data["scale"] == 0.5
    assert data["rotation"] == 20


async def test_get_preview(client):
    h = await _auth(client)
    design_id, body_id = await _design_and_body(client, h)
    pid = (
        await client.post(
            "/api/previews",
            json={"design_id": design_id, "body_photo_id": body_id, "x_pct": 0.5, "y_pct": 0.5},
            headers=h,
        )
    ).json()["id"]
    g = await client.get(f"/api/previews/{pid}", headers=h)
    assert g.status_code == 200
    assert g.json()["status"] == "done"


async def test_preview_rejects_foreign_design(client):
    h1 = await _auth(client)
    design_id, body_id = await _design_and_body(client, h1)
    h2 = await _auth(client)
    r = await client.post(
        "/api/previews",
        json={"design_id": design_id, "body_photo_id": body_id, "x_pct": 0.5, "y_pct": 0.5},
        headers=h2,
    )
    assert r.status_code == 404


async def test_preview_validates_scale_range(client):
    h = await _auth(client)
    design_id, body_id = await _design_and_body(client, h)
    r = await client.post(
        "/api/previews",
        json={
            "design_id": design_id,
            "body_photo_id": body_id,
            "x_pct": 0.5,
            "y_pct": 0.5,
            "scale": 2.0,  # > 1.0 → invalid
        },
        headers=h,
    )
    assert r.status_code == 422
