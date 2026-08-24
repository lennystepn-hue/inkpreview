"""Stripe billing: disabled-by-default guards + plan-flip webhook logic.

The plan-flip (`apply_event`) is tested directly with synthetic Stripe event
dicts — no network, no keys, no signature. The HTTP guards verify the feature
stays inert until configured.
"""

from datetime import UTC, datetime

from app.config import get_settings
from app.models import User
from app.services import billing
from app.session_auth import issue_token


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _enable_billing(monkeypatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(s, "stripe_price_id", "price_x")


async def test_billing_disabled_by_default(client):
    r = await client.get("/api/billing/config")
    assert r.status_code == 200
    assert r.json()["enabled"] is False


async def test_checkout_503_when_unconfigured(client):
    h = await _auth(client)
    r = await client.post("/api/billing/checkout", headers=h)
    assert r.status_code == 503


async def test_checkout_requires_login(client, monkeypatch):
    _enable_billing(monkeypatch)
    h = await _auth(client)  # anonymous user, no email
    r = await client.post("/api/billing/checkout", headers=h)
    assert r.status_code == 403  # must sign in to upgrade


async def test_checkout_requires_withdrawal_waiver(client, monkeypatch):
    _enable_billing(monkeypatch)
    async with client._maker() as s:
        u = User(email="x@y.com", is_anonymous=False)
        s.add(u)
        await s.commit()
        uid = u.id
    h = {"Authorization": f"Bearer {issue_token(uid)}"}
    # No consent in the body → 400 (won't start a digital subscription).
    r = await client.post("/api/billing/checkout", headers=h)
    assert r.status_code == 400


async def test_webhook_503_when_unconfigured(client):
    r = await client.post(
        "/api/billing/webhook", content=b"{}", headers={"stripe-signature": "x"}
    )
    assert r.status_code == 503


async def test_apply_checkout_completed_sets_pro(client):
    async with client._maker() as s:
        u = User(email="a@b.com", is_anonymous=False)
        s.add(u)
        await s.commit()
        await billing.apply_event(
            s,
            {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "client_reference_id": u.id,
                        "customer": "cus_1",
                        "subscription": "sub_1",
                    }
                },
            },
        )
        await s.refresh(u)
        assert u.plan == "pro"
        assert u.stripe_customer_id == "cus_1"
        assert u.stripe_subscription_id == "sub_1"


async def test_apply_subscription_updated_active_then_pastdue(client):
    async with client._maker() as s:
        u = User(email="a@b.com", is_anonymous=False, stripe_customer_id="cus_5")
        s.add(u)
        await s.commit()

        period_end = int(datetime(2030, 1, 1, tzinfo=UTC).timestamp())
        await billing.apply_event(
            s,
            {
                "type": "customer.subscription.updated",
                "data": {
                    "object": {
                        "customer": "cus_5",
                        "id": "sub_5",
                        "status": "active",
                        "current_period_end": period_end,
                    }
                },
            },
        )
        await s.refresh(u)
        assert u.plan == "pro" and u.stripe_subscription_id == "sub_5"
        assert u.pro_period_end is not None

        await billing.apply_event(
            s,
            {
                "type": "customer.subscription.updated",
                "data": {"object": {"customer": "cus_5", "id": "sub_5", "status": "past_due"}},
            },
        )
        await s.refresh(u)
        assert u.plan == "free"


async def test_apply_subscription_deleted_downgrades(client):
    async with client._maker() as s:
        u = User(
            email="a@b.com",
            is_anonymous=False,
            plan="pro",
            stripe_customer_id="cus_9",
            stripe_subscription_id="sub_9",
        )
        s.add(u)
        await s.commit()
        await billing.apply_event(
            s,
            {
                "type": "customer.subscription.deleted",
                "data": {"object": {"customer": "cus_9"}},
            },
        )
        await s.refresh(u)
        assert u.plan == "free"
        assert u.stripe_subscription_id is None
