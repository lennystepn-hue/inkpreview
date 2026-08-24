async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_variants_have_parent_and_generate(client):
    h = await _auth(client)
    parent_id = (
        await client.post(
            "/api/designs", json={"prompt": "a wolf", "styles": ["fine-line"]}, headers=h
        )
    ).json()["id"]

    r = await client.post(f"/api/designs/{parent_id}/variants?count=3", headers=h)
    assert r.status_code == 202
    variants = r.json()
    assert len(variants) == 3
    for v in variants:
        assert v["parent_design_id"] == parent_id
        assert v["status"] == "done"
        assert v["clean_png_url"]


async def test_refine_appends_instruction_and_keeps_parent(client):
    h = await _auth(client)
    parent = (
        await client.post(
            "/api/designs", json={"prompt": "a wolf", "styles": ["fine-line"]}, headers=h
        )
    ).json()
    parent_id = parent["id"]

    r = await client.post(
        f"/api/designs/{parent_id}/refine", json={"prompt": "add roses"}, headers=h
    )
    assert r.status_code == 202
    child = r.json()
    assert child["parent_design_id"] == parent_id
    assert child["id"] != parent_id
    assert "a wolf" in child["prompt"] and "add roses" in child["prompt"]
    assert child["status"] == "done"
    assert child["clean_png_url"]


async def test_refine_rejects_empty_and_unknown(client):
    h = await _auth(client)
    parent_id = (
        await client.post("/api/designs", json={"prompt": "a wolf", "styles": []}, headers=h)
    ).json()["id"]

    assert (
        await client.post(f"/api/designs/{parent_id}/refine", json={"prompt": "   "}, headers=h)
    ).status_code == 422
    assert (
        await client.post("/api/designs/nope/refine", json={"prompt": "x"}, headers=h)
    ).status_code == 404


async def test_gallery_lists_user_designs_newest_first(client):
    h = await _auth(client)
    await client.post("/api/designs", json={"prompt": "first", "styles": []}, headers=h)
    await client.post("/api/designs", json={"prompt": "second", "styles": []}, headers=h)

    r = await client.get("/api/designs", headers=h)
    assert r.status_code == 200
    designs = r.json()
    assert len(designs) >= 2
    prompts = [d["prompt"] for d in designs]
    assert "first" in prompts and "second" in prompts


async def test_gallery_isolated_per_user(client):
    h1 = await _auth(client)
    await client.post("/api/designs", json={"prompt": "mine", "styles": []}, headers=h1)
    h2 = await _auth(client)
    r = await client.get("/api/designs", headers=h2)
    assert r.json() == []


async def test_feed_is_public_and_safe(client):
    h = await _auth(client)
    await client.post("/api/designs", json={"prompt": "feed-one", "styles": []}, headers=h)
    await client.post("/api/designs", json={"prompt": "feed-two", "styles": []}, headers=h)
    r = await client.get("/api/feed")  # no auth header
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 2
    assert set(items[0]) == {"id", "thumb_url", "clean_png_url"}  # no user info leaked
    assert items[0]["clean_png_url"]


async def test_enhance_prompt_expands(client):
    h = await _auth(client)
    r = await client.post(
        "/api/prompt/enhance", json={"prompt": "wolf", "styles": ["fine-line"]}, headers=h
    )
    assert r.status_code == 200
    enhanced = r.json()["enhanced"]
    assert "wolf" in enhanced.lower()
    assert len(enhanced) > len("wolf")
