// Billing + Google login with (fake) credentials configured — no network calls.
import { describe, expect, it } from "vitest";

import { auth, call, createUser, db, postJson } from "../helpers";

async function stripeSig(payload: string, secret: string): Promise<string> {
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  return `t=${t},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

describe("billing (configured)", () => {
  it("config is enabled with the publishable key", async () => {
    expect(await (await call("/api/billing/config")).json()).toEqual({ enabled: true, publishable_key: "pk_test_x" });
  });

  it("checkout requires login, then the withdrawal waiver", async () => {
    expect((await call("/api/billing/checkout", { method: "POST", headers: await auth() })).status).toBe(403);
    const { headers } = await createUser({ email: "x@y.com", is_anonymous: false });
    expect((await call("/api/billing/checkout", { method: "POST", headers })).status).toBe(400);
    expect((await postJson("/api/billing/checkout", { waive_withdrawal: false }, headers)).status).toBe(400);
  });

  it("portal needs a Stripe customer", async () => {
    const { headers } = await createUser({ email: "z@y.com", is_anonymous: false });
    expect((await call("/api/billing/portal", { method: "POST", headers })).status).toBe(409);
  });

  it("webhook verifies the signature and flips the plan", async () => {
    const { id } = await createUser({ email: "w@y.com", is_anonymous: false });
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: id, customer: "cus_w", subscription: "sub_w" } },
    });
    const forged = await call("/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": await stripeSig(payload, "whsec_other") } });
    expect(forged.status).toBe(400);
    expect((await db().getUser(id))!.plan).toBe("free");
    const ok = await call("/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": await stripeSig(payload, "whsec_test") } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ received: true });
    expect((await db().getUser(id))!.plan).toBe("pro");
  });
});

describe("google login (configured)", () => {
  it("redirects to Google with a signed state carrying the anon user + language", async () => {
    const s = await (await call("/api/session", { method: "POST" })).json<any>();
    const r = await call(`/api/auth/google/login?lang=de&token=${encodeURIComponent(s.token)}&ref=abc`, { redirect: "manual" });
    expect(r.status).toBe(302);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("client_id")).toBe("client-id");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://ink-preview.com/api/auth/google/callback");
    expect(loc.searchParams.get("scope")).toBe("openid email profile");
    expect(loc.searchParams.get("state")).toBeTruthy();
  });
});
