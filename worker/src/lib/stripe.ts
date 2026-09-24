/**
 * Stripe billing (Pro subscription) over the REST API with fetch — Checkout,
 * Customer Portal, cancellation, and webhook signature verification. Same
 * requests the stripe-python SDK made, pinned to the same API version.
 */

import { type Settings } from "../config";
import { type User } from "../db/types";

const API = "https://api.stripe.com/v1";
const API_VERSION = "2026-05-27.dahlia";
/** stripe-python's default webhook timestamp tolerance. */
const TOLERANCE_S = 300;

export const billingEnabled = (s: Settings) => Boolean(s.stripeSecretKey && s.stripePriceId);

/** Stripe's bracket notation for nested form params (a[b][0][c]=…). */
function encodeForm(value: unknown, prefix: string, out: URLSearchParams): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
    }
  } else {
    out.append(prefix, String(value));
  }
}

async function stripe(settings: Settings, method: "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<any> {
  const body = new URLSearchParams();
  if (params) encodeForm(params, "", body);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${settings.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": API_VERSION,
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? "request failed"}`);
  return data;
}

export async function createCustomer(settings: Settings, user: User): Promise<string> {
  const customer = await stripe(settings, "POST", "/customers", {
    email: user.email,
    name: user.name || undefined,
    metadata: { user_id: user.id },
  });
  return customer.id as string;
}

export async function createCheckoutSession(settings: Settings, user: User, customerId: string): Promise<string> {
  const base = settings.frontendBaseUrl;
  const params: Record<string, unknown> = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: settings.stripePriceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${base}/?upgrade=success`,
    cancel_url: `${base}/?upgrade=cancel`,
    allow_promotion_codes: true,
    locale: "auto",
    // Consumer-law: collect the billing address + (B2B) VAT ID so VAT/OSS can be
    // applied and a proper invoice issued.
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    metadata: { user_id: user.id, withdrawal_waived: "true" },
    subscription_data: { metadata: { user_id: user.id } },
    custom_text: {
      submit: {
        message:
          "Mit dem Kauf verlangst du den sofortigen Leistungsbeginn und " +
          "verzichtest auf dein Widerrufsrecht. / By subscribing you request " +
          "immediate access and waive your right of withdrawal.",
      },
    },
  };
  // VAT/OSS is computed automatically only when Stripe Tax is enabled.
  if (settings.stripeAutomaticTax) {
    params.automatic_tax = { enabled: true };
    params.customer_update = { address: "auto", name: "auto" };
  }
  const cs = await stripe(settings, "POST", "/checkout/sessions", params);
  return cs.url as string;
}

export async function createPortalSession(settings: Settings, customerId: string): Promise<string> {
  const ps = await stripe(settings, "POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: `${settings.frontendBaseUrl}/`,
  });
  return ps.url as string;
}

/** Cancel the user's subscription (best-effort; used on account deletion). */
export async function cancelSubscription(settings: Settings, user: User): Promise<void> {
  if (!billingEnabled(settings) || !user.stripe_subscription_id) return;
  await stripe(settings, "DELETE", `/subscriptions/${user.stripe_subscription_id}`);
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify the ``Stripe-Signature`` header (HMAC-SHA256 over "t.payload") and
 * return the parsed event; throws on a bad/forged/stale signature.
 */
export async function parseWebhookEvent(payload: string, sigHeader: string, secret: string, nowS = Date.now() / 1000): Promise<any> {
  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=", 2).map((x) => x.trim());
    if (k === "t") timestamp = Number.parseInt(v, 10);
    else if (k === "v1" && v) signatures.push(v);
  }
  if (timestamp < 0 || !signatures.length) throw new Error("Unable to extract timestamp and signatures from header");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  if (!signatures.some((sig) => timingSafeEqual(sig, expected))) throw new Error("No signatures found matching the expected signature");
  if (timestamp < nowS - TOLERANCE_S) throw new Error("Timestamp outside the tolerance zone");
  return JSON.parse(payload);
}
