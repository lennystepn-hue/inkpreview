/**
 * The JSON API under /api — a route-for-route port of the FastAPI backend
 * (backend/app/routers/*): same paths, request/response shapes, status codes
 * and error details, so the frontend works unchanged.
 */

import { type Context, Hono } from "hono";

import { type Settings, getSettings, insecureProdConfig } from "./config";
import { dbStub } from "./context";
import { type CreateDesignsResult, uid } from "./db/database";
import {
  type Design,
  type Export,
  type Mockup,
  type Placement4,
  type Preview,
  type QuotaStatus,
  type RateLimit,
  type User,
} from "./db/types";
import { ARTIST_PX, InvalidImage, cleanBodyPhoto, decodeImage, encodePrintPng, stencilRaster, watermarkRaster } from "./imaging/processing";
import { enqueue, getEngine } from "./jobs";
import { HttpError, Reader, intQuery, jsonBody } from "./lib/http";
import {
  billingEnabled,
  cancelSubscription,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  parseWebhookEvent,
} from "./lib/stripe";
import { issueToken, readUserId, timedDumps, timedLoads } from "./lib/tokens";
import { deleteMedia, getMedia, mediaUrl, putMedia } from "./storage";
import { allRecipes } from "./styles/catalog";

export const VERSION = "0.2.0";

type AppEnv = { Bindings: Env };
type C = Context<AppEnv>;

export const api = new Hono<AppEnv>();

const settingsOf = (c: C): Settings => getSettings(c.env);
const db = (c: C) => dbStub(c.env);

// ───────────────────────── helpers ─────────────────────────

/** Fail fast in production with an insecure config (the Python app refused to boot). */
api.use("*", async (c, next) => {
  const problems = insecureProdConfig(settingsOf(c));
  if (problems.length) {
    console.error("refusing to serve: insecure production config:", problems.join("; "));
    throw new HttpError(503, "Service misconfigured");
  }
  await next();
});

function extractToken(c: C): string | null {
  const x = c.req.header("X-Session-Token");
  if (x) return x;
  const auth = c.req.header("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7);
  return null;
}

async function currentUser(c: C): Promise<User> {
  const token = extractToken(c);
  if (!token) throw new HttpError(401, "Missing session token");
  const userId = await readUserId(token, settingsOf(c).sessionSecret);
  if (!userId) throw new HttpError(401, "Invalid session token");
  const user = await db(c).getUser(userId);
  if (!user) throw new HttpError(401, "Unknown session");
  return user;
}

const generationLimit = (c: C, user: User): RateLimit => {
  const s = settingsOf(c);
  return { key: user.id, limit: s.anonRateLimit, windowS: s.rateLimitWindowS };
};

const TOO_MANY = () => new HttpError(429, "Too many requests — please wait a moment.");

/** Quota overflow → 402 with a structured body the client can act on. */
function quota402(status: QuotaStatus): HttpError {
  return new HttpError(402, {
    error: "quota_exceeded",
    plan: status.plan,
    limit: status.limit,
    used: status.used,
    remaining: status.remaining,
    reset_at: status.reset_at,
  });
}

const userOut = (u: User) => ({
  user_id: u.id,
  credits: u.credits,
  plan: u.plan,
  is_anonymous: u.is_anonymous,
  email: u.email,
  name: u.name,
  avatar_url: u.avatar_url,
  brand_name: u.brand_name,
});

const designOut = (d: Design) => ({
  id: d.id,
  status: d.status,
  prompt: d.prompt,
  styles: d.styles,
  clean_png_url: d.clean_png_url,
  thumb_url: d.thumb_url,
  width: d.width,
  height: d.height,
  parent_design_id: d.parent_design_id,
  error: d.error,
  created_at: d.created_at,
});

const previewOut = (p: Preview) => ({
  id: p.id,
  status: p.status,
  design_id: p.design_id,
  body_photo_id: p.body_photo_id,
  x_pct: p.x_pct,
  y_pct: p.y_pct,
  scale: p.scale,
  rotation: p.rotation,
  output_url: p.output_url,
  error: p.error,
  expires_at: p.expires_at,
  created_at: p.created_at,
});

const mockupOut = (m: Mockup) => ({
  id: m.id,
  design_id: m.design_id,
  output_url: m.output_url,
  created_at: m.created_at,
});

const exportOut = (e: Export) => ({
  id: e.id,
  hires_url: e.hires_url,
  mockup_url: e.mockup_url,
  stencil_url: e.stencil_url,
  watermarked: e.watermarked,
  created_at: e.created_at,
});

/** Read one uploaded file from a multipart form (FastAPI ``File(...)``). */
async function uploadedForm(c: C): Promise<{ file: Uint8Array; form: FormData }> {
  // Refuse oversized bodies before buffering them (the isolate has 128 MB).
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > (settingsOf(c).maxUploadMb + 1) * 1024 * 1024) throw new HttpError(413, "Photo too large");
  let form: FormData;
  try {
    form = await c.req.raw.formData();
  } catch {
    throw new HttpError(422, [{ loc: ["body", "file"], msg: "Field required", type: "missing" }]);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    throw new HttpError(422, [{ loc: ["body", "file"], msg: "Field required", type: "missing" }]);
  }
  return { file: new Uint8Array(await (file as File).arrayBuffer()), form };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate + orient + strip + store a body photo (ephemeral). Returns the stored
 * key and hash; the DB row is written by the caller.
 */
async function storeBodyPhotoBytes(c: C, data: Uint8Array): Promise<{ id: string; key: string; hash: string }> {
  const s = settingsOf(c);
  if (data.length > s.maxUploadMb * 1024 * 1024) throw new HttpError(413, "Photo too large");
  let clean: Uint8Array;
  try {
    clean = await cleanBodyPhoto(data);
  } catch (err) {
    if (err instanceof InvalidImage && err.message === "Photo resolution too high") throw new HttpError(413, "Photo too large");
    throw new HttpError(400, "Not a valid image");
  }
  const id = uid();
  const key = `ephemeral/body/${id}.jpg`;
  await putMedia(c.env, key, clean, "image/jpeg");
  return { id, key, hash: await sha256Hex(clean) };
}

// ───────────────────────── health + geo ─────────────────────────

api.get("/health", (c) => c.json({ status: "ok", version: VERSION }));

api.get("/ready", async (c) => {
  const s = settingsOf(c);
  const checks: Record<string, string> = {};
  try {
    checks.db = (await db(c).ping()) === "ok" ? "ok" : "error";
  } catch {
    checks.db = "error";
  }
  try {
    await c.env.MEDIA.head("__ready_probe__");
    checks.storage = "ok";
  } catch {
    checks.storage = "error";
  }
  if (s.imageEngine === "openai") checks.openai = s.openaiApiKey ? "ok" : "error";
  const ok = Object.values(checks).every((v) => v === "ok");
  return c.json({ status: ok ? "ready" : "degraded", version: VERSION, checks }, ok ? 200 : 503);
});

// Locale hint for the frontend's first-visit language auto-detect.
const DE_COUNTRIES = new Set(["DE", "AT", "CH", "LI"]);
api.get("/geo", (c) => {
  const cf = (c.req.raw as Request & { cf?: { country?: string } }).cf;
  const country = String(cf?.country ?? c.req.header("CF-IPCountry") ?? "").trim().toUpperCase();
  let lang = "en";
  if (DE_COUNTRIES.has(country)) lang = "de";
  else if (!country && (c.req.header("Accept-Language") ?? "").trim().toLowerCase().startsWith("de")) lang = "de";
  return c.json({ country: country || null, lang });
});

// ───────────────────────── session + usage ─────────────────────────

/** Idempotent: a valid token returns the same session; otherwise a new anon user. */
api.post("/session", async (c) => {
  const s = settingsOf(c);
  const token = extractToken(c);
  const existingId = token ? await readUserId(token, s.sessionSecret) : null;
  const user = await db(c).sessionUser(existingId);
  const reused = Boolean(token) && existingId === user.id;
  return c.json({
    ...userOut(user),
    brand_name: null,
    token: reused ? token : await issueToken(user.id, s.sessionSecret),
  });
});

api.get("/session/me", async (c) => c.json(userOut(await currentUser(c))));

api.get("/usage", async (c) => {
  const user = await currentUser(c);
  const status = await db(c).usageStatus(user.id);
  if (!status) throw new HttpError(401, "Unknown session");
  return c.json({ ...status, promo: settingsOf(c).promoUnlimited });
});

// ───────────────────────── styles + prompt ─────────────────────────

api.get("/styles", (c) =>
  c.json(
    allRecipes().map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
      tags: r.tags,
      default_modifiers: r.default_modifiers,
    })),
  ),
);

api.post("/prompt/enhance", async (c) => {
  await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const prompt = r.str("prompt", { min: 1, max: 1000 });
  const styles = r.strList("styles");
  r.done();
  const enhanced = await getEngine(settingsOf(c)).enhancePrompt(prompt, styles);
  return c.json({ enhanced });
});

// ───────────────────────── designs ─────────────────────────

/** Public 'fresh ink' feed — newest finished designs across everyone. */
api.get("/feed", async (c) => {
  const limit = Math.max(1, Math.min(intQuery(new URL(c.req.url), "limit", 24), 60));
  const rows = await db(c).recentDone(limit);
  return c.json(rows.map((d) => ({ id: d.id, thumb_url: d.thumb_url, clean_png_url: d.clean_png_url })));
});

type DesignsResult = CreateDesignsResult;

function unwrapDesigns(res: DesignsResult): Design[] {
  if (res.ok) return res.designs;
  switch (res.error) {
    case "not_found":
      throw new HttpError(404, "Design not found");
    case "rate_limited":
      throw TOO_MANY();
    case "empty":
      throw new HttpError(422, "Empty adjustment");
    case "quota":
      throw quota402(res.status);
  }
  throw new HttpError(500, "Internal Server Error");
}

api.post("/designs", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const prompt = r.str("prompt", { min: 1, max: 1000 });
  const styles = r.strList("styles");
  const color = r.bool("color", true);
  const lineWeight = r.str("line_weight", { default: "medium" });
  const complexity = r.str("complexity", { default: "medium" });
  r.done();
  const [design] = unwrapDesigns(
    await db(c).createDesign(
      user.id,
      { prompt, styles, modifiers: { color, line_weight: lineWeight, complexity } },
      generationLimit(c, user),
    ),
  );
  await enqueue(c.env, { kind: "generate", id: design.id });
  return c.json(designOut((await db(c).getDesign(design.id)) ?? design), 202);
});

api.get("/designs", async (c) => {
  const user = await currentUser(c);
  return c.json((await db(c).listDesigns(user.id, 100)).map(designOut));
});

api.post("/designs/:id/variants", async (c) => {
  const user = await currentUser(c);
  const count = intQuery(new URL(c.req.url), "count", 2);
  const children = unwrapDesigns(await db(c).createVariants(user.id, c.req.param("id"), count, generationLimit(c, user)));
  for (const child of children) await enqueue(c.env, { kind: "generate", id: child.id });
  const fresh = await Promise.all(children.map(async (d) => (await db(c).getDesign(d.id)) ?? d));
  return c.json(fresh.map(designOut), 202);
});

/** A new design from a parent + a free-text adjustment (re-generation with the instruction appended). */
api.post("/designs/:id/refine", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const prompt = r.str("prompt", { min: 1, max: 600 });
  r.done();
  const [child] = unwrapDesigns(await db(c).refineDesign(user.id, c.req.param("id"), prompt, generationLimit(c, user)));
  await enqueue(c.env, { kind: "generate", id: child.id });
  return c.json(designOut((await db(c).getDesign(child.id)) ?? child), 202);
});

api.get("/designs/:id", async (c) => {
  const user = await currentUser(c);
  const d = await db(c).getOwnedDesign(user.id, c.req.param("id"));
  if (!d) throw new HttpError(404, "Design not found");
  return c.json(designOut(d));
});

// ───────────────────────── body photos + previews ─────────────────────────

api.post("/body-photos", async (c) => {
  const user = await currentUser(c);
  const { file } = await uploadedForm(c);
  const stored = await storeBodyPhotoBytes(c, file);
  const bp = await db(c).createBodyPhoto({
    id: stored.id,
    user_id: user.id,
    storage_ref: stored.key,
    content_hash: stored.hash,
    ttlHours: settingsOf(c).bodyPhotoTtlHours,
  });
  return c.json({ id: bp.id, url: mediaUrl(bp.storage_ref), expires_at: bp.expires_at }, 201);
});

api.post("/previews", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const designId = r.str("design_id");
  const bodyPhotoId = r.str("body_photo_id");
  const x = r.num("x_pct", { ge: 0, le: 1 });
  const y = r.num("y_pct", { ge: 0, le: 1 });
  const scale = r.num("scale", { ge: 0.05, le: 1, default: 0.3 });
  const rotation = r.num("rotation", { ge: -180, le: 180, default: 0 });
  r.done();
  const res = await db(c).createPreview(
    user.id,
    { design_id: designId, body_photo_id: bodyPhotoId, x_pct: x, y_pct: y, scale, rotation },
    generationLimit(c, user),
    settingsOf(c).previewTtlHours,
  );
  if (!res.ok) {
    if (res.error === "design_not_found") throw new HttpError(404, "Design not found");
    if (res.error === "photo_not_found") throw new HttpError(404, "Photo not found");
    throw TOO_MANY();
  }
  await enqueue(c.env, { kind: "composite", id: res.preview.id });
  return c.json(previewOut((await db(c).getPreview(res.preview.id)) ?? res.preview), 202);
});

api.get("/previews/:id", async (c) => {
  const user = await currentUser(c);
  const { preview, owned } = await db(c).previewForUser(user.id, c.req.param("id"));
  if (!preview) throw new HttpError(404, "Preview not found");
  if (!owned) throw new HttpError(404, "Design not found");
  return c.json(previewOut(preview));
});

// ───────────────────────── saved mockups ─────────────────────────

api.post("/mockups", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const previewId = r.str("preview_id");
  r.done();
  if (user.is_anonymous) throw new HttpError(403, "Sign in to save mockups");
  const src = await db(c).mockupSource(user.id, previewId);
  if (!src.ok) {
    if (src.error === "not_found") throw new HttpError(404, "Preview not found");
    throw new HttpError(409, "Mockup not ready");
  }
  // COPY the composite to a persistent object — the source photo/preview still expire.
  const bytes = await getMedia(c.env, `ephemeral/preview/${src.preview.id}.png`);
  const id = uid();
  const url = await putMedia(c.env, `mockups/${id}.png`, bytes, "image/png");
  const mockup = await db(c).createMockup({ id, user_id: user.id, design_id: src.preview.design_id, output_url: url });
  return c.json(mockupOut(mockup), 201);
});

api.get("/mockups", async (c) => {
  const user = await currentUser(c);
  return c.json((await db(c).listMockups(user.id, 100)).map(mockupOut));
});

api.delete("/mockups/:id", async (c) => {
  const user = await currentUser(c);
  const id = c.req.param("id");
  if (!(await db(c).ownedMockup(user.id, id))) throw new HttpError(404, "Mockup not found");
  await deleteMedia(c.env, [`mockups/${id}.png`]);
  await db(c).deleteMockup(user.id, id);
  return c.body(null, 204);
});

// ───────────────────────── exports ─────────────────────────

api.post("/exports", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const designId = r.str("design_id");
  const previewId = r.optStr("preview_id");
  r.done();
  const s = settingsOf(c);
  const ctx = await db(c).exportContext(user.id, designId, previewId);
  if (!ctx.ok) {
    if (ctx.error === "not_found") throw new HttpError(404, "Design not found");
    throw new HttpError(400, "Design not ready yet");
  }

  // Payment gating: free tier is watermarked + downscaled; paid (pro/studio/credits)
  // gets the ARTIST FILE — upscaled to print size, un-watermarked. Studio exports
  // carry the studio's brand.
  const paid = user.plan !== "free" || user.credits > 0;
  const opts = {
    watermark: !paid,
    maxPx: paid ? null : s.freeExportMaxPx,
    upscaleTo: paid ? ARTIST_PX : null,
    brand: user.plan === "studio" ? user.brand_name : null,
  };
  const eid = uid();

  // The artist file is ALWAYS the canonical clean design — never the body composite.
  const design = await decodeImage(await getMedia(c.env, `designs/${ctx.design.id}.png`));
  const hiresUrl = await putMedia(c.env, `exports/${eid}_design.png`, await encodePrintPng(watermarkRaster(design, opts)), "image/png");
  // Stencil-ready linework — what the studio feeds a thermal stencil printer.
  const stencilUrl = await putMedia(
    c.env,
    `exports/${eid}_stencil.png`,
    await encodePrintPng(watermarkRaster(stencilRaster(design), opts)),
    "image/png",
  );
  let mockupUrl: string | null = null;
  if (ctx.preview) {
    const mock = await decodeImage(await getMedia(c.env, `ephemeral/preview/${ctx.preview.id}.png`));
    mockupUrl = await putMedia(
      c.env,
      `exports/${eid}_mockup.png`,
      await encodePrintPng(watermarkRaster(mock, { ...opts, upscaleTo: null })),
      "image/png",
    );
  }
  const exp = await db(c).createExport({
    id: eid,
    design_id: ctx.design.id,
    preview_id: ctx.preview?.id ?? null,
    hires_url: hiresUrl,
    mockup_url: mockupUrl,
    stencil_url: stencilUrl,
    watermarked: !paid,
  });
  return c.json(exportOut(exp), 201);
});

api.get("/exports/:id", async (c) => {
  const user = await currentUser(c);
  const exp = await db(c).exportForUser(user.id, c.req.param("id"));
  if (!exp) throw new HttpError(404, "Export not found");
  return c.json(exportOut(exp));
});

// ───────────────────────── desktop → phone capture ─────────────────────────

const CAPTURE_TTL_MIN = 20;

api.post("/captures", async (c) => {
  const user = await currentUser(c);
  const body = await jsonBody(c.req.raw, true);
  let designId: string | null = null;
  if (body) {
    const r = new Reader(body);
    designId = r.optStr("design_id");
    r.done();
  }
  const token = await db(c).createCapture(user.id, designId, CAPTURE_TTL_MIN);
  return c.json({ token }, 201);
});

// NO auth — the unguessable, short-lived token authorizes the phone.
api.get("/captures/:token/info", async (c) => {
  const info = await db(c).captureInfo(c.req.param("token"));
  if (!info) throw new HttpError(404, "Capture link is invalid or expired");
  return c.json(info);
});

api.get("/captures/:token", async (c) => {
  const user = await currentUser(c);
  const res = await db(c).captureForUser(user.id, c.req.param("token"));
  if (!res) throw new HttpError(404, "Capture not found");
  const cap = res.capture;
  return c.json({
    status: cap.status,
    body_photo_id: cap.body_photo_id,
    url: res.body ? mediaUrl(res.body.storage_ref) : null,
    x_pct: cap.x_pct,
    y_pct: cap.y_pct,
    scale: cap.scale,
    rotation: cap.rotation,
  });
});

// NO auth — the token is the authorization.
api.post("/captures/:token/photo", async (c) => {
  const token = c.req.param("token");
  const check = await db(c).captureUploadable(token);
  if (!check.ok) {
    if (check.error === "not_found") throw new HttpError(404, "Capture link is invalid or expired");
    throw new HttpError(409, "This link was already used");
  }
  const { file, form } = await uploadedForm(c);
  // Placement from the phone's live-camera flow (optional). Clamped to the same
  // ranges as /previews so a tampered phone client can't poison it.
  const raw = ["x_pct", "y_pct", "scale", "rotation"].map((k) => form.get(k));
  const nums = raw.map((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : null));
  raw.forEach((v, i) => {
    if (v !== null && (typeof v !== "string" || !Number.isFinite(nums[i]))) {
      throw new HttpError(422, [{ loc: ["body", ["x_pct", "y_pct", "scale", "rotation"][i]], msg: "Input should be a valid number", type: "float_parsing" }]);
    }
  });
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const placement: Placement4 | null = nums.every((v) => v !== null)
    ? {
        x_pct: clamp(nums[0]!, 0, 1),
        y_pct: clamp(nums[1]!, 0, 1),
        scale: clamp(nums[2]!, 0.05, 1),
        rotation: clamp(nums[3]!, -180, 180),
      }
    : null;

  const stored = await storeBodyPhotoBytes(c, file);
  const res = await db(c).completeCaptureUpload(
    token,
    { id: stored.id, storage_ref: stored.key, content_hash: stored.hash, ttlHours: settingsOf(c).bodyPhotoTtlHours },
    placement,
  );
  if (res !== "ok") {
    await deleteMedia(c.env, [stored.key]);
    if (res === "not_found") throw new HttpError(404, "Capture link is invalid or expired");
    throw new HttpError(409, "This link was already used");
  }
  return c.json({ ok: true }, 201);
});

// ───────────────────────── Google OAuth ─────────────────────────

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const STATE_SALT = "inkpreview-oauth-state";
const STATE_MAX_AGE_S = 600;

function frontendRedirect(c: C, lang: string, fragment: string): Response {
  const base = settingsOf(c).frontendBaseUrl;
  return c.redirect(`${base}${lang === "de" ? "/de" : "/"}#${fragment}`, 302);
}

api.get("/auth/google/login", async (c) => {
  const s = settingsOf(c);
  if (!(s.googleClientId && s.googleClientSecret)) throw new HttpError(503, "Google login not configured");
  const q = new URL(c.req.url).searchParams;
  const token = q.get("token");
  const anonUid = (token ? await readUserId(token, s.sessionSecret) : null) ?? "";
  const state = await timedDumps(
    { uid: anonUid, lang: q.get("lang") === "de" ? "de" : "en", ref: q.get("ref") ?? "" },
    s.sessionSecret,
    STATE_SALT,
  );
  const params = new URLSearchParams({
    client_id: s.googleClientId,
    redirect_uri: s.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`${GOOGLE_AUTH}?${params}`, 302);
});

api.get("/auth/google/callback", async (c) => {
  const s = settingsOf(c);
  const q = new URL(c.req.url).searchParams;
  let lang = "en";
  let anonUid = "";
  let ref = "";
  const state = q.get("state");
  if (state) {
    const data = (await timedLoads(state, s.sessionSecret, STATE_SALT, STATE_MAX_AGE_S)) as
      | { uid?: string; lang?: string; ref?: string }
      | null;
    if (!data || typeof data !== "object") return frontendRedirect(c, "en", "auth_error=state");
    lang = data.lang ?? "en";
    anonUid = data.uid ?? "";
    ref = data.ref ?? "";
  }
  const code = q.get("code");
  if (q.get("error") || !code) return frontendRedirect(c, lang, "auth_error=denied");
  if (!(s.googleClientId && s.googleClientSecret)) throw new HttpError(503, "Google login not configured");

  let info: { sub?: string; email?: string; name?: string; picture?: string };
  try {
    const tok = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: s.googleClientId,
        client_secret: s.googleClientSecret,
        redirect_uri: s.googleRedirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tok.ok) throw new Error(`token exchange ${tok.status}`);
    const accessToken = ((await tok.json()) as { access_token?: string }).access_token;
    if (!accessToken) throw new Error("no access_token");
    const ui = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!ui.ok) throw new Error(`userinfo ${ui.status}`);
    info = (await ui.json()) as typeof info;
  } catch (err) {
    console.error("google oauth exchange failed", err);
    return frontendRedirect(c, lang, "auth_error=exchange");
  }
  if (!info.sub) return frontendRedirect(c, lang, "auth_error=profile");

  const user = await db(c).resolveGoogleUser(
    anonUid,
    { sub: info.sub, email: info.email ?? null, name: info.name ?? null, picture: info.picture ?? null },
    ref,
  );
  return frontendRedirect(c, lang, `auth_token=${await issueToken(user.id, s.sessionSecret)}`);
});

// ───────────────────────── Stripe billing ─────────────────────────

api.get("/billing/config", (c) => {
  const s = settingsOf(c);
  return c.json({ enabled: billingEnabled(s), publishable_key: s.stripePublishableKey });
});

api.post("/billing/checkout", async (c) => {
  const user = await currentUser(c);
  const body = await jsonBody(c.req.raw, true);
  let waive = false;
  if (body) {
    const r = new Reader(body);
    waive = r.bool("waive_withdrawal", false);
    r.done();
  }
  const s = settingsOf(c);
  if (!billingEnabled(s)) throw new HttpError(503, "Billing not configured");
  if (user.is_anonymous || !user.email) throw new HttpError(403, "Sign in to upgrade");
  if (user.plan === "pro") throw new HttpError(409, "Already on Pro");
  // Explicit consent to immediate performance + waiver of the 14-day withdrawal
  // right for digital services (§ 356 Abs. 4/5 BGB) — required to start checkout.
  if (!waive) throw new HttpError(400, "Withdrawal-right waiver consent required");
  await db(c).recordEvent(user.id, "pro_withdrawal_waiver", {});
  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      customerId = await createCustomer(s, user);
      await db(c).setStripeCustomer(user.id, customerId);
    }
    return c.json({ url: await createCheckoutSession(s, user, customerId) });
  } catch (err) {
    console.error("stripe checkout failed", err);
    throw new HttpError(502, "Payment provider error");
  }
});

api.post("/billing/portal", async (c) => {
  const user = await currentUser(c);
  const s = settingsOf(c);
  if (!billingEnabled(s)) throw new HttpError(503, "Billing not configured");
  if (!user.stripe_customer_id) throw new HttpError(409, "No subscription to manage");
  try {
    return c.json({ url: await createPortalSession(s, user.stripe_customer_id) });
  } catch (err) {
    console.error("stripe portal failed", err);
    throw new HttpError(502, "Payment provider error");
  }
});

/** Stripe → us. Signature-verified; flips the user's plan on subscription events. */
api.post("/billing/webhook", async (c) => {
  const s = settingsOf(c);
  if (!(s.stripeSecretKey && s.stripeWebhookSecret)) throw new HttpError(503, "Billing not configured");
  const payload = await c.req.text();
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = await parseWebhookEvent(payload, c.req.header("stripe-signature") ?? "", s.stripeWebhookSecret);
  } catch {
    throw new HttpError(400, "Invalid signature");
  }
  if (event.type && event.data?.object) await db(c).applyStripeEvent(event.type, event.data.object);
  return c.json({ received: true });
});

// ───────────────────────── account (GDPR) ─────────────────────────

/** Set the studio brand stamped on exports (Studio plan only). */
api.post("/account/brand", async (c) => {
  const user = await currentUser(c);
  const r = new Reader((await jsonBody(c.req.raw))!);
  const brand = r.str("brand_name", { max: 60, default: "" });
  r.done();
  if (user.plan !== "studio") throw new HttpError(403, "Studio plan required");
  const updated = await db(c).setBrand(user.id, brand.trim() || null);
  return c.json(userOut(updated ?? user));
});

/** Download a machine-readable copy of all data we hold (Art. 20). */
api.get("/account/export", async (c) => {
  const user = await currentUser(c);
  const data = await db(c).exportAccount(user.id);
  return c.json(data, 200, { "Content-Disposition": 'attachment; filename="inkpreview-data.json"' });
});

/** Permanently erase the account and ALL associated data + files (Art. 17). */
api.post("/account/delete", async (c) => {
  const user = await currentUser(c);
  const s = settingsOf(c);
  // Stop billing first so a deleted user is never charged again (best-effort).
  try {
    await cancelSubscription(s, user);
  } catch (err) {
    console.error("cancel subscription failed", err);
  }
  await deleteMedia(c.env, await db(c).accountStorageKeys(user.id));
  await db(c).deleteAccountRows(user.id);
  return c.body(null, 204);
});

// ───────────────────────── errors ─────────────────────────

api.notFound((c) => c.json({ detail: "Not Found" }, 404));

api.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ detail: err.detail }, err.status as 400, err.headers);
  }
  console.error("unhandled API error", c.req.method, c.req.path, err);
  return c.json({ detail: "Internal Server Error" }, 500);
});
