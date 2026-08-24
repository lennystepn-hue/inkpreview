"""Stripe billing endpoints: config, checkout, customer portal, webhook."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Event, User
from app.schemas import BillingConfigOut, CheckoutCreate, CheckoutOut
from app.services import billing
from app.session_auth import current_user

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/config", response_model=BillingConfigOut)
async def config(settings: Settings = Depends(get_settings)) -> BillingConfigOut:
    """Public: lets the client decide whether to show the upgrade UI."""
    return BillingConfigOut(
        enabled=billing.billing_enabled(settings),
        publishable_key=settings.stripe_publishable_key,
    )


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    payload: CheckoutCreate | None = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> CheckoutOut:
    if not billing.billing_enabled(settings):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Billing not configured")
    if user.is_anonymous or not user.email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign in to upgrade")
    if user.plan == "pro":
        raise HTTPException(status.HTTP_409_CONFLICT, "Already on Pro")
    if not (payload and payload.waive_withdrawal):
        # No immediate-performance consent → can't start a digital subscription.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Withdrawal-right waiver consent required"
        )
    # Record the consent for the audit trail (who waived, when).
    session.add(Event(user_id=user.id, action="pro_withdrawal_waiver", payload={}))
    await session.commit()
    try:
        url = await billing.create_checkout_session(session, user, settings)
    except Exception as exc:  # noqa: BLE001 — surface a clean 502, never a stack trace
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment provider error") from exc
    return CheckoutOut(url=url)


@router.post("/portal", response_model=CheckoutOut)
async def portal(
    user: User = Depends(current_user),
    settings: Settings = Depends(get_settings),
) -> CheckoutOut:
    if not billing.billing_enabled(settings):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Billing not configured")
    if not user.stripe_customer_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "No subscription to manage")
    try:
        url = await billing.create_portal_session(user, settings)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment provider error") from exc
    return CheckoutOut(url=url)


@router.post("/webhook")
async def webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Stripe → us. Signature-verified; flips the user's plan on subscription events."""
    if not (settings.stripe_secret_key and settings.stripe_webhook_secret):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Billing not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = billing.parse_event(payload, sig, settings)
    except Exception as exc:  # noqa: BLE001 — bad/forged signature
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature") from exc
    await billing.apply_event(session, event)
    return {"received": True}
