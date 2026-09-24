/**
 * The Database Durable Object — one SQLite-backed instance (EU jurisdiction)
 * holding all InkPreview data. It replaces Postgres + the SQLAlchemy services of
 * the Python backend.
 *
 * Every public method is one use case and runs synchronously inside the object,
 * so each call is atomic (no other request interleaves) — e.g. the quota
 * check-and-reserve that needed ``SELECT … FOR UPDATE`` on Postgres. The Worker
 * calls these methods over RPC, usually once per API request.
 */

import { DurableObject } from "cloudflare:workers";

import { type Settings, getSettings } from "../config";
import { MIGRATIONS } from "./schema";
import {
  type BodyPhoto,
  type CaptureSession,
  type Design,
  type Export,
  type GoogleProfile,
  type JobStatus,
  type Mockup,
  type NewDesign,
  type Placement4,
  type Preview,
  type QuotaStatus,
  type RateLimit,
  type User,
} from "./types";

export const uid = (): string => crypto.randomUUID().replaceAll("-", "");
const nowIso = (): string => new Date().toISOString();
const hoursFromNow = (h: number): string => new Date(Date.now() + h * 3600_000).toISOString();

type Row = Record<string, SqlStorageValue>;

const s = (v: SqlStorageValue): string => v as string;
const sn = (v: SqlStorageValue): string | null => (v === null || v === undefined ? null : String(v));
const n = (v: SqlStorageValue): number => Number(v);
const nn = (v: SqlStorageValue): number | null => (v === null || v === undefined ? null : Number(v));

function json<T>(v: SqlStorageValue, fallback: T): T {
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function toUser(r: Row): User {
  return {
    id: s(r.id),
    email: sn(r.email),
    google_sub: sn(r.google_sub),
    name: sn(r.name),
    avatar_url: sn(r.avatar_url),
    is_anonymous: n(r.is_anonymous) === 1,
    credits: n(r.credits),
    plan: s(r.plan),
    locale: s(r.locale),
    stripe_customer_id: sn(r.stripe_customer_id),
    stripe_subscription_id: sn(r.stripe_subscription_id),
    pro_period_end: sn(r.pro_period_end),
    referred_by: sn(r.referred_by),
    brand_name: sn(r.brand_name),
    created_at: s(r.created_at),
  };
}

function toDesign(r: Row): Design {
  return {
    id: s(r.id),
    user_id: s(r.user_id),
    prompt: s(r.prompt),
    enhanced_prompt: sn(r.enhanced_prompt),
    styles: json<string[]>(r.styles, []),
    modifiers: json<Record<string, unknown>>(r.modifiers, {}),
    status: s(r.status) as JobStatus,
    error: sn(r.error),
    clean_png_url: sn(r.clean_png_url),
    thumb_url: sn(r.thumb_url),
    width: nn(r.width),
    height: nn(r.height),
    parent_design_id: sn(r.parent_design_id),
    created_at: s(r.created_at),
  };
}

function toBodyPhoto(r: Row): BodyPhoto {
  return {
    id: s(r.id),
    user_id: s(r.user_id),
    storage_ref: s(r.storage_ref),
    content_hash: sn(r.content_hash),
    expires_at: s(r.expires_at),
    created_at: s(r.created_at),
  };
}

function toPreview(r: Row): Preview {
  return {
    id: s(r.id),
    design_id: s(r.design_id),
    body_photo_id: s(r.body_photo_id),
    x_pct: n(r.x_pct),
    y_pct: n(r.y_pct),
    scale: n(r.scale),
    rotation: n(r.rotation),
    status: s(r.status) as JobStatus,
    error: sn(r.error),
    output_url: sn(r.output_url),
    expires_at: s(r.expires_at),
    created_at: s(r.created_at),
  };
}

function toMockup(r: Row): Mockup {
  return {
    id: s(r.id),
    user_id: s(r.user_id),
    design_id: sn(r.design_id),
    output_url: s(r.output_url),
    created_at: s(r.created_at),
  };
}

function toExport(r: Row): Export {
  return {
    id: s(r.id),
    design_id: s(r.design_id),
    preview_id: sn(r.preview_id),
    hires_url: sn(r.hires_url),
    mockup_url: sn(r.mockup_url),
    stencil_url: sn(r.stencil_url),
    watermarked: n(r.watermarked) === 1,
    created_at: s(r.created_at),
  };
}

function toCapture(r: Row): CaptureSession {
  return {
    id: s(r.id),
    user_id: s(r.user_id),
    body_photo_id: sn(r.body_photo_id),
    design_id: sn(r.design_id),
    x_pct: nn(r.x_pct),
    y_pct: nn(r.y_pct),
    scale: nn(r.scale),
    rotation: nn(r.rotation),
    status: s(r.status),
    expires_at: s(r.expires_at),
    created_at: s(r.created_at),
  };
}

function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function nextMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

const isFinished = (status: string) => status === "done" || status === "failed";

export type CreateDesignsResult =
  | { ok: true; designs: Design[] }
  | { ok: false; error: "not_found" | "rate_limited" | "empty" }
  | { ok: false; error: "quota"; status: QuotaStatus };

export type CreatePreviewResult =
  | { ok: true; preview: Preview }
  | { ok: false; error: "design_not_found" | "photo_not_found" | "rate_limited" };

export class Database extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  private get settings(): Settings {
    return getSettings(this.env);
  }

  // ───────────────────────── plumbing ─────────────────────────

  private migrate(): void {
    this.sql.exec("CREATE TABLE IF NOT EXISTS _schema (version INTEGER NOT NULL)");
    const row = this.sql.exec("SELECT version FROM _schema").toArray()[0];
    if (!row) this.sql.exec("INSERT INTO _schema (version) VALUES (0)");
    for (let v = row ? n(row.version) : 0; v < MIGRATIONS.length; v++) {
      this.ctx.storage.transactionSync(() => {
        for (const stmt of MIGRATIONS[v]) this.sql.exec(stmt);
        this.sql.exec("UPDATE _schema SET version = ?", v + 1);
      });
    }
  }

  private all(q: string, ...b: SqlStorageValue[]): Row[] {
    return this.sql.exec(q, ...b).toArray() as Row[];
  }

  private first(q: string, ...b: SqlStorageValue[]): Row | null {
    return this.all(q, ...b)[0] ?? null;
  }

  private tx<T>(fn: () => T): T {
    return this.ctx.storage.transactionSync(fn);
  }

  ping(): string {
    this.sql.exec("SELECT 1");
    return "ok";
  }

  // ───────────────────────── users / sessions ─────────────────────────

  getUser(id: string): User | null {
    const r = this.first("SELECT * FROM users WHERE id = ?", id);
    return r ? toUser(r) : null;
  }

  private userBy(column: "email" | "google_sub" | "stripe_customer_id", value: string): User | null {
    const r = this.first(`SELECT * FROM users WHERE ${column} = ?`, value);
    return r ? toUser(r) : null;
  }

  private insertUser(fields: Partial<User> = {}): User {
    const id = fields.id ?? uid();
    this.sql.exec(
      `INSERT INTO users (id, email, google_sub, name, avatar_url, is_anonymous, credits, plan, locale, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'free', 'de', ?)`,
      id,
      fields.email ?? null,
      fields.google_sub ?? null,
      fields.name ?? null,
      fields.avatar_url ?? null,
      fields.is_anonymous === false ? 0 : 1,
      nowIso(),
    );
    return this.getUser(id)!;
  }

  /** POST /api/session: the existing user for a valid token, else a new anonymous one. */
  sessionUser(existingId: string | null): User {
    if (existingId) {
      const u = this.getUser(existingId);
      if (u) return u;
    }
    return this.insertUser();
  }

  setBrand(userId: string, brand: string | null): User | null {
    this.sql.exec("UPDATE users SET brand_name = ? WHERE id = ?", brand, userId);
    return this.getUser(userId);
  }

  /**
   * Google sign-in: find/create the user for a profile, preferring to upgrade the
   * anonymous row in place so their designs carry over; then credit a referrer
   * (once, on first sign-in).
   */
  resolveGoogleUser(anonUid: string, info: GoogleProfile, ref: string): User {
    return this.tx(() => {
      const email = info.email || null;
      const name = info.name || null;
      const pic = info.picture || null;
      let user: User;

      const existing = this.userBy("google_sub", info.sub);
      if (existing) {
        // Keep the stored email if the new one already belongs to another account.
        const clash = email ? this.userBy("email", email) : null;
        const newEmail = email && (!clash || clash.id === existing.id) ? email : existing.email;
        this.sql.exec(
          "UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?",
          newEmail,
          name ?? existing.name,
          pic ?? existing.avatar_url,
          existing.id,
        );
        user = this.getUser(existing.id)!;
      } else {
        const anon = anonUid ? this.getUser(anonUid) : null;
        const owner = email ? this.userBy("email", email) : null;
        if (owner) {
          this.sql.exec(
            "UPDATE users SET google_sub = ?, name = ?, avatar_url = ?, is_anonymous = 0 WHERE id = ?",
            info.sub,
            name ?? owner.name,
            pic ?? owner.avatar_url,
            owner.id,
          );
          user = this.getUser(owner.id)!;
        } else if (anon && anon.is_anonymous && anon.google_sub === null) {
          this.sql.exec(
            "UPDATE users SET google_sub = ?, email = ?, name = ?, avatar_url = ?, is_anonymous = 0 WHERE id = ?",
            info.sub,
            email,
            name,
            pic,
            anon.id,
          );
          user = this.getUser(anon.id)!;
        } else {
          user = this.insertUser({ google_sub: info.sub, email, name, avatar_url: pic, is_anonymous: false });
        }
      }

      if (ref && ref !== user.id && user.referred_by === null) {
        const referrer = this.getUser(ref);
        if (referrer) {
          this.sql.exec("UPDATE users SET referred_by = ? WHERE id = ?", ref, user.id);
          this.sql.exec("UPDATE users SET credits = credits + 1 WHERE id = ?", ref);
          user = this.getUser(user.id)!;
        }
      }
      return user;
    });
  }

  // ───────────────────────── quota (cost kill-switch) ─────────────────────────

  /** (effective limit, period) — limit null == unlimited; bonus credits add on top. */
  private planQuota(u: User): [number | null, "lifetime" | "month"] {
    const cfg = this.settings;
    if (cfg.promoUnlimited) return [null, "month"];
    if (u.plan === "pro" || u.plan === "studio") return [null, "month"];
    const bonus = Math.max(0, u.credits || 0);
    if (u.is_anonymous) return [cfg.guestGenerationLimit + bonus, "lifetime"];
    return [cfg.freeMonthlyGenerationLimit + bonus, "month"];
  }

  private used(userId: string, periodStart: string | null): number {
    const r =
      periodStart === null
        ? this.first("SELECT COALESCE(SUM(delta), 0) AS used FROM usage_ledger WHERE user_id = ?", userId)
        : this.first(
            "SELECT COALESCE(SUM(delta), 0) AS used FROM usage_ledger WHERE user_id = ? AND created_at >= ?",
            userId,
            periodStart,
          );
    return r ? n(r.used) : 0;
  }

  private statusFor(u: User): QuotaStatus {
    const now = new Date();
    const [limit, period] = this.planQuota(u);
    const used = this.used(u.id, period === "month" ? monthStart(now) : null);
    return {
      plan: u.plan,
      period,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      reset_at: period === "month" && limit !== null ? nextMonthStart(now) : null,
    };
  }

  usageStatus(userId: string): QuotaStatus | null {
    const u = this.getUser(userId);
    return u ? this.statusFor(u) : null;
  }

  /** Sliding-window limiter for image-job creation. Records the hit when allowed. */
  private rateAllow(rl: RateLimit): boolean {
    const now = Date.now();
    this.sql.exec("DELETE FROM rate_hits WHERE key = ? AND at <= ?", rl.key, now - rl.windowS * 1000);
    const r = this.first("SELECT COUNT(*) AS c FROM rate_hits WHERE key = ?", rl.key);
    if (r && n(r.c) >= rl.limit) return false;
    this.sql.exec("INSERT INTO rate_hits (key, at) VALUES (?, ?)", rl.key, now);
    return true;
  }

  // ───────────────────────── designs ─────────────────────────

  getDesign(id: string): Design | null {
    const r = this.first("SELECT * FROM designs WHERE id = ?", id);
    return r ? toDesign(r) : null;
  }

  getOwnedDesign(userId: string, id: string): Design | null {
    const d = this.getDesign(id);
    return d && d.user_id === userId ? d : null;
  }

  listDesigns(userId: string, limit = 100): Design[] {
    return this.all(
      "SELECT * FROM designs WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
      userId,
      limit,
    ).map(toDesign);
  }

  /** Newest finished designs across everyone (public feed / SEO pages). */
  recentDone(limit: number): Design[] {
    return this.all(
      "SELECT * FROM designs WHERE status = 'done' AND clean_png_url IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT ?",
      limit,
    ).map(toDesign);
  }

  /**
   * Reserve quota units and insert the designs atomically: either every design
   * gets a +1 ledger row, or nothing is written and the quota status comes back.
   */
  private insertDesigns(user: User, rows: (NewDesign & { parent_design_id: string | null })[], reason: string): CreateDesignsResult {
    return this.tx(() => {
      const [limit, period] = this.planQuota(user);
      if (limit !== null) {
        const used = this.used(user.id, period === "month" ? monthStart(new Date()) : null);
        if (used + rows.length > limit) return { ok: false, error: "quota", status: this.statusFor(user) } as const;
      }
      const ids: string[] = [];
      for (const row of rows) {
        const id = uid();
        const at = nowIso();
        this.sql.exec(
          `INSERT INTO designs (id, user_id, prompt, styles, modifiers, status, parent_design_id, created_at)
           VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
          id,
          user.id,
          row.prompt,
          JSON.stringify(row.styles),
          JSON.stringify(row.modifiers),
          row.parent_design_id,
          at,
        );
        this.sql.exec(
          "INSERT INTO usage_ledger (id, user_id, delta, reason, design_id, created_at) VALUES (?, ?, 1, ?, ?, ?)",
          uid(),
          user.id,
          reason,
          id,
          at,
        );
        ids.push(id);
      }
      return { ok: true, designs: ids.map((id) => this.getDesign(id)!) } as const;
    });
  }

  createDesign(userId: string, design: NewDesign, rl: RateLimit): CreateDesignsResult {
    const user = this.getUser(userId);
    if (!user) return { ok: false, error: "not_found" };
    if (!this.rateAllow(rl)) return { ok: false, error: "rate_limited" };
    return this.insertDesigns(user, [{ ...design, parent_design_id: null }], "generation");
  }

  createVariants(userId: string, parentId: string, count: number, rl: RateLimit): CreateDesignsResult {
    const user = this.getUser(userId);
    const parent = this.getOwnedDesign(userId, parentId);
    if (!user || !parent) return { ok: false, error: "not_found" };
    if (!this.rateAllow(rl)) return { ok: false, error: "rate_limited" };
    const k = Math.max(1, Math.min(Math.trunc(count), 4));
    const rows = Array.from({ length: k }, () => ({
      prompt: parent.prompt,
      styles: parent.styles,
      modifiers: parent.modifiers,
      parent_design_id: parent.id,
    }));
    return this.insertDesigns(user, rows, "variants");
  }

  refineDesign(userId: string, parentId: string, instruction: string, rl: RateLimit): CreateDesignsResult {
    const user = this.getUser(userId);
    const parent = this.getOwnedDesign(userId, parentId);
    if (!user || !parent) return { ok: false, error: "not_found" };
    if (!this.rateAllow(rl)) return { ok: false, error: "rate_limited" };
    const text = instruction.trim();
    if (!text) return { ok: false, error: "empty" };
    return this.insertDesigns(
      user,
      [
        {
          prompt: `${parent.prompt.trim()}, ${text}`,
          styles: parent.styles,
          modifiers: parent.modifiers,
          parent_design_id: parent.id,
        },
      ],
      "refine",
    );
  }

  // ───────────────────────── image jobs ─────────────────────────

  /** Claim a design for processing; null if it's gone or already finished (idempotent retries). */
  startDesignJob(id: string): Design | null {
    const d = this.getDesign(id);
    if (!d || isFinished(d.status)) return null;
    this.sql.exec("UPDATE designs SET status = 'processing' WHERE id = ?", id);
    return { ...d, status: "processing" };
  }

  completeDesign(id: string, out: { clean_png_url: string; thumb_url: string; width: number; height: number }): void {
    this.sql.exec(
      "UPDATE designs SET status = 'done', error = NULL, clean_png_url = ?, thumb_url = ?, width = ?, height = ? WHERE id = ?",
      out.clean_png_url,
      out.thumb_url,
      out.width,
      out.height,
      id,
    );
  }

  /** Mark a design FAILED and refund its quota unit (idempotent: only while net-consumed). */
  failDesign(id: string, error: string): void {
    this.tx(() => {
      const d = this.getDesign(id);
      if (!d) return;
      this.sql.exec("UPDATE designs SET status = 'failed', error = ? WHERE id = ?", error.slice(0, 500), id);
      const r = this.first("SELECT COALESCE(SUM(delta), 0) AS net FROM usage_ledger WHERE design_id = ?", id);
      if (r && n(r.net) > 0) {
        this.sql.exec(
          "INSERT INTO usage_ledger (id, user_id, delta, reason, design_id, created_at) VALUES (?, ?, -1, 'refund:failed', ?, ?)",
          uid(),
          d.user_id,
          id,
          nowIso(),
        );
      }
    });
  }

  startPreviewJob(id: string): { preview: Preview; design: Design | null; body: BodyPhoto | null } | null {
    const p = this.getPreview(id);
    if (!p || isFinished(p.status)) return null;
    this.sql.exec("UPDATE previews SET status = 'processing' WHERE id = ?", id);
    return {
      preview: { ...p, status: "processing" },
      design: this.getDesign(p.design_id),
      body: this.getBodyPhoto(p.body_photo_id),
    };
  }

  completePreview(id: string, outputUrl: string): void {
    this.sql.exec("UPDATE previews SET status = 'done', error = NULL, output_url = ? WHERE id = ?", outputUrl, id);
  }

  failPreview(id: string, error: string): void {
    this.sql.exec("UPDATE previews SET status = 'failed', error = ? WHERE id = ?", error.slice(0, 500), id);
  }

  /** Jobs that never finished (crashed consumer) → failed + refunded. */
  failStaleJobs(cutoffIso: string): { designs: number; previews: number } {
    const designs = this.all(
      "SELECT id FROM designs WHERE status IN ('queued', 'processing') AND created_at < ?",
      cutoffIso,
    );
    for (const r of designs) this.failDesign(s(r.id), "Generation timed out — please try again.");
    const previews = this.all(
      "SELECT id FROM previews WHERE status IN ('queued', 'processing') AND created_at < ?",
      cutoffIso,
    );
    for (const r of previews) this.failPreview(s(r.id), "Preview timed out — please try again.");
    return { designs: designs.length, previews: previews.length };
  }

  // ───────────────────────── body photos + previews ─────────────────────────

  getBodyPhoto(id: string): BodyPhoto | null {
    const r = this.first("SELECT * FROM body_photos WHERE id = ?", id);
    return r ? toBodyPhoto(r) : null;
  }

  createBodyPhoto(row: { id: string; user_id: string; storage_ref: string; content_hash: string; ttlHours: number }): BodyPhoto {
    this.sql.exec(
      "INSERT INTO body_photos (id, user_id, storage_ref, content_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      row.id,
      row.user_id,
      row.storage_ref,
      row.content_hash,
      hoursFromNow(row.ttlHours),
      nowIso(),
    );
    return this.getBodyPhoto(row.id)!;
  }

  getPreview(id: string): Preview | null {
    const r = this.first("SELECT * FROM previews WHERE id = ?", id);
    return r ? toPreview(r) : null;
  }

  createPreview(
    userId: string,
    p: { design_id: string; body_photo_id: string } & Placement4,
    rl: RateLimit,
    ttlHours: number,
  ): CreatePreviewResult {
    if (!this.getOwnedDesign(userId, p.design_id)) return { ok: false, error: "design_not_found" };
    const body = this.getBodyPhoto(p.body_photo_id);
    if (!body || body.user_id !== userId) return { ok: false, error: "photo_not_found" };
    if (!this.rateAllow(rl)) return { ok: false, error: "rate_limited" };
    const id = uid();
    this.sql.exec(
      `INSERT INTO previews (id, design_id, body_photo_id, x_pct, y_pct, scale, rotation, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      id,
      p.design_id,
      p.body_photo_id,
      p.x_pct,
      p.y_pct,
      p.scale,
      p.rotation,
      hoursFromNow(ttlHours),
      nowIso(),
    );
    return { ok: true, preview: this.getPreview(id)! };
  }

  /** A preview the user may read (ownership via its design). */
  previewForUser(userId: string, id: string): { preview: Preview | null; owned: boolean } {
    const p = this.getPreview(id);
    if (!p) return { preview: null, owned: false };
    return { preview: p, owned: this.getOwnedDesign(userId, p.design_id) !== null };
  }

  // ───────────────────────── desktop → phone capture ─────────────────────────

  createCapture(userId: string, designId: string | null, ttlMinutes: number): string {
    // Only bind the user's OWN design (never expose someone else's via /info).
    const design = designId ? this.getOwnedDesign(userId, designId) : null;
    const id = uid();
    this.sql.exec(
      "INSERT INTO capture_sessions (id, user_id, design_id, status, expires_at, created_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      id,
      userId,
      design ? design.id : null,
      new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
      nowIso(),
    );
    return id;
  }

  private liveCapture(token: string): CaptureSession | null {
    const r = this.first("SELECT * FROM capture_sessions WHERE id = ?", token);
    if (!r) return null;
    const cap = toCapture(r);
    return cap.expires_at < nowIso() ? null : cap;
  }

  /** Public (token-authorized) info for the phone; null when invalid/expired. */
  captureInfo(token: string): { status: string; design_thumb_url: string | null } | null {
    const cap = this.liveCapture(token);
    if (!cap) return null;
    let thumb: string | null = null;
    if (cap.design_id) {
      const d = this.getDesign(cap.design_id);
      if (d) thumb = d.thumb_url || d.clean_png_url;
    }
    return { status: cap.status, design_thumb_url: thumb };
  }

  captureForUser(userId: string, token: string): { capture: CaptureSession; body: BodyPhoto | null } | null {
    const r = this.first("SELECT * FROM capture_sessions WHERE id = ?", token);
    if (!r) return null;
    const cap = toCapture(r);
    if (cap.user_id !== userId) return null;
    return { capture: cap, body: cap.body_photo_id ? this.getBodyPhoto(cap.body_photo_id) : null };
  }

  /** Can the phone still upload with this token? */
  captureUploadable(token: string): { ok: true; userId: string } | { ok: false; error: "not_found" | "used" } {
    const cap = this.liveCapture(token);
    if (!cap) return { ok: false, error: "not_found" };
    if (cap.status !== "pending") return { ok: false, error: "used" };
    return { ok: true, userId: cap.user_id };
  }

  /** Attach the uploaded photo (+ optional live placement) to the capture, atomically. */
  completeCaptureUpload(
    token: string,
    photo: { id: string; storage_ref: string; content_hash: string; ttlHours: number },
    placement: Placement4 | null,
  ): "ok" | "not_found" | "used" {
    return this.tx(() => {
      const check = this.captureUploadable(token);
      if (!check.ok) return check.error;
      this.createBodyPhoto({ ...photo, user_id: check.userId });
      this.sql.exec(
        `UPDATE capture_sessions SET body_photo_id = ?, status = 'uploaded',
           x_pct = COALESCE(?, x_pct), y_pct = COALESCE(?, y_pct), scale = COALESCE(?, scale), rotation = COALESCE(?, rotation)
         WHERE id = ?`,
        photo.id,
        placement?.x_pct ?? null,
        placement?.y_pct ?? null,
        placement?.scale ?? null,
        placement?.rotation ?? null,
        token,
      );
      return "ok";
    });
  }

  // ───────────────────────── exports + mockups ─────────────────────────

  exportContext(
    userId: string,
    designId: string,
    previewId: string | null,
  ): { ok: true; design: Design; preview: Preview | null } | { ok: false; error: "not_found" | "not_ready" } {
    const design = this.getOwnedDesign(userId, designId);
    if (!design) return { ok: false, error: "not_found" };
    if (design.status !== "done" || !design.clean_png_url) return { ok: false, error: "not_ready" };
    let preview: Preview | null = null;
    if (previewId) {
      const p = this.getPreview(previewId);
      if (p && p.design_id === design.id && p.output_url) preview = p;
    }
    return { ok: true, design, preview };
  }

  createExport(row: Omit<Export, "created_at">): Export {
    this.sql.exec(
      `INSERT INTO exports (id, design_id, preview_id, hires_url, mockup_url, stencil_url, watermarked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.design_id,
      row.preview_id,
      row.hires_url,
      row.mockup_url,
      row.stencil_url,
      row.watermarked ? 1 : 0,
      nowIso(),
    );
    return toExport(this.first("SELECT * FROM exports WHERE id = ?", row.id)!);
  }

  exportForUser(userId: string, id: string): Export | null {
    const r = this.first("SELECT * FROM exports WHERE id = ?", id);
    if (!r) return null;
    const e = toExport(r);
    return this.getOwnedDesign(userId, e.design_id) ? e : null;
  }

  /** The finished preview a user wants to keep as a mockup. */
  mockupSource(userId: string, previewId: string): { ok: true; preview: Preview } | { ok: false; error: "not_found" | "not_ready" } {
    const p = this.getPreview(previewId);
    if (!p || !this.getOwnedDesign(userId, p.design_id)) return { ok: false, error: "not_found" };
    if (p.status !== "done" || !p.output_url) return { ok: false, error: "not_ready" };
    return { ok: true, preview: p };
  }

  createMockup(row: { id: string; user_id: string; design_id: string | null; output_url: string }): Mockup {
    this.sql.exec(
      "INSERT INTO mockups (id, user_id, design_id, output_url, created_at) VALUES (?, ?, ?, ?, ?)",
      row.id,
      row.user_id,
      row.design_id,
      row.output_url,
      nowIso(),
    );
    return toMockup(this.first("SELECT * FROM mockups WHERE id = ?", row.id)!);
  }

  listMockups(userId: string, limit = 100): Mockup[] {
    return this.all(
      "SELECT * FROM mockups WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
      userId,
      limit,
    ).map(toMockup);
  }

  ownedMockup(userId: string, id: string): Mockup | null {
    const r = this.first("SELECT * FROM mockups WHERE id = ? AND user_id = ?", id, userId);
    return r ? toMockup(r) : null;
  }

  deleteMockup(userId: string, id: string): boolean {
    return this.sql.exec("DELETE FROM mockups WHERE id = ? AND user_id = ?", id, userId).rowsWritten > 0;
  }

  // ───────────────────────── billing ─────────────────────────

  recordEvent(userId: string | null, action: string, payload: Record<string, unknown> = {}): void {
    this.sql.exec(
      "INSERT INTO events (id, user_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)",
      uid(),
      userId,
      action,
      JSON.stringify(payload),
      nowIso(),
    );
  }

  setStripeCustomer(userId: string, customerId: string): void {
    this.sql.exec("UPDATE users SET stripe_customer_id = ? WHERE id = ?", customerId, userId);
  }

  /**
   * Flip a user's plan on a Stripe subscription lifecycle event (the
   * signature-verified webhook payload). Ignores everything else.
   */
  applyStripeEvent(type: string, obj: Record<string, any>): void {
    const ACTIVE = new Set(["active", "trialing"]);
    const periodEnd = (o: Record<string, any>): string | null => {
      const ts = o.current_period_end ?? o.items?.data?.[0]?.current_period_end;
      return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
    };
    const byCustomer = (c: unknown) => (typeof c === "string" && c ? this.userBy("stripe_customer_id", c) : null);

    this.tx(() => {
      if (type === "checkout.session.completed") {
        const uidRef = obj.client_reference_id || obj.metadata?.user_id;
        const customer = typeof obj.customer === "string" ? obj.customer : null;
        const user = (uidRef ? this.getUser(String(uidRef)) : null) ?? byCustomer(customer);
        if (!user) return;
        this.sql.exec(
          "UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, plan = 'pro', is_anonymous = 0 WHERE id = ?",
          customer || user.stripe_customer_id,
          (typeof obj.subscription === "string" && obj.subscription) || user.stripe_subscription_id,
          user.id,
        );
      } else if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
        const user = byCustomer(obj.customer);
        if (!user) return;
        this.sql.exec(
          "UPDATE users SET plan = ?, stripe_subscription_id = ?, pro_period_end = ? WHERE id = ?",
          ACTIVE.has(obj.status) ? "pro" : "free",
          obj.id ?? null,
          periodEnd(obj),
          user.id,
        );
      } else if (type === "customer.subscription.deleted") {
        const user = byCustomer(obj.customer);
        if (!user) return;
        this.sql.exec(
          "UPDATE users SET plan = 'free', stripe_subscription_id = NULL, pro_period_end = NULL WHERE id = ?",
          user.id,
        );
      }
    });
  }

  // ───────────────────────── GDPR (Art. 17 / 20) ─────────────────────────

  exportAccount(userId: string): Record<string, unknown> | null {
    const u = this.getUser(userId);
    if (!u) return null;
    const designs = this.all("SELECT * FROM designs WHERE user_id = ? ORDER BY created_at", userId).map(toDesign);
    const mockups = this.all("SELECT * FROM mockups WHERE user_id = ? ORDER BY created_at", userId).map(toMockup);
    return {
      exported_at: nowIso(),
      account: {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        is_anonymous: u.is_anonymous,
        created_at: u.created_at,
      },
      designs: designs.map((d) => ({
        id: d.id,
        prompt: d.prompt,
        enhanced_prompt: d.enhanced_prompt,
        styles: d.styles,
        modifiers: d.modifiers,
        status: d.status,
        clean_png_url: d.clean_png_url,
        thumb_url: d.thumb_url,
        parent_design_id: d.parent_design_id,
        created_at: d.created_at,
      })),
      saved_mockups: mockups.map((m) => ({
        id: m.id,
        design_id: m.design_id,
        output_url: m.output_url,
        created_at: m.created_at,
      })),
    };
  }

  /** Every storage object owned by the user (collected before the rows go). */
  accountStorageKeys(userId: string): string[] {
    const keys: string[] = [];
    const designIds = this.all("SELECT id FROM designs WHERE user_id = ?", userId).map((r) => s(r.id));
    for (const did of designIds) keys.push(`designs/${did}.png`, `designs/${did}_thumb.png`);
    for (const r of this.all(
      "SELECT p.id FROM previews p JOIN designs d ON d.id = p.design_id WHERE d.user_id = ?",
      userId,
    )) {
      keys.push(`ephemeral/preview/${s(r.id)}.png`);
    }
    for (const r of this.all(
      "SELECT e.id FROM exports e JOIN designs d ON d.id = e.design_id WHERE d.user_id = ?",
      userId,
    )) {
      const eid = s(r.id);
      keys.push(`exports/${eid}_design.png`, `exports/${eid}_stencil.png`, `exports/${eid}_mockup.png`);
    }
    for (const r of this.all("SELECT storage_ref FROM body_photos WHERE user_id = ?", userId)) {
      if (r.storage_ref) keys.push(s(r.storage_ref));
    }
    for (const r of this.all("SELECT id FROM mockups WHERE user_id = ?", userId)) keys.push(`mockups/${s(r.id)}.png`);
    return keys;
  }

  /** Erase the user and ALL their rows, explicitly (no reliance on cascades). */
  deleteAccountRows(userId: string): void {
    this.tx(() => {
      const designSub = "SELECT id FROM designs WHERE user_id = ?";
      this.sql.exec(`DELETE FROM exports WHERE design_id IN (${designSub})`, userId);
      this.sql.exec(`DELETE FROM previews WHERE design_id IN (${designSub})`, userId);
      this.sql.exec("DELETE FROM mockups WHERE user_id = ?", userId);
      this.sql.exec("UPDATE capture_sessions SET body_photo_id = NULL WHERE user_id = ?", userId);
      this.sql.exec(
        "DELETE FROM previews WHERE body_photo_id IN (SELECT id FROM body_photos WHERE user_id = ?)",
        userId,
      );
      this.sql.exec("DELETE FROM body_photos WHERE user_id = ?", userId);
      this.sql.exec("DELETE FROM usage_ledger WHERE user_id = ?", userId);
      this.sql.exec("DELETE FROM capture_sessions WHERE user_id = ?", userId);
      this.sql.exec("DELETE FROM events WHERE user_id = ?", userId);
      this.sql.exec("DELETE FROM rate_hits WHERE key = ?", userId);
      this.sql.exec("UPDATE designs SET parent_design_id = NULL WHERE parent_design_id IN (" + designSub + ")", userId);
      this.sql.exec("DELETE FROM designs WHERE user_id = ?", userId);
      this.sql.exec("DELETE FROM users WHERE id = ?", userId);
    });
  }

  // ───────────────────────── ephemeral-data sweeper ─────────────────────────

  /** Expired previews + body photos (sensitive: intimate body parts) → storage keys to delete. */
  expiredEphemeral(nowIsoStr: string): { previewIds: string[]; bodyIds: string[]; keys: string[] } {
    const previews = this.all("SELECT id FROM previews WHERE expires_at < ?", nowIsoStr).map((r) => s(r.id));
    const bodies = this.all("SELECT id, storage_ref FROM body_photos WHERE expires_at < ?", nowIsoStr);
    const keys = previews.map((id) => `ephemeral/preview/${id}.png`);
    // Previews of an expiring photo go with it (FK cascade) — delete their files too.
    for (const b of bodies) {
      if (b.storage_ref) keys.push(s(b.storage_ref));
      for (const r of this.all("SELECT id FROM previews WHERE body_photo_id = ?", s(b.id))) {
        keys.push(`ephemeral/preview/${s(r.id)}.png`);
      }
    }
    return { previewIds: previews, bodyIds: bodies.map((b) => s(b.id)), keys: [...new Set(keys)] };
  }

  deleteEphemeral(previewIds: string[], bodyIds: string[]): number {
    return this.tx(() => {
      let deleted = 0;
      for (const id of previewIds) deleted += this.sql.exec("DELETE FROM previews WHERE id = ?", id).rowsWritten > 0 ? 1 : 0;
      for (const id of bodyIds) {
        this.sql.exec("UPDATE capture_sessions SET body_photo_id = NULL WHERE body_photo_id = ?", id);
        this.sql.exec("DELETE FROM previews WHERE body_photo_id = ?", id);
        deleted += this.sql.exec("DELETE FROM body_photos WHERE id = ?", id).rowsWritten > 0 ? 1 : 0;
      }
      return deleted;
    });
  }

  pruneRateHits(olderThanMs: number): void {
    this.sql.exec("DELETE FROM rate_hits WHERE at <= ?", olderThanMs);
  }
}
