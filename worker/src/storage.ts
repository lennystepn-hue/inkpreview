/**
 * Media storage on R2. Keys match the former filesystem layout
 * (designs/…, ephemeral/body/…, ephemeral/preview/…, exports/…, mockups/…) and
 * are served same-origin under /media/<key>, so stored URLs look exactly like
 * before and a restored media backup drops straight in.
 */

export const mediaUrl = (key: string): string => `/media/${key}`;

export async function putMedia(env: Env, key: string, bytes: Uint8Array, contentType: string): Promise<string> {
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
  return mediaUrl(key);
}

export async function getMedia(env: Env, key: string): Promise<Uint8Array> {
  const obj = await env.MEDIA.get(key);
  if (!obj) throw new Error(`stored object missing: ${key}`);
  return new Uint8Array(await obj.arrayBuffer());
}

/** Best-effort bulk delete (R2 takes up to 1000 keys per call). */
export async function deleteMedia(env: Env, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    try {
      await env.MEDIA.delete(keys.slice(i, i + 1000));
    } catch (err) {
      console.error("media delete failed", err);
    }
  }
}

/** GET/HEAD /media/<key> straight from R2 (conditional + range requests supported). */
export async function serveMedia(env: Env, request: Request, key: string): Promise<Response> {
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("Not Found", { status: 404 });
  const obj = await env.MEDIA.get(key, { onlyIf: request.headers, range: request.headers });
  if (!obj) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  // Designs/exports/mockups never change under a key; body photos + previews are
  // private and short-lived (never cached by shared caches).
  headers.set(
    "cache-control",
    key.startsWith("ephemeral/") ? "private, max-age=3600" : "public, max-age=31536000, immutable",
  );
  if (!("body" in obj)) return new Response(null, { status: 304, headers });
  const ranged = request.headers.has("range") && obj.range;
  if (ranged && "offset" in obj.range! && obj.range.offset !== undefined) {
    const offset = obj.range.offset;
    const length = obj.range.length ?? obj.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    return new Response(request.method === "HEAD" ? null : obj.body, { status: 206, headers });
  }
  return new Response(request.method === "HEAD" ? null : obj.body, { headers });
}
