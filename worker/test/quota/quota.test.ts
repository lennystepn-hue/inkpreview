// Port of backend/app/tests/test_quota.py (GUEST_GENERATION_LIMIT=2 project).
import { describe, expect, it } from "vitest";

import { auth, call, createDesign, createUser, db, postJson } from "../helpers";

describe("generation quota (cost kill-switch)", () => {
  it("usage reports the guest lifetime quota", async () => {
    const h = await auth();
    const data = await (await call("/api/usage", { headers: h })).json<any>();
    expect(data).toMatchObject({ plan: "free", period: "lifetime", limit: 2, used: 0, remaining: 2, reset_at: null, promo: false });
  });

  it("guest is blocked after the limit with a structured 402", async () => {
    const h = await auth();
    for (let i = 0; i < 2; i++) expect((await postJson("/api/designs", { prompt: "x", styles: [] }, h)).status).toBe(202);
    const r = await postJson("/api/designs", { prompt: "x", styles: [] }, h);
    expect(r.status).toBe(402);
    const detail = (await r.json<any>()).detail;
    expect(detail).toMatchObject({ error: "quota_exceeded", limit: 2, used: 2, remaining: 0, reset_at: null });
    expect(await (await call("/api/designs", { headers: h })).json<any[]>()).toHaveLength(2);
    expect((await (await call("/api/usage", { headers: h })).json<any>()).remaining).toBe(0);
  });

  it("variants need enough remaining units (all-or-nothing)", async () => {
    const h = await auth();
    const parentId = (await createDesign(h, "wolf")).id;
    expect((await call(`/api/designs/${parentId}/variants?count=2`, { method: "POST", headers: h })).status).toBe(402);
    expect(await (await call("/api/designs", { headers: h })).json<any[]>()).toHaveLength(1);
  });

  it("a failed job refunds exactly one unit", async () => {
    const h = await auth();
    const d1 = (await createDesign(h, "a")).id;
    await createDesign(h, "b");
    expect((await postJson("/api/designs", { prompt: "c", styles: [] }, h)).status).toBe(402);
    await db().failDesign(d1, "boom");
    await db().failDesign(d1, "boom again");
    const usage = await (await call("/api/usage", { headers: h })).json<any>();
    expect([usage.used, usage.remaining]).toEqual([1, 1]);
  });

  it("bonus credits raise the allowance", async () => {
    const { headers } = await createUser({ credits: 2 });
    const usage = await (await call("/api/usage", { headers })).json<any>();
    expect([usage.limit, usage.remaining]).toEqual([4, 4]);
  });

  it("logged-in free users get a monthly quota with a reset date", async () => {
    const { headers } = await createUser({ email: "f@x.com", is_anonymous: false });
    const usage = await (await call("/api/usage", { headers })).json<any>();
    expect(usage.period).toBe("month");
    expect(usage.reset_at).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
  });

  it("pro is unlimited but still ledgered", async () => {
    const { headers } = await createUser({ email: "p@x.com", is_anonymous: false, plan: "pro" });
    for (let i = 0; i < 4; i++) expect((await postJson("/api/designs", { prompt: "x", styles: [] }, headers)).status).toBe(202);
    const usage = await (await call("/api/usage", { headers })).json<any>();
    expect([usage.limit, usage.remaining, usage.used]).toEqual([null, null, 4]);
  });
});
