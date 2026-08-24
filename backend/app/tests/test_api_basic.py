async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["version"]


async def test_ready_checks_db(client):
    r = await client.get("/api/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["db"] == "ok"
    # inline job mode (tests) doesn't depend on Redis, so it isn't probed.
    assert "redis" not in body["checks"]


async def test_session_create_returns_token(client):
    r = await client.post("/api/session")
    assert r.status_code == 200
    data = r.json()
    assert data["token"]
    assert data["user_id"]
    assert data["is_anonymous"] is True
    assert data["plan"] == "free"


async def test_session_reuse_same_user(client):
    first = (await client.post("/api/session")).json()
    again = (
        await client.post(
            "/api/session", headers={"Authorization": f"Bearer {first['token']}"}
        )
    ).json()
    assert again["user_id"] == first["user_id"]


async def test_me_requires_token(client):
    r = await client.get("/api/session/me")
    assert r.status_code == 401


async def test_me_with_token(client):
    token = (await client.post("/api/session")).json()["token"]
    r = await client.get("/api/session/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["is_anonymous"] is True


async def test_me_rejects_garbage_token(client):
    r = await client.get("/api/session/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
