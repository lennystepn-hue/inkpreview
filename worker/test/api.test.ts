// Port of backend/app/tests: test_api_basic, test_designs, test_designs_extra,
// test_styles (endpoint), test_previews, test_body_photos, test_exports,
// test_mockups, test_captures, test_account, test_billing (guards), test_share.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { decodePng } from "../src/imaging/png";
import { sweep } from "../src/index";
import {
  auth,
  call,
  createDesign,
  createPreview,
  createUser,
  db,
  mediaExists,
  png,
  postJson,
  sql,
  uploadPhoto,
} from "./helpers";

describe("basic", () => {
  it("health", async () => {
    const r = await call("/api/health");
    expect(r.status).toBe(200);
    const body = await r.json<any>();
    expect(body.status).toBe("ok");
    expect(body.version).toBeTruthy();
  });

  it("ready checks db + storage", async () => {
    const r = await call("/api/ready");
    expect(r.status).toBe(200);
    const body = await r.json<any>();
    expect(body.status).toBe("ready");
    expect(body.checks.db).toBe("ok");
    expect(body.checks.storage).toBe("ok");
  });

  it("session create returns token", async () => {
    const r = await call("/api/session", { method: "POST" });
    expect(r.status).toBe(200);
    const data = await r.json<any>();
    expect(data.token).toBeTruthy();
    expect(data.user_id).toBeTruthy();
    expect(data.is_anonymous).toBe(true);
    expect(data.plan).toBe("free");
  });

  it("session reuse returns the same user and token", async () => {
    const first = await (await call("/api/session", { method: "POST" })).json<any>();
    const again = await (
      await call("/api/session", { method: "POST", headers: { Authorization: `Bearer ${first.token}` } })
    ).json<any>();
    expect(again.user_id).toBe(first.user_id);
    expect(again.token).toBe(first.token);
  });

  it("X-Session-Token header works too", async () => {
    const s = await (await call("/api/session", { method: "POST" })).json<any>();
    const r = await call("/api/session/me", { headers: { "X-Session-Token": s.token } });
    expect(r.status).toBe(200);
  });

  it("me requires a valid token", async () => {
    expect((await call("/api/session/me")).status).toBe(401);
    expect((await call("/api/session/me", { headers: { Authorization: "Bearer not-a-real-token" } })).status).toBe(401);
    const h = await auth();
    const r = await call("/api/session/me", { headers: h });
    expect(r.status).toBe(200);
    expect((await r.json<any>()).is_anonymous).toBe(true);
  });

  it("unknown api route is a JSON 404", async () => {
    const r = await call("/api/nope");
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ detail: "Not Found" });
  });

  it("geo falls back to Accept-Language", async () => {
    const r = await call("/api/geo", { headers: { "Accept-Language": "de-DE,de;q=0.9" } });
    const body = await r.json<any>();
    expect(["de", "en"]).toContain(body.lang);
  });
});

describe("styles", () => {
  it("public fields only", async () => {
    const r = await call("/api/styles");
    expect(r.status).toBe(200);
    const styles = await r.json<any[]>();
    expect(styles.length).toBeGreaterThanOrEqual(40);
    expect(new Set(Object.keys(styles[0]))).toEqual(new Set(["slug", "name", "category", "description", "tags", "default_modifiers"]));
    expect(styles[0]).not.toHaveProperty("positive_cues");
  });
});

describe("designs", () => {
  it("create generates via mock (inline job)", async () => {
    const h = await auth();
    const r = await postJson("/api/designs", { prompt: "a howling wolf", styles: ["fine-line"], color: false }, h);
    expect(r.status).toBe(202);
    const data = await r.json<any>();
    expect(data.id).toBeTruthy();
    expect(data.status).toBe("done");
    expect(data.clean_png_url).toBe(`/media/designs/${data.id}.png`);
    expect(data.thumb_url).toBe(`/media/designs/${data.id}_thumb.png`);
    expect(data.width).toBe(1024);
    expect(data.height).toBe(1024);
    const thumb = await decodePng(new Uint8Array(await (await call(data.thumb_url)).arrayBuffer()));
    expect([thumb.width, thumb.height]).toEqual([512, 512]);
  });

  it("get design; invisible to other users; requires auth", async () => {
    const h = await auth();
    const id = (await createDesign(h, "rose")).id;
    const g = await call(`/api/designs/${id}`, { headers: h });
    expect(g.status).toBe(200);
    expect((await g.json<any>()).status).toBe("done");
    expect((await call(`/api/designs/${id}`, { headers: await auth() })).status).toBe(404);
    expect((await postJson("/api/designs", { prompt: "x" })).status).toBe(401);
  });

  it("validates the body like pydantic (422)", async () => {
    const h = await auth();
    expect((await postJson("/api/designs", { prompt: "" }, h)).status).toBe(422);
    expect((await postJson("/api/designs", { styles: [] }, h)).status).toBe(422);
    expect((await postJson("/api/designs", { prompt: "x".repeat(1001) }, h)).status).toBe(422);
    const bad = await call("/api/designs", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{nope" });
    expect(bad.status).toBe(422);
  });

  it("variants have a parent and generate", async () => {
    const h = await auth();
    const parentId = (await createDesign(h, "a wolf", ["fine-line"])).id;
    const r = await call(`/api/designs/${parentId}/variants?count=3`, { method: "POST", headers: h });
    expect(r.status).toBe(202);
    const variants = await r.json<any[]>();
    expect(variants).toHaveLength(3);
    for (const v of variants) {
      expect(v.parent_design_id).toBe(parentId);
      expect(v.status).toBe("done");
      expect(v.clean_png_url).toBeTruthy();
    }
  });

  it("refine appends the instruction and keeps the parent", async () => {
    const h = await auth();
    const parentId = (await createDesign(h, "a wolf", ["fine-line"])).id;
    const r = await postJson(`/api/designs/${parentId}/refine`, { prompt: "add roses" }, h);
    expect(r.status).toBe(202);
    const child = await r.json<any>();
    expect(child.parent_design_id).toBe(parentId);
    expect(child.id).not.toBe(parentId);
    expect(child.prompt).toBe("a wolf, add roses");
    expect(child.status).toBe("done");
  });

  it("refine rejects empty and unknown", async () => {
    const h = await auth();
    const parentId = (await createDesign(h, "a wolf")).id;
    expect((await postJson(`/api/designs/${parentId}/refine`, { prompt: "   " }, h)).status).toBe(422);
    expect((await postJson("/api/designs/nope/refine", { prompt: "x" }, h)).status).toBe(404);
  });

  it("gallery lists own designs newest first, isolated per user", async () => {
    const h = await auth();
    await createDesign(h, "first");
    await createDesign(h, "second");
    const designs = await (await call("/api/designs", { headers: h })).json<any[]>();
    expect(designs.map((d) => d.prompt)).toEqual(["second", "first"]);
    expect(await (await call("/api/designs", { headers: await auth() })).json()).toEqual([]);
  });

  it("feed is public and leaks no user info", async () => {
    const h = await auth();
    await createDesign(h, "feed-one");
    await createDesign(h, "feed-two");
    const r = await call("/api/feed");
    expect(r.status).toBe(200);
    const items = await r.json<any[]>();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(new Set(Object.keys(items[0]))).toEqual(new Set(["id", "thumb_url", "clean_png_url"]));
    expect((await call("/api/feed?limit=abc")).status).toBe(422);
  });

  it("enhance prompt expands", async () => {
    const h = await auth();
    const r = await postJson("/api/prompt/enhance", { prompt: "wolf", styles: ["fine-line"] }, h);
    expect(r.status).toBe(200);
    const enhanced = (await r.json<any>()).enhanced as string;
    expect(enhanced.toLowerCase()).toContain("wolf");
    expect(enhanced.length).toBeGreaterThan(4);
  });
});

describe("body photos + previews", () => {
  it("upload strips to JPEG and expires", async () => {
    const h = await auth();
    const r = await uploadPhoto("/api/body-photos", h, await png(120, 160));
    expect(r.status).toBe(201);
    const data = await r.json<any>();
    expect(data.id).toBeTruthy();
    expect(data.url).toBe(`/media/ephemeral/body/${data.id}.jpg`);
    expect(Date.parse(data.expires_at)).toBeGreaterThan(Date.now() + 23 * 3600_000);
    const media = await call(data.url);
    expect(media.headers.get("content-type")).toBe("image/jpeg");
    expect(media.headers.get("cache-control")).toContain("private");
  });

  it("refuses an oversized upload before reading it", async () => {
    const h = await auth();
    const r = await call("/api/body-photos", {
      method: "POST",
      headers: { ...h, "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(50 * 1024 * 1024) },
      body: "--x--",
    });
    expect(r.status).toBe(413);
  });

  it("rejects non-images, requires auth, requires a file", async () => {
    const h = await auth();
    expect((await uploadPhoto("/api/body-photos", h, new TextEncoder().encode("not an image"))).status).toBe(400);
    expect((await uploadPhoto("/api/body-photos", {})).status).toBe(401);
    expect((await call("/api/body-photos", { method: "POST", headers: h, body: new FormData() })).status).toBe(422);
  });

  it("create preview composites (inline mock)", async () => {
    const h = await auth();
    const designId = (await createDesign(h)).id;
    const bodyId = (await (await uploadPhoto("/api/body-photos", h)).json<any>()).id;
    const r = await postJson(
      "/api/previews",
      { design_id: designId, body_photo_id: bodyId, x_pct: 0.5, y_pct: 0.4, scale: 0.5, rotation: 20 },
      h,
    );
    expect(r.status).toBe(202);
    const data = await r.json<any>();
    expect(data.status).toBe("done");
    expect(data.output_url).toBe(`/media/ephemeral/preview/${data.id}.png`);
    expect(data.scale).toBe(0.5);
    expect(data.rotation).toBe(20);
    const out = await decodePng(new Uint8Array(await (await call(data.output_url)).arrayBuffer()));
    expect([out.width, out.height]).toEqual([300, 400]); // mock keeps body dimensions
    const g = await call(`/api/previews/${data.id}`, { headers: h });
    expect(g.status).toBe(200);
    expect((await g.json<any>()).status).toBe("done");
  });

  it("rejects foreign designs and invalid scale", async () => {
    const h1 = await auth();
    const designId = (await createDesign(h1)).id;
    const bodyId = (await (await uploadPhoto("/api/body-photos", h1)).json<any>()).id;
    const h2 = await auth();
    expect((await postJson("/api/previews", { design_id: designId, body_photo_id: bodyId, x_pct: 0.5, y_pct: 0.5 }, h2)).status).toBe(404);
    expect(
      (await postJson("/api/previews", { design_id: designId, body_photo_id: bodyId, x_pct: 0.5, y_pct: 0.5, scale: 2 }, h1)).status,
    ).toBe(422);
  });

  it("sweep deletes expired photos + previews (rows and files)", async () => {
    const h = await auth();
    const { previewId, bodyId } = await createPreview(h);
    const past = new Date(Date.now() - 3600_000).toISOString();
    await sql("UPDATE body_photos SET expires_at = ? WHERE id = ?", past, bodyId);
    await sql("UPDATE previews SET expires_at = ? WHERE id = ?", past, previewId);
    await sweep(env);
    expect(await sql("SELECT id FROM body_photos WHERE id = ?", bodyId)).toHaveLength(0);
    expect(await sql("SELECT id FROM previews WHERE id = ?", previewId)).toHaveLength(0);
    expect(await mediaExists(`/media/ephemeral/body/${bodyId}.jpg`)).toBe(false);
    expect(await mediaExists(`/media/ephemeral/preview/${previewId}.png`)).toBe(false);
    expect((await call(`/api/previews/${previewId}`, { headers: h })).status).toBe(404);
  });
});

describe("exports", () => {
  it("free export is watermarked + downscaled, ships a stencil", async () => {
    const h = await auth();
    const designId = (await createDesign(h)).id;
    const r = await postJson("/api/exports", { design_id: designId }, h);
    expect(r.status).toBe(201);
    const data = await r.json<any>();
    expect(data.watermarked).toBe(true);
    expect(data.hires_url).toBeTruthy();
    expect(data.stencil_url).toBeTruthy();
    expect(data.mockup_url).toBeNull();
    const img = await decodePng(new Uint8Array(await (await call(data.hires_url)).arrayBuffer()));
    expect(Math.max(img.width, img.height)).toBeLessThanOrEqual(1024);
  });

  it("paid export is the print-grade artist file", async () => {
    const { headers } = await createUser({ email: "pro@x.com", is_anonymous: false, plan: "pro" });
    const designId = (await createDesign(headers)).id;
    const data = await (await postJson("/api/exports", { design_id: designId }, headers)).json<any>();
    expect(data.watermarked).toBe(false);
    const bytes = new Uint8Array(await (await call(data.hires_url)).arrayBuffer());
    const img = await decodePng(bytes);
    expect(Math.max(img.width, img.height)).toBe(2048);
    // pHYs = 300 DPI (11811 px/m)
    const text = new TextDecoder("latin1").decode(bytes.subarray(0, 100));
    const i = text.indexOf("pHYs");
    expect(i).toBeGreaterThan(0);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(i + 4)).toBe(11811);
    const stencil = await decodePng(new Uint8Array(await (await call(data.stencil_url)).arrayBuffer()));
    expect(Math.max(stencil.width, stencil.height)).toBe(2048);
  });

  it("export with mockup; get; foreign design 404", async () => {
    const h = await auth();
    const { designId, previewId } = await createPreview(h);
    const data = await (await postJson("/api/exports", { design_id: designId, preview_id: previewId }, h)).json<any>();
    expect(data.hires_url).toBeTruthy();
    expect(data.mockup_url).toBeTruthy();
    const g = await call(`/api/exports/${data.id}`, { headers: h });
    expect(g.status).toBe(200);
    expect((await g.json<any>()).id).toBe(data.id);
    expect((await call(`/api/exports/${data.id}`, { headers: await auth() })).status).toBe(404);
    expect((await postJson("/api/exports", { design_id: designId }, await auth())).status).toBe(404);
  });
});

describe("mockups", () => {
  it("saving requires login", async () => {
    const h = await auth();
    const { previewId } = await createPreview(h);
    expect((await postJson("/api/mockups", { preview_id: previewId }, h)).status).toBe(403);
  });

  it("save, list, survive the sweep, delete", async () => {
    const { headers: h } = await createUser({ email: "m@x.com", is_anonymous: false });
    const { previewId, bodyId } = await createPreview(h);
    const r = await postJson("/api/mockups", { preview_id: previewId }, h);
    expect(r.status).toBe(201);
    const mockup = await r.json<any>();
    expect(mockup.output_url).toBe(`/media/mockups/${mockup.id}.png`);

    const past = new Date(Date.now() - 3600_000).toISOString();
    await sql("UPDATE body_photos SET expires_at = ? WHERE id = ?", past, bodyId);
    await sql("UPDATE previews SET expires_at = ? WHERE id = ?", past, previewId);
    await sweep(env);
    expect((await call(`/api/previews/${previewId}`, { headers: h })).status).toBe(404);
    const listed = await (await call("/api/mockups", { headers: h })).json<any[]>();
    expect(listed.some((m) => m.id === mockup.id)).toBe(true);
    expect(await mediaExists(mockup.output_url)).toBe(true);

    expect((await call(`/api/mockups/${mockup.id}`, { method: "DELETE", headers: h })).status).toBe(204);
    expect((await (await call("/api/mockups", { headers: h })).json<any[]>()).some((m) => m.id === mockup.id)).toBe(false);
    expect(await mediaExists(mockup.output_url)).toBe(false);
    expect((await call(`/api/mockups/${mockup.id}`, { method: "DELETE", headers: h })).status).toBe(404);
  });
});

describe("captures (desktop → phone)", () => {
  it("handoff flow", async () => {
    const h = await auth();
    const token = (await (await call("/api/captures", { method: "POST", headers: h })).json<any>()).token;
    expect(token).toBeTruthy();
    const up = await uploadPhoto(`/api/captures/${token}/photo`, {}, await png(200, 300));
    expect(up.status).toBe(201);
    const st = await (await call(`/api/captures/${token}`, { headers: h })).json<any>();
    expect(st.status).toBe("uploaded");
    expect(st.body_photo_id).toBeTruthy();
    expect(st.url).toBeTruthy();
    const designId = (await createDesign(h, "x")).id;
    const pv = await postJson("/api/previews", { design_id: designId, body_photo_id: st.body_photo_id, x_pct: 0.5, y_pct: 0.5 }, h);
    expect(pv.status).toBe(202);
  });

  it("with design + live placement", async () => {
    const h = await auth();
    const designId = (await createDesign(h, "a wolf")).id;
    const token = (await (await postJson("/api/captures", { design_id: designId }, h)).json<any>()).token;
    const info = await (await call(`/api/captures/${token}/info`)).json<any>();
    expect(info.status).toBe("pending");
    expect(info.design_thumb_url).toBeTruthy();
    const up = await uploadPhoto(`/api/captures/${token}/photo`, {}, await png(200, 300), {
      x_pct: "0.4",
      y_pct: "0.6",
      scale: "0.35",
      rotation: "12",
    });
    expect(up.status).toBe(201);
    const st = await (await call(`/api/captures/${token}`, { headers: h })).json<any>();
    expect(st.status).toBe("uploaded");
    expect([st.x_pct, st.y_pct, st.scale, st.rotation]).toEqual([0.4, 0.6, 0.35, 12]);
  });

  it("foreign design is never bound; placement is clamped", async () => {
    const other = await auth();
    const foreign = (await createDesign(other)).id;
    const h = await auth();
    const token = (await (await postJson("/api/captures", { design_id: foreign }, h)).json<any>()).token;
    expect((await (await call(`/api/captures/${token}/info`)).json<any>()).design_thumb_url).toBeNull();
    await uploadPhoto(`/api/captures/${token}/photo`, {}, undefined, { x_pct: "7", y_pct: "-1", scale: "0", rotation: "999" });
    const st = await (await call(`/api/captures/${token}`, { headers: h })).json<any>();
    expect([st.x_pct, st.y_pct, st.scale, st.rotation]).toEqual([1, 0, 0.05, 180]);
  });

  it("invalid token, owner-only status, single use", async () => {
    expect((await uploadPhoto("/api/captures/not-a-real-token/photo", {})).status).toBe(404);
    expect((await call("/api/captures/not-a-real-token/info")).status).toBe(404);
    const h1 = await auth();
    const token = (await (await call("/api/captures", { method: "POST", headers: h1 })).json<any>()).token;
    expect((await call(`/api/captures/${token}`, { headers: await auth() })).status).toBe(404);
    expect((await uploadPhoto(`/api/captures/${token}/photo`, {})).status).toBe(201);
    expect((await uploadPhoto(`/api/captures/${token}/photo`, {})).status).toBe(409);
  });
});

describe("account (GDPR)", () => {
  it("export includes profile + designs", async () => {
    const { headers } = await createUser({ email: "me@x.com", name: "Me", is_anonymous: false });
    await createDesign(headers, "a phoenix");
    const r = await call("/api/account/export", { headers });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("attachment");
    const data = await r.json<any>();
    expect(data.account.email).toBe("me@x.com");
    expect(data.designs.some((d: any) => d.prompt === "a phoenix")).toBe(true);
  });

  it("delete erases rows and objects", async () => {
    const { id, headers } = await createUser({ email: "del@x.com", is_anonymous: false });
    const { designId, previewId } = await createPreview(headers);
    const mockup = await (await postJson("/api/mockups", { preview_id: previewId }, headers)).json<any>();
    const exp = await (await postJson("/api/exports", { design_id: designId, preview_id: previewId }, headers)).json<any>();
    expect(await mediaExists(`/media/designs/${designId}.png`)).toBe(true);

    expect((await call("/api/account/delete", { method: "POST", headers })).status).toBe(204);
    expect((await call("/api/session/me", { headers })).status).toBe(401);
    for (const table of ["users", "designs", "mockups", "usage_ledger", "body_photos"]) {
      const col = table === "users" ? "id" : "user_id";
      expect(await sql(`SELECT 1 FROM ${table} WHERE ${col} = ?`, id)).toHaveLength(0);
    }
    for (const url of [`/media/designs/${designId}.png`, mockup.output_url, exp.hires_url, exp.stencil_url, exp.mockup_url]) {
      expect(await mediaExists(url)).toBe(false);
    }
  });

  it("brand requires the studio plan", async () => {
    const free = await createUser({ email: "f@x.com", is_anonymous: false });
    expect((await postJson("/api/account/brand", { brand_name: "Acme Ink" }, free.headers)).status).toBe(403);
    const studio = await createUser({ email: "s@x.com", is_anonymous: false, plan: "studio" });
    const r = await postJson("/api/account/brand", { brand_name: "Acme Ink" }, studio.headers);
    expect(r.status).toBe(200);
    const body = await r.json<any>();
    expect(body.brand_name).toBe("Acme Ink");
    expect(body.plan).toBe("studio");
  });
});

describe("billing guards (unconfigured)", () => {
  it("disabled by default; 503s", async () => {
    expect(await (await call("/api/billing/config")).json()).toEqual({ enabled: false, publishable_key: null });
    expect((await call("/api/billing/checkout", { method: "POST", headers: await auth() })).status).toBe(503);
    expect((await call("/api/billing/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "x" } })).status).toBe(503);
  });

  it("google login 503 when unconfigured", async () => {
    expect((await call("/api/auth/google/login?lang=de", { redirect: "manual" })).status).toBe(503);
  });

  it("google callback maps a bad state / denial to a frontend redirect", async () => {
    const bad = await call("/api/auth/google/callback?state=forged.x.y&code=c", { redirect: "manual" });
    expect(bad.status).toBe(302);
    expect(bad.headers.get("location")).toBe("https://ink-preview.com/#auth_error=state");
    const denied = await call("/api/auth/google/callback?error=access_denied", { redirect: "manual" });
    expect(denied.headers.get("location")).toBe("https://ink-preview.com/#auth_error=denied");
  });
});

describe("apply Stripe events (plan flips)", () => {
  it("checkout completed → pro", async () => {
    const { id } = await createUser({ email: "a@b.com", is_anonymous: false });
    await db().applyStripeEvent("checkout.session.completed", { client_reference_id: id, customer: "cus_1", subscription: "sub_1" });
    const u = (await db().getUser(id))!;
    expect([u.plan, u.stripe_customer_id, u.stripe_subscription_id]).toEqual(["pro", "cus_1", "sub_1"]);
  });

  it("subscription updated active → past_due", async () => {
    const { id } = await createUser({ email: "c@d.com", is_anonymous: false, stripe_customer_id: "cus_5" });
    const periodEnd = Math.floor(Date.UTC(2030, 0, 1) / 1000);
    await db().applyStripeEvent("customer.subscription.updated", { customer: "cus_5", id: "sub_5", status: "active", current_period_end: periodEnd });
    let u = (await db().getUser(id))!;
    expect(u.plan).toBe("pro");
    expect(u.stripe_subscription_id).toBe("sub_5");
    expect(u.pro_period_end).toBe("2030-01-01T00:00:00.000Z");
    // Newer API versions carry the period on the subscription item.
    await db().applyStripeEvent("customer.subscription.updated", {
      customer: "cus_5",
      id: "sub_5",
      status: "trialing",
      items: { data: [{ current_period_end: periodEnd + 86400 }] },
    });
    expect((await db().getUser(id))!.pro_period_end).toBe("2030-01-02T00:00:00.000Z");
    await db().applyStripeEvent("customer.subscription.updated", { customer: "cus_5", id: "sub_5", status: "past_due" });
    u = (await db().getUser(id))!;
    expect(u.plan).toBe("free");
  });

  it("subscription deleted → free", async () => {
    const { id } = await createUser({ email: "e@f.com", is_anonymous: false, plan: "pro", stripe_customer_id: "cus_9", stripe_subscription_id: "sub_9" });
    await db().applyStripeEvent("customer.subscription.deleted", { customer: "cus_9" });
    const u = (await db().getUser(id))!;
    expect(u.plan).toBe("free");
    expect(u.stripe_subscription_id).toBeNull();
  });
});

describe("google sign-in resolution", () => {
  it("upgrades the anonymous user in place and credits a referrer once", async () => {
    const referrer = await createUser({ email: "ref@x.com", is_anonymous: false });
    const anon = await (await call("/api/session", { method: "POST" })).json<any>();
    await createDesign({ Authorization: `Bearer ${anon.token}` }, "mine");
    const u = await db().resolveGoogleUser(anon.user_id, { sub: "g-1", email: "new@x.com", name: "New", picture: null }, referrer.id);
    expect(u.id).toBe(anon.user_id);
    expect(u.is_anonymous).toBe(false);
    expect(u.referred_by).toBe(referrer.id);
    expect((await db().getUser(referrer.id))!.credits).toBe(1);
    // Signing in again finds the same account and doesn't credit twice.
    const again = await db().resolveGoogleUser("", { sub: "g-1", email: "new@x.com" }, referrer.id);
    expect(again.id).toBe(anon.user_id);
    expect((await db().getUser(referrer.id))!.credits).toBe(1);
  });

  it("links an existing email account", async () => {
    const owner = await createUser({ email: "owner@x.com", is_anonymous: false });
    const u = await db().resolveGoogleUser("", { sub: "g-2", email: "owner@x.com" }, "");
    expect(u.id).toBe(owner.id);
    expect(u.google_sub).toBe("g-2");
  });
});

describe("SEO pages", () => {
  it("share page renders OG tags", async () => {
    const h = await auth();
    const id = (await createDesign(h, "a phoenix rising")).id;
    const r = await call(`/d/${id}`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('property="og:image"');
    expect(body).toContain('name="twitter:card"');
    expect(body).toContain("phoenix rising");
    expect(body).toContain(`/d/${id}`);
  });

  it("404 page still has OG and escapes the path", async () => {
    const r = await call("/d/%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    expect(r.status).toBe(404);
    const text = await r.text();
    expect(text).toContain("og:image");
    expect(text).not.toContain("<script>alert(1)</script>");
  });

  it("JSON-LD can't be broken out of by a prompt", async () => {
    const h = await auth();
    const id = (await createDesign(h, "</script><script>alert(1)</script>")).id;
    const text = await (await call(`/d/${id}`)).text();
    expect(text).not.toContain("<script>alert(1)</script>");
  });

  it("style landing pages (EN + DE)", async () => {
    const styles = await (await call("/api/styles")).json<any[]>();
    const slug = styles[0].slug;
    const r = await call(`/style/${slug}`);
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toContain("og:image");
    expect(text).toContain(styles[0].name);
    expect(text).toContain('"FAQPage"');
    expect(text).toContain('"BreadcrumbList"');
    expect(text).toContain(`hreflang="de" href="https://ink-preview.com/de/style/${slug}"`);
    expect(text).toContain("/tattoo/forearm");
    expect((await call("/style/not-a-real-style")).status).toBe(404);
    const de = await (await call(`/de/style/${slug}`)).text();
    expect(de).toContain('<html lang="de">');
    expect(de).toContain("So funktioniert");
    expect(de).toContain("/de/tattoo/");
  });

  it("body part pages", async () => {
    const r = await call("/tattoo/forearm");
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toContain("Forearm");
    expect(text).toContain('"FAQPage"');
    expect(text).toContain("How do I pick the right size for a forearm tattoo?");
    expect((await call("/tattoo/not-a-part")).status).toBe(404);
    const de = await call("/de/tattoo/forearm");
    expect(de.status).toBe(200);
    expect(await de.text()).toContain("Unterarm");
  });

  it("dynamic sitemap", async () => {
    const r = await call("/sitemap.xml");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("xml");
    const text = await r.text();
    const slug = (await (await call("/api/styles")).json<any[]>())[0].slug;
    for (const s of [`/style/${slug}`, `/de/style/${slug}`, "/tattoo/forearm", "/de/tattoo/forearm", "hreflang=", "/explore"]) {
      expect(text).toContain(s);
    }
  });
});

describe("static assets", () => {
  it("SPA shells and cache headers", async () => {
    const en = await call("/gallery", { headers: { "Sec-Fetch-Mode": "navigate" } });
    expect(en.status).toBe(200);
    expect(en.headers.get("cache-control")).toBe("no-cache");
    expect(await en.text()).toContain('lang="en"');
    const de = await call("/de", { headers: { "Sec-Fetch-Mode": "navigate" } });
    expect(await de.text()).toContain('lang="de"');
    const sw = await call("/sw.js");
    expect(sw.status).toBe(200);
    expect(sw.headers.get("cache-control")).toBe("no-cache");
    const robots = await call("/robots.txt");
    expect(robots.status).toBe(200);
  });

  it("serves the embedded files repeatedly, with ETag revalidation", async () => {
    const first = await call("/og.png");
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/png");
    const size = (await first.arrayBuffer()).byteLength;
    const again = await call("/og.png");
    expect((await again.arrayBuffer()).byteLength).toBe(size);
    const etag = again.headers.get("etag")!;
    const cached = await call("/og.png", { headers: { "If-None-Match": etag } });
    expect(cached.status).toBe(304);
    const head = await call("/og.png", { method: "HEAD" });
    expect(head.status).toBe(200);
  });

  it("hashed assets are immutable; a missing one is a 404, not HTML", async () => {
    const html = await (await call("/")).text();
    const js = /\/assets\/[^"]+\.js/.exec(html)![0];
    const r = await call(js);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect(r.headers.get("content-type")).toContain("javascript");
    expect((await call("/assets/does-not-exist.js")).status).toBe(404);
  });

  it("malformed escapes are a 404/SPA page, never a 500", async () => {
    expect((await call("/media/%E0%A4%A")).status).toBe(404);
    expect((await call("/%E0%A4%A")).status).toBe(200);
  });

  it("canonical redirects only apply in production", async () => {
    // Tests run with APP_ENV=test, so the www/http rules must not interfere.
    const r = await call("/robots.txt");
    expect(r.status).toBe(200);
  });
});
