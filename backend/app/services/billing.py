"""Stripe billing — Pro subscription (Checkout + Customer Portal + webhooks).

Opt-in: with no ``STRIPE_SECRET_KEY``/``STRIPE_PRICE_ID`` the feature is disabled
(endpoints return 503, no upgrade UI). Stripe's SDK is synchronous, so network
calls run in a worker thread to avoid blocking the event loop. ``apply_event`` —
the plan-flip logic — is pure given a parsed event, so it's unit-tested without
ever touching Stripe.
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import User

# Subscription statuses that grant Pro. Everything else (canceled, unpaid,
# past_due, incomplete...) drops back to free.
_ACTIVE_STATUSES = {"active", "trialing"}


def billing_enabled(settings: Settings) -> bool:
    return bool(settings.stripe_secret_key and settings.stripe_price_id)


def _stripe(settings: Settings):
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


async def ensure_customer(session: AsyncSession, user: User, settings: Settings) -> str:
    """Return the user's Stripe customer id, creating it on first use."""
    if user.stripe_customer_id:
        return user.stripe_customer_id
    stripe = _stripe(settings)
    customer = await asyncio.to_thread(
        stripe.Customer.create,
        email=user.email,
        name=user.name or None,
        metadata={"user_id": user.id},
    )
    user.stripe_customer_id = customer["id"]
    await session.commit()
    return customer["id"]


async def create_checkout_session(
    session: AsyncSession, user: User, settings: Settings
) -> str:
    stripe = _stripe(settings)
    customer_id = await ensure_customer(session, user, settings)
    base = settings.frontend_base_url.rstrip("/")
    params: dict = dict(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        client_reference_id=user.id,
        success_url=f"{base}/?upgrade=success",
        cancel_url=f"{base}/?upgrade=cancel",
        allow_promotion_codes=True,
        locale="auto",
        # Consumer-law: collect the billing address + (B2B) VAT ID so VAT/OSS can
        # be applied and a proper invoice issued.
        billing_address_collection="required",
        tax_id_collection={"enabled": True},
        metadata={"user_id": user.id, "withdrawal_waived": "true"},
        subscription_data={"metadata": {"user_id": user.id}},
        custom_text={
            "submit": {
                "message": (
                    "Mit dem Kauf verlangst du den sofortigen Leistungsbeginn und "
                    "verzichtest auf dein Widerrufsrecht. / By subscribing you request "
                    "immediate access and waive your right of withdrawal."
                )
            }
        },
    )
    # VAT/OSS is computed automatically only when Stripe Tax is enabled.
    if settings.stripe_automatic_tax:
        params["automatic_tax"] = {"enabled": True}
        params["customer_update"] = {"address": "auto", "name": "auto"}
    cs = await asyncio.to_thread(stripe.checkout.Session.create, **params)
    return cs["url"]


async def create_portal_session(user: User, settings: Settings) -> str:
    stripe = _stripe(settings)
    base = settings.frontend_base_url.rstrip("/")
    ps = await asyncio.to_thread(
        stripe.billing_portal.Session.create,
        customer=user.stripe_customer_id,
        return_url=f"{base}/",
    )
    return ps["url"]


async def cancel_subscription(user: User, settings: Settings) -> None:
    """Cancel the user's Stripe subscription (best-effort; used on account deletion)."""
    if not (billing_enabled(settings) and user.stripe_subscription_id):
        return
    stripe = _stripe(settings)
    await asyncio.to_thread(stripe.Subscription.delete, user.stripe_subscription_id)


def parse_event(payload: bytes, sig_header: str, settings: Settings) -> dict:
    """Verify the Stripe signature and return the event (raises on bad signature)."""
    stripe = _stripe(settings)
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


async def _user_by_customer(session: AsyncSession, customer_id: str | None) -> User | None:
    if not customer_id:
        return None
    return (
        await session.execute(select(User).where(User.stripe_customer_id == customer_id))
    ).scalar_one_or_none()


def _period_end(obj: dict) -> datetime | None:
    ts = obj.get("current_period_end")
    return datetime.fromtimestamp(ts, tz=UTC) if ts else None


async def apply_event(session: AsyncSession, event: dict) -> None:
    """Flip a user's plan based on a Stripe subscription lifecycle event.

    Handles the events that change entitlement; ignores everything else. Pure
    w.r.t. Stripe (operates on the already-parsed event dict).
    """
    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        uid = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        customer_id = obj.get("customer")
        user = await session.get(User, uid) if uid else None
        if user is None:
            user = await _user_by_customer(session, customer_id)
        if user:
            user.stripe_customer_id = customer_id or user.stripe_customer_id
            user.stripe_subscription_id = obj.get("subscription") or user.stripe_subscription_id
            user.plan = "pro"
            user.is_anonymous = False
            await session.commit()

    elif etype in ("customer.subscription.created", "customer.subscription.updated"):
        user = await _user_by_customer(session, obj.get("customer"))
        if user:
            user.plan = "pro" if obj.get("status") in _ACTIVE_STATUSES else "free"
            user.stripe_subscription_id = obj.get("id")
            user.pro_period_end = _period_end(obj)
            await session.commit()

    elif etype == "customer.subscription.deleted":
        user = await _user_by_customer(session, obj.get("customer"))
        if user:
            user.plan = "free"
            user.stripe_subscription_id = None
            user.pro_period_end = None
            await session.commit()
