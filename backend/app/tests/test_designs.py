async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_create_design_generates_via_mock(client):
    h = await _auth(client)
    r = await client.post(
        "/api/designs",
        json={"prompt": "a howling wolf", "styles": ["fine-line"], "color": False},
        headers=h,
    )
    assert r.status_code == 202
    data = r.json()
    assert data["id"]
    # inline job mode → mock finishes synchronously
    assert data["status"] == "done"
    assert data["clean_png_url"].endswith(f"designs/{data['id']}.png")
    assert data["thumb_url"]
    assert data["width"] and data["height"]


async def test_get_design_returns_done(client):
    h = await _auth(client)
    cid = (
        await client.post("/api/designs", json={"prompt": "rose", "styles": []}, headers=h)
    ).json()["id"]
    g = await client.get(f"/api/designs/{cid}", headers=h)
    assert g.status_code == 200
    assert g.json()["status"] == "done"


async def test_design_not_visible_to_other_user(client):
    h1 = await _auth(client)
    cid = (
        await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h1)
    ).json()["id"]
    h2 = await _auth(client)  # different anon user
    g = await client.get(f"/api/designs/{cid}", headers=h2)
    assert g.status_code == 404


async def test_create_requires_auth(client):
    r = await client.post("/api/designs", json={"prompt": "x"})
    assert r.status_code == 401
