import { SELF, env, runInDurableObject } from "cloudflare:test";

import { dbStub } from "../src/context";
import type { Database } from "../src/db/database";
import { encodePng } from "../src/imaging/png";
import { type Rgba, createRaster } from "../src/imaging/raster";
import { issueToken } from "../src/lib/tokens";

export const BASE = "https://example.com";
export const SECRET = "test-secret-not-for-prod";

export type Headers = Record<string, string>;

export function call(path: string, init: RequestInit = {}): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`, init);
}

export async function postJson(path: string, body: unknown, headers: Headers = {}): Promise<Response> {
  return call(path, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A fresh anonymous session. */
export async function auth(): Promise<Headers> {
  const s = await (await call("/api/session", { method: "POST" })).json<{ token: string }>();
  return { Authorization: `Bearer ${s.token}` };
}

export const db = () => dbStub(env);

/** Insert a user row directly (like the Python tests' ``User(...)``) and return auth headers. */
export async function createUser(fields: {
  email?: string;
  name?: string;
  plan?: string;
  is_anonymous?: boolean;
  credits?: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
} = {}): Promise<{ id: string; headers: Headers }> {
  const id = crypto.randomUUID().replaceAll("-", "");
  const stub = (env.DB as unknown as DurableObjectNamespace<Database>).getByName("primary");
  await runInDurableObject(stub, (_instance: unknown, state: DurableObjectState) => {
    state.storage.sql.exec(
      `INSERT INTO users (id, email, name, is_anonymous, credits, plan, locale, stripe_customer_id, stripe_subscription_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'de', ?, ?, ?)`,
      id,
      fields.email ?? null,
      fields.name ?? null,
      fields.is_anonymous === false ? 0 : 1,
      fields.credits ?? 0,
      fields.plan ?? "free",
      fields.stripe_customer_id ?? null,
      fields.stripe_subscription_id ?? null,
      new Date().toISOString(),
    );
  });
  return { id, headers: { Authorization: `Bearer ${await issueToken(id, SECRET)}` } };
}

/** Run raw SQL inside the Database object (test-only inspection/manipulation). */
export async function sql<T = Record<string, SqlStorageValue>>(query: string, ...bindings: SqlStorageValue[]): Promise<T[]> {
  const stub = (env.DB as unknown as DurableObjectNamespace<Database>).getByName("primary");
  return runInDurableObject(stub, (_i: unknown, state: DurableObjectState) =>
    state.storage.sql.exec(query, ...bindings).toArray() as T[],
  );
}

export async function png(w = 300, h = 400, fill: Rgba = [190, 160, 150, 255]): Promise<Uint8Array> {
  return encodePng(createRaster(w, h, fill));
}

export async function uploadPhoto(path: string, headers: Headers, bytes?: Uint8Array, extra: Record<string, string> = {}): Promise<Response> {
  const fd = new FormData();
  fd.append("file", new File([bytes ?? (await png())], "arm.png", { type: "image/png" }));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return call(path, { method: "POST", headers, body: fd });
}

export async function createDesign(headers: Headers, prompt = "a rose", styles: string[] = []): Promise<any> {
  return (await postJson("/api/designs", { prompt, styles }, headers)).json();
}

export async function createPreview(headers: Headers): Promise<{ designId: string; previewId: string; bodyId: string }> {
  const designId = (await createDesign(headers)).id;
  const bodyId = (await (await uploadPhoto("/api/body-photos", headers)).json<any>()).id;
  const previewId = (
    await (await postJson("/api/previews", { design_id: designId, body_photo_id: bodyId, x_pct: 0.5, y_pct: 0.5 }, headers)).json<any>()
  ).id;
  return { designId, previewId, bodyId };
}

export async function mediaExists(url: string): Promise<boolean> {
  return (await env.MEDIA.head(url.replace(/^\/media\//, ""))) !== null;
}

export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
