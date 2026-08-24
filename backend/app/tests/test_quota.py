"""Generation quota / cost kill-switch."""

import pytest

from app.config import get_settings
from app.models import User
from app.services import quota


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _guest_limit(monkeypatch, n: int) -> None:
    monkeypatch.setattr(get_settings(), "guest_generation_limit", n)


async def test_usage_endpoint_reports_guest_quota(client, monkeypatch):
    _guest_limit(monkeypatch, 2)
    h = await _auth(client)
    r = await client.get("/api/usage", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "free"
    assert data["period"] == "lifetime"
    assert data["limit"] == 2
    assert data["used"] == 0
    assert data["remaining"] == 2
    assert data["reset_at"] is None  # lifetime cap never resets


async def test_guest_blocked_after_limit_with_402(client, monkeypatch):
    _guest_limit(monkeypatch, 2)
    h = await _auth(client)
    for _ in range(2):
        assert (
            await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h)
        ).status_code == 202

    r = await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h)
    assert r.status_code == 402
    detail = r.json()["detail"]
    assert detail["error"] == "quota_exceeded"
    assert detail["limit"] == 2 and detail["used"] == 2 and detail["remaining"] == 0

    # The blocked request must NOT have created a design.
    assert len((await client.get("/api/designs", headers=h)).json()) == 2
    assert (await client.get("/api/usage", headers=h)).json()["remaining"] == 0


async def test_variants_need_enough_remaining(client, monkeypatch):
    _guest_limit(monkeypatch, 2)
    h = await _auth(client)
    parent_id = (
        await client.post("/api/designs", json={"prompt": "wolf", "styles": []}, headers=h)
    ).json()["id"]  # uses 1, remaining 1

    # count=2 needs 2 units but only 1 remains → rejected, nothing created.
    r = await client.post(f"/api/designs/{parent_id}/variants?count=2", headers=h)
    assert r.status_code == 402
    assert len((await client.get("/api/designs", headers=h)).json()) == 1


async def test_refund_restores_a_unit(client, monkeypatch):
    _guest_limit(monkeypatch, 2)
    async with client._maker() as s:
        user = User()
        s.add(user)
        await s.commit()

        await quota.consume(s, user, design_ids=["d1", "d2"])
        await s.commit()
        st = await quota.usage_status(s, user)
        assert st.used == 2 and st.remaining == 0

        # At the cap → next consume raises.
        with pytest.raises(quota.QuotaExceeded):
            await quota.consume(s, user, design_ids=["d3"])
        await s.rollback()
        await s.refresh(user)  # rollback expired the instance

        # Refund d1 → one unit back; a second refund of the same design is a no-op.
        assert await quota.refund(s, user_id=user.id, design_id="d1") is True
        assert await quota.refund(s, user_id=user.id, design_id="d1") is False
        st = await quota.usage_status(s, user)
        assert st.used == 1 and st.remaining == 1


async def test_credits_increase_allowance(client, monkeypatch):
    _guest_limit(monkeypatch, 2)
    async with client._maker() as s:
        user = User(credits=2)  # e.g. earned via referrals
        s.add(user)
        await s.commit()
        st = await quota.usage_status(s, user)
        assert st.limit == 4 and st.remaining == 4  # base 2 + 2 credits


async def test_promo_unlimited_lifts_all_caps(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "promo_unlimited", True)
    monkeypatch.setattr(get_settings(), "guest_generation_limit", 1)
    h = await _auth(client)

    r = (await client.get("/api/usage", headers=h)).json()
    assert r["limit"] is None and r["promo"] is True

    # Way past the normal guest cap — promo lets it through (still ledgered).
    for _ in range(3):
        assert (
            await client.post("/api/designs", json={"prompt": "x", "styles": []}, headers=h)
        ).status_code == 202


async def test_pro_is_unlimited(client):
    async with client._maker() as s:
        user = User(plan="pro", is_anonymous=False)
        s.add(user)
        await s.commit()

        await quota.consume(s, user, design_ids=[f"d{i}" for i in range(50)])
        await s.commit()
        st = await quota.usage_status(s, user)
        assert st.limit is None and st.remaining is None
        assert st.used == 50  # still recorded for analytics / kill-switch
