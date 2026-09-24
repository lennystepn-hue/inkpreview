/**
 * Signed tokens, wire-compatible with Python's itsdangerous 2.x
 * (``URLSafeSerializer`` / ``URLSafeTimedSerializer``, HMAC-SHA1, django-concat
 * key derivation) — the formats the former backend issued. With the same
 * SESSION_SECRET, session tokens stored in users' browsers stay valid.
 */

import { inflate } from "../imaging/png";

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string, salt: string): Promise<CryptoKey> {
  const id = `${salt}\u0000${secret}`;
  let key = keyCache.get(id);
  if (!key) {
    key = (async () => {
      // django-concat: sha1(salt + "signer" + secret)
      const derived = await crypto.subtle.digest("SHA-1", enc.encode(`${salt}signer${secret}`));
      return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-1" }, false, ["sign", "verify"]);
    })();
    keyCache.set(id, key);
  }
  return key;
}

async function signature(value: string, secret: string, salt: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, salt), enc.encode(value));
  return b64url(new Uint8Array(sig));
}

async function verified(value: string, sig: string, secret: string, salt: string): Promise<boolean> {
  let raw: Uint8Array;
  try {
    raw = b64urlDecode(sig);
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", await hmacKey(secret, salt), raw, enc.encode(value));
}

async function loadPayload(payload: string): Promise<unknown> {
  const compressed = payload.startsWith(".");
  let bytes = b64urlDecode(compressed ? payload.slice(1) : payload);
  if (compressed) bytes = await inflate(bytes);
  return JSON.parse(dec.decode(bytes));
}

const dumpPayload = (obj: unknown) => b64url(enc.encode(JSON.stringify(obj)));

/** ``URLSafeSerializer(secret, salt).dumps(obj)`` */
export async function dumps(obj: unknown, secret: string, salt: string): Promise<string> {
  const payload = dumpPayload(obj);
  return `${payload}.${await signature(payload, secret, salt)}`;
}

/** ``URLSafeSerializer(secret, salt).loads(token)`` — null on a bad signature. */
export async function loads(token: string, secret: string, salt: string): Promise<unknown> {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  if (!(await verified(payload, token.slice(i + 1), secret, salt))) return null;
  try {
    return await loadPayload(payload);
  } catch {
    return null;
  }
}

function intToB64(n: number): string {
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return b64url(new Uint8Array(bytes));
}

/** ``URLSafeTimedSerializer(secret, salt).dumps(obj)`` */
export async function timedDumps(obj: unknown, secret: string, salt: string, nowS = Math.floor(Date.now() / 1000)): Promise<string> {
  const value = `${dumpPayload(obj)}.${intToB64(nowS)}`;
  return `${value}.${await signature(value, secret, salt)}`;
}

/** ``URLSafeTimedSerializer(secret, salt).loads(token, max_age)`` — null if forged or expired. */
export async function timedLoads(token: string, secret: string, salt: string, maxAgeS: number): Promise<unknown> {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const value = token.slice(0, i);
  if (!(await verified(value, token.slice(i + 1), secret, salt))) return null;
  const j = value.lastIndexOf(".");
  if (j <= 0) return null;
  let ts = 0;
  for (const b of b64urlDecode(value.slice(j + 1))) ts = ts * 256 + b;
  if (Math.floor(Date.now() / 1000) - ts > maxAgeS) return null;
  try {
    return await loadPayload(value.slice(0, j));
  } catch {
    return null;
  }
}

const SESSION_SALT = "inkpreview-session";

export const issueToken = (userId: string, secret: string) => dumps(userId, secret, SESSION_SALT);

export async function readUserId(token: string, secret: string): Promise<string | null> {
  const v = await loads(token, secret, SESSION_SALT);
  return typeof v === "string" ? v : null;
}
