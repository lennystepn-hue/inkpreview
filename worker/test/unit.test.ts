// Port of backend/app/tests: test_processing, test_watermark, test_prompts,
// test_styles, test_mock_engine, test_openai_engine, test_moderation, plus
// codec/token/signature tests against Pillow/itsdangerous/Stripe references.
import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { type EncodedImage, type ImageEngine, ModerationError } from "../src/imaging/engine";
import { applyOrientation, decodeJpeg, encodeJpeg, exifOrientation } from "../src/imaging/jpeg";
import { MockImageEngine } from "../src/imaging/mock";
import { OpenAIImageEngine } from "../src/imaging/openai";
import { decodePng, encodePng } from "../src/imaging/png";
import { cleanBodyPhoto, makeStencil, overlayDesignGuide, watermarkAndResize } from "../src/imaging/processing";
import { buildCompositePrompt, buildGenerationPrompt } from "../src/imaging/prompts";
import { createRaster, resize, rotate, thumbnailSize } from "../src/imaging/raster";
import { getSettings } from "../src/config";
import { runComposite, runGeneration } from "../src/jobs";
import { parseWebhookEvent } from "../src/lib/stripe";
import { dumps, loads, readUserId, timedDumps, timedLoads } from "../src/lib/tokens";
import { allRecipes, getRecipe } from "../src/styles/catalog";
import exifFixture from "./fixtures/exif-jpeg.json";
import pngSuite from "./fixtures/png-suite.json";
import stencilFixture from "./fixtures/stencil.json";
import { auth, b64decode, createPreview, db, png, postJson, sql } from "./helpers";

const px = (r: { width: number; data: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * r.width + x) * 4;
  return [r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]];
};

describe("PNG codec", () => {
  for (const c of pngSuite) {
    it(`decodes ${c.name} like Pillow`, async () => {
      const img = await decodePng(b64decode(c.png));
      expect([img.width, img.height]).toEqual([c.w, c.h]);
      expect(Array.from(img.data)).toEqual(Array.from(b64decode(c.rgba)));
    });
  }

  it("round-trips RGB and RGBA", async () => {
    const r = createRaster(37, 11);
    for (let i = 0; i < r.data.length; i++) r.data[i] = (i * 7) % 256;
    const back = await decodePng(await encodePng(r, { channels: 4 }));
    expect(Array.from(back.data)).toEqual(Array.from(r.data));
    const rgb = await decodePng(await encodePng(r, { channels: 3 }));
    for (let i = 0; i < r.data.length; i += 4) {
      expect([rgb.data[i], rgb.data[i + 1], rgb.data[i + 2], rgb.data[i + 3]]).toEqual([r.data[i], r.data[i + 1], r.data[i + 2], 255]);
    }
  });
});

describe("JPEG + EXIF", () => {
  it("honors EXIF orientation like ImageOps.exif_transpose", () => {
    const bytes = b64decode(exifFixture.jpeg);
    expect(exifOrientation(bytes)).toBe(6);
    const img = applyOrientation(decodeJpeg(bytes), exifOrientation(bytes));
    expect([img.width, img.height]).toEqual([exifFixture.w, exifFixture.h]);
    const [r, g, b] = px(img, img.width - 3, 3);
    const [er, eg, eb] = exifFixture.topRight;
    expect(Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb)).toBeLessThan(40);
  });

  it("cleanBodyPhoto re-encodes to a metadata-free, upright JPEG", async () => {
    const out = await cleanBodyPhoto(b64decode(exifFixture.jpeg));
    expect(exifOrientation(out)).toBe(1);
    expect(new TextDecoder("latin1").decode(out)).not.toContain("Exif");
    const img = decodeJpeg(out);
    expect([img.width, img.height]).toEqual([exifFixture.w, exifFixture.h]);
  });

  it("cleanBodyPhoto caps the long edge at 2048", async () => {
    const big = createRaster(3000, 1500, [120, 90, 80, 255]);
    const img = decodeJpeg(await cleanBodyPhoto(encodeJpeg(big, 80)));
    expect([img.width, img.height]).toEqual([2048, 1024]);
  });

  it("cleanBodyPhoto refuses huge photos before decoding them", async () => {
    const huge = encodeJpeg(createRaster(4032, 3024, [120, 90, 80, 255]), 50);
    await expect(cleanBodyPhoto(huge)).rejects.toThrow("Photo resolution too high");
  });
});

describe("raster ops", () => {
  it("thumbnail size matches Pillow", () => {
    expect(thumbnailSize(1024, 1024, 512, 512)).toEqual([512, 512]);
    expect(thumbnailSize(1000, 333, 512, 512)).toEqual([512, 170]);
    expect(thumbnailSize(300, 200, 512, 512)).toBeNull();
  });

  it("resize keeps flat colors flat and hits the target size", () => {
    const r = resize(createRaster(100, 50, [10, 200, 30, 255]), 37, 81);
    expect([r.width, r.height]).toEqual([37, 81]);
    expect(px(r, 18, 40)).toEqual([10, 200, 30, 255]);
  });

  it("rotate expand grows the canvas like Pillow", () => {
    const r = rotate(createRaster(100, 50, [255, 0, 0, 255]), -30, { expand: true, resample: "bicubic" });
    expect([r.width, r.height]).toEqual([112, 94]);
    expect(px(r, 56, 47)[3]).toBe(255);
    expect(px(r, 1, 1)[3]).toBe(0);
  });
});

describe("processing (Pillow parity)", () => {
  it("stencil is pixel-identical to the Pillow version", async () => {
    const out = await decodePng(await makeStencil(b64decode(stencilFixture.design)));
    const gray = new Uint8Array(out.width * out.height);
    for (let i = 0; i < gray.length; i++) gray[i] = out.data[i * 4];
    expect(Array.from(gray)).toEqual(Array.from(b64decode(stencilFixture.grayB64)));
  });

  it("stencil turns strokes black and washes white", async () => {
    const src = createRaster(200, 200, [255, 255, 255, 255]);
    for (let x = 40; x < 160; x++) {
      for (let y = 95; y < 105; y++) src.data.set([10, 10, 10, 255], (y * 200 + x) * 4);
      src.data.set([225, 225, 225, 255], (30 * 200 + x) * 4);
    }
    const out = await decodePng(await makeStencil(await encodePng(src)));
    expect(px(out, 100, 100)[0]).toBe(0);
    expect(px(out, 100, 30)[0]).toBe(255);
  });

  it("guide overlays the motif at the tapped spot and drops white", async () => {
    const design = createRaster(200, 200, [255, 255, 255, 255]);
    for (let y = 70; y <= 130; y++) for (let x = 70; x <= 130; x++) design.data.set([10, 10, 10, 255], (y * 200 + x) * 4);
    const skin = await encodePng(createRaster(400, 600, [210, 170, 140, 255]));
    const guide = await decodePng(await overlayDesignGuide(skin, await encodePng(design), { x_pct: 0.5, y_pct: 0.3, scale: 0.45, rotation: 0 }));
    expect([guide.width, guide.height]).toEqual([400, 600]);
    expect(px(guide, 5, 5)).toEqual([210, 170, 140, 255]);
    const [r, g, b] = px(guide, 200, 180);
    expect(r < 120 && g < 120 && b < 120).toBe(true);
  });

  const lime = () => encodePng(createRaster(1024, 1024, [200, 255, 0, 255]));

  it("watermark: downscale, changes pixels, keeps full res when paid", async () => {
    const small = await decodePng(await watermarkAndResize(await lime(), { maxPx: 512, watermark: false }));
    expect(Math.max(small.width, small.height)).toBeLessThanOrEqual(512);
    const plain = await watermarkAndResize(await encodePng(createRaster(512, 512, [200, 255, 0, 255])), { maxPx: 512, watermark: false });
    const marked = await watermarkAndResize(await encodePng(createRaster(512, 512, [200, 255, 0, 255])), { maxPx: 512, watermark: true });
    expect(Array.from((await decodePng(plain)).data)).not.toEqual(Array.from((await decodePng(marked)).data));
    const full = await decodePng(await watermarkAndResize(await lime(), { maxPx: null, watermark: false }));
    expect([full.width, full.height]).toEqual([1024, 1024]);
  });

  it("studio brand stamps pixels at full resolution", async () => {
    const plain = await decodePng(await watermarkAndResize(await lime(), { watermark: false }));
    const branded = await decodePng(await watermarkAndResize(await lime(), { watermark: false, brand: "Studio Müller" }));
    expect([branded.width, branded.height]).toEqual([1024, 1024]);
    expect(Array.from(branded.data)).not.toEqual(Array.from(plain.data));
  });

  it("artist file upscales to 2048 with 300 DPI", async () => {
    const bytes = await watermarkAndResize(await lime(), { watermark: false, upscaleTo: 2048 });
    const img = await decodePng(bytes);
    expect([img.width, img.height]).toEqual([2048, 2048]);
    expect(new TextDecoder("latin1").decode(bytes.subarray(0, 64))).toContain("pHYs");
  });
});

describe("prompts + catalog", () => {
  it("generation prompt: subject, style cues, rules", () => {
    const p = buildGenerationPrompt({ prompt: "a howling wolf", style_slugs: ["fine-line"], color: false, line_weight: "medium", complexity: "medium", n: 1 });
    expect(p).toContain("howling wolf");
    expect(p).toContain(getRecipe("fine-line")!.positive_cues.split(",")[0].trim());
    expect(p).toContain("stencil-ready");
    expect(p.toLowerCase()).toContain("black and grey");
  });

  it("negatives, unknown-style fallback", () => {
    const spec = { color: true, line_weight: "medium", complexity: "medium", n: 1 };
    expect(buildGenerationPrompt({ ...spec, prompt: "rose", style_slugs: ["blackwork"] })).toContain("Avoid:");
    const p = buildGenerationPrompt({ ...spec, prompt: "star", style_slugs: ["nope-not-real"] });
    expect(p).toContain("star");
    expect(p).toContain("no skin");
  });

  it("composite prompt keeps geometry + size word", () => {
    const cp = buildCompositePrompt({ x_pct: 0.5, y_pct: 0.5, scale: 0.5, rotation: 0 }).toLowerCase();
    for (const w of ["straighten", "rotation", "(a large tattoo)", "skin", "occlu"]) expect(cp).toContain(w);
  });

  it("catalog: ≥40 distinct recipes with cues", () => {
    const recipes = allRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(40);
    expect(new Set(recipes.map((r) => r.slug)).size).toBe(recipes.length);
    for (const r of recipes) {
      expect(r.positive_cues.trim()).toBeTruthy();
      expect(r.negative_cues.trim()).toBeTruthy();
      expect(r.base_qualifiers).toContain("stencil-ready");
      for (const k of ["color", "line_weight", "complexity"]) expect(r.default_modifiers).toHaveProperty(k);
    }
    for (const slug of ["fine-line", "blackwork", "american-traditional", "japanese-irezumi", "watercolor"]) {
      expect(getRecipe(slug)).toBeDefined();
    }
  });
});

describe("mock engine", () => {
  const spec = { prompt: "wolf", style_slugs: ["fine-line"], color: true, line_weight: "medium", complexity: "medium", n: 2 };

  it("generates distinct transparent-corner PNGs", async () => {
    const out = await new MockImageEngine().generateDesign(spec);
    expect(out).toHaveLength(2);
    const a = await decodePng(out[0].png);
    expect([a.width, a.height]).toEqual([1024, 1024]);
    expect(px(a, 2, 2)[3]).toBe(0);
    expect(Array.from(a.data)).not.toEqual(Array.from((await decodePng(out[1].png)).data));
  });

  it("composite keeps body dimensions", async () => {
    const [d] = await new MockImageEngine().generateDesign({ ...spec, n: 1 });
    const res = await new MockImageEngine().compositeOnBody(await png(300, 400), d.png, { x_pct: 0.5, y_pct: 0.5, scale: 0.3, rotation: 15 });
    expect([res.width, res.height]).toEqual([300, 400]);
  });
});

describe("OpenAI engine (fake fetch)", () => {
  const settings = { ...getSettings(env), imageEngine: "openai" as const, openaiApiKey: "sk-test" };

  function fake() {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const white = await encodePng(createRaster(64, 64, [255, 255, 255, 255]));
      let bin = "";
      for (const b of white) bin += String.fromCharCode(b);
      const b64 = btoa(bin);
      if (url.endsWith("/chat/completions")) {
        return Response.json({ choices: [{ message: { content: "a richly detailed wolf ✦" } }] });
      }
      const n = url.endsWith("/images/generations") ? JSON.parse(String(init.body)).n : 1;
      return Response.json({ data: Array.from({ length: n }, () => ({ b64_json: b64 })) });
    }) as unknown as typeof fetch;
    return { calls, engine: new OpenAIImageEngine(settings, fetcher) };
  }

  it("generate: white background, no transparency param", async () => {
    const { calls, engine } = fake();
    const out = await engine.generateDesign({ prompt: "a wolf", style_slugs: ["fine-line"], color: true, line_weight: "medium", complexity: "medium", n: 2 });
    expect(out).toHaveLength(2);
    expect(Array.from(out[0].png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://api.openai.com/v1/images/generations");
    expect(body.model).toBe("gpt-image-2");
    expect(body).not.toHaveProperty("background");
    expect(body.prompt).toContain("white background");
    expect(body.prompt).toContain("wolf");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("composite sends guide, design and original", async () => {
    const { calls, engine } = fake();
    const white = await encodePng(createRaster(64, 64, [255, 255, 255, 255]));
    await engine.compositeOnBody(white, white, { x_pct: 0.5, y_pct: 0.5, scale: 0.3, rotation: 0 });
    const form = calls[0].init.body as FormData;
    const images = form.getAll("image[]") as File[];
    expect(images.map((f) => f.name)).toEqual(["placement.png", "design.png", "original.png"]);
    expect(form.get("model")).toBe("gpt-image-2");
    const prompt = String(form.get("prompt"));
    expect(prompt).toContain("rotation");
    expect(prompt).toContain("straighten");
  });

  it("enhance uses the chat model", async () => {
    const { calls, engine } = fake();
    expect((await engine.enhancePrompt("wolf", ["fine-line"])).toLowerCase()).toContain("wolf");
    expect(JSON.parse(String(calls[0].init.body)).model).toBe("gpt-4o-mini");
  });

  it("default fetcher calls the global fetch unbound (no 'Illegal invocation')", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async function (this: unknown, url: string) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      seen.push(url);
      return Response.json({ choices: [{ message: { content: "wolf ink" } }] });
    });
    try {
      expect(await new OpenAIImageEngine(settings).enhancePrompt("wolf", [])).toBe("wolf ink");
      expect(seen).toEqual(["https://api.openai.com/v1/chat/completions"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps a moderation rejection to ModerationError", async () => {
    const fetcher = (async () =>
      Response.json({ error: { message: "Your request was rejected by the safety system.", code: "moderation_blocked" } }, { status: 400 })) as unknown as typeof fetch;
    const engine = new OpenAIImageEngine(settings, fetcher);
    await expect(engine.generateDesign({ prompt: "x", style_slugs: [], color: true, line_weight: "medium", complexity: "medium", n: 1 })).rejects.toBeInstanceOf(ModerationError);
  });
});

describe("moderation handling (jobs)", () => {
  const blocked = { generateDesign: async () => { throw new ModerationError("blocked"); } } as unknown as ImageEngine;

  it("generation: typed error + quota refund", async () => {
    const user = await db().sessionUser(null);
    const res = await db().createDesign(user.id, { prompt: "x", styles: [], modifiers: {} }, { key: user.id, limit: 100, windowS: 60 });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.designs[0].id : "";
    await runGeneration(env, id, blocked);
    const d = (await db().getDesign(id))!;
    expect(d.status).toBe("failed");
    expect(d.error).toBe("moderation_blocked");
    const [net] = await sql<{ n: number }>("SELECT SUM(delta) AS n FROM usage_ledger WHERE design_id = ?", id);
    expect(net.n).toBe(0);
    // A second failure of the same design never refunds twice.
    await db().failDesign(id, "again");
    const [net2] = await sql<{ n: number }>("SELECT SUM(delta) AS n FROM usage_ledger WHERE design_id = ?", id);
    expect(net2.n).toBe(0);
  });

  async function queuedPreview(): Promise<string> {
    const h = await auth();
    const { previewId } = await createPreview(h);
    await sql("UPDATE previews SET status = 'queued', output_url = NULL WHERE id = ?", previewId);
    return previewId;
  }

  it("composite: auto-crop retry recovers", async () => {
    const pid = await queuedPreview();
    let calls = 0;
    const flaky = {
      compositeOnBody: async (): Promise<EncodedImage> => {
        calls++;
        if (calls === 1) throw new ModerationError("blocked");
        return { png: await png(10, 10), width: 10, height: 10 };
      },
    } as unknown as ImageEngine;
    await runComposite(env, pid, flaky);
    const p = (await db().getPreview(pid))!;
    expect(calls).toBe(2);
    expect(p.status).toBe("done");
    expect(p.output_url).toBeTruthy();
  });

  it("composite: typed failure when the retry is blocked too", async () => {
    const pid = await queuedPreview();
    const always = { compositeOnBody: async () => { throw new ModerationError("blocked"); } } as unknown as ImageEngine;
    await runComposite(env, pid, always);
    const p = (await db().getPreview(pid))!;
    expect(p.status).toBe("failed");
    expect(p.error).toBe("moderation_blocked");
  });

  it("finished jobs are not re-run (idempotent queue retries)", async () => {
    const h = await auth();
    const d = await (await postJson("/api/designs", { prompt: "x", styles: [] }, h)).json<any>();
    let called = false;
    await runGeneration(env, d.id, { generateDesign: async () => { called = true; return []; } } as unknown as ImageEngine);
    expect(called).toBe(false);
  });
});

describe("tokens (itsdangerous-compatible)", () => {
  it("reads tokens issued by the Python backend", async () => {
    // Generated with itsdangerous 2.2 (see scripts): URLSafeSerializer("test-secret", salt="inkpreview-session")
    expect(await readUserId(".eJxTMjA0MjYxNTO3sExMSk5JTUPnKwEAkmIJCQ.807CZ520bNK84V4I2x8WO0XBPF8", "test-secret")).toBe(
      "0123456789abcdef0123456789abcdef",
    );
    expect(await readUserId(".eJxTMjA0MjYxNTO3sExMSk5JTUPnKwEAkmIJCQ.807CZ520bNK84V4I2x8WO0XBPF8", "other-secret")).toBeNull();
  });

  it("round-trips and rejects tampering", async () => {
    const t = await dumps("user-1", "s3cret", "salt");
    expect(await loads(t, "s3cret", "salt")).toBe("user-1");
    expect(await loads(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "s3cret", "salt")).toBeNull();
    expect(await loads(t, "s3cret", "other-salt")).toBeNull();
  });

  it("timed tokens expire", async () => {
    const old = await timedDumps({ uid: "a" }, "s", "st", Math.floor(Date.now() / 1000) - 700);
    expect(await timedLoads(old, "s", "st", 600)).toBeNull();
    const fresh = await timedDumps({ uid: "a" }, "s", "st");
    expect(await timedLoads(fresh, "s", "st", 600)).toEqual({ uid: "a" });
  });
});

describe("Stripe webhook signature", () => {
  async function sign(payload: string, secret: string, t: number): Promise<string> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
    return `t=${t},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  it("accepts valid, rejects forged and stale", async () => {
    const payload = JSON.stringify({ type: "x", data: { object: {} } });
    const now = Math.floor(Date.now() / 1000);
    expect((await parseWebhookEvent(payload, await sign(payload, "whsec_1", now), "whsec_1")).type).toBe("x");
    await expect(parseWebhookEvent(payload, await sign(payload, "whsec_2", now), "whsec_1")).rejects.toThrow();
    await expect(parseWebhookEvent(payload, await sign(payload, "whsec_1", now - 1000), "whsec_1")).rejects.toThrow();
    await expect(parseWebhookEvent(payload, "garbage", "whsec_1")).rejects.toThrow();
  });
});
