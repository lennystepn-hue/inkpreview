import io

from PIL import Image


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (200, 300), (190, 160, 150)).save(buf, "PNG")
    return buf.getvalue()


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_capture_handoff_flow(client):
    h = await _auth(client)  # the desktop user
    token = (await client.post("/api/captures", headers=h)).json()["token"]
    assert token

    # the PHONE uploads with no auth — the token authorizes it
    up = await client.post(
        f"/api/captures/{token}/photo", files={"file": ("arm.png", _png(), "image/png")}
    )
    assert up.status_code == 201

    # the desktop polls and gets the photo
    st = (await client.get(f"/api/captures/{token}", headers=h)).json()
    assert st["status"] == "uploaded"
    assert st["body_photo_id"]
    assert st["url"]

    # and the photo is usable by the desktop user for a preview
    design_id = (
        await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h)
    ).json()["id"]
    pv = await client.post(
        "/api/previews",
        json={
            "design_id": design_id,
            "body_photo_id": st["body_photo_id"],
            "x_pct": 0.5,
            "y_pct": 0.5,
        },
        headers=h,
    )
    assert pv.status_code == 202


async def test_capture_with_design_and_placement(client):
    h = await _auth(client)  # desktop
    design_id = (
        await client.post("/api/designs", json={"prompt": "a wolf", "styles": []}, headers=h)
    ).json()["id"]
    # Desktop creates a capture bound to the design.
    token = (
        await client.post("/api/captures", json={"design_id": design_id}, headers=h)
    ).json()["token"]

    # Phone (no auth) reads which design to overlay on the live camera.
    info = (await client.get(f"/api/captures/{token}/info")).json()
    assert info["status"] == "pending"
    assert info["design_thumb_url"]  # public /media url the phone can render

    # Phone uploads the snapped frame WITH the live placement.
    up = await client.post(
        f"/api/captures/{token}/photo",
        files={"file": ("arm.png", _png(), "image/png")},
        data={"x_pct": "0.4", "y_pct": "0.6", "scale": "0.35", "rotation": "12"},
    )
    assert up.status_code == 201

    # Desktop poll gets the photo + the placement to auto-composite.
    st = (await client.get(f"/api/captures/{token}", headers=h)).json()
    assert st["status"] == "uploaded" and st["body_photo_id"]
    assert st["x_pct"] == 0.4 and st["scale"] == 0.35 and st["rotation"] == 12


async def test_capture_upload_invalid_token(client):
    up = await client.post(
        "/api/captures/not-a-real-token/photo", files={"file": ("a.png", _png(), "image/png")}
    )
    assert up.status_code == 404


async def test_capture_status_owner_only(client):
    h1 = await _auth(client)
    token = (await client.post("/api/captures", headers=h1)).json()["token"]
    h2 = await _auth(client)
    r = await client.get(f"/api/captures/{token}", headers=h2)
    assert r.status_code == 404


async def test_capture_single_use(client):
    h = await _auth(client)
    token = (await client.post("/api/captures", headers=h)).json()["token"]
    await client.post(
        f"/api/captures/{token}/photo", files={"file": ("a.png", _png(), "image/png")}
    )
    again = await client.post(
        f"/api/captures/{token}/photo", files={"file": ("a.png", _png(), "image/png")}
    )
    assert again.status_code == 409
