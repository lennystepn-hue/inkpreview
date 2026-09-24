/**
 * InkPreview Worker entry — replaces nginx + Caddy + FastAPI + the Arq worker:
 *
 *   fetch      canonical redirects → /api (JSON API) → /media (R2) → SEO pages
 *              → the German SPA shell (/de…) → static assets (SPA fallback)
 *   queue      image jobs (generation + on-skin composite)
 *   scheduled  hourly: delete expired body photos/previews, fail stuck jobs
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

import { api } from "./api";
import { getSettings } from "./config";
import { dbStub } from "./context";
import { type Job, runJob } from "./jobs";
import { bodyPartPage, sharePage, sitemapXml, stylePage } from "./seo";
import { deleteMedia, serveMedia } from "./storage";
import { STATIC, type StaticFile } from "../.static/manifest";

export { Database } from "./db/database";

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// ───────────────────────── canonical host + scheme ─────────────────────────

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const s = getSettings(c.env);
  const canonical = s.canonicalHost;
  if (s.isProd && canonical && (url.hostname === canonical || url.hostname.endsWith(`.${canonical}`))) {
    // http → https and www → apex (matches the SEO canonical), like the old nginx vhost.
    if (url.protocol === "http:" || url.hostname !== canonical) {
      url.protocol = "https:";
      url.hostname = canonical;
      url.port = "";
      return c.redirect(url.toString(), ["GET", "HEAD"].includes(c.req.method) ? 301 : 308);
    }
  }
  await next();
  // Keep preview hosts (*.workers.dev) out of search indexes.
  if (url.hostname.endsWith(".workers.dev")) c.res.headers.set("X-Robots-Tag", "noindex");
});

// ───────────────────────── API + media ─────────────────────────

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => (getSettings(c.env).corsOrigins.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Session-Token"],
  }),
);
app.route("/api", api);
// Unmatched API paths must never fall through to the SPA shell.
app.all("/api/*", (c) => c.json({ detail: "Not Found" }, 404));

/** URL path → file path; a malformed %-escape is just "not found", not a 500. */
function decodePath(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

app.on(["GET", "HEAD"], "/media/*", (c) => {
  const key = decodePath(c.req.path.slice("/media/".length));
  return key === null ? c.text("Not Found", 404) : serveMedia(c.env, c.req.raw, key);
});

// ───────────────────────── server-rendered SEO pages ─────────────────────────

const html = (page: { html: string; status: number }) =>
  new Response(page.html, {
    status: page.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });

const baseUrl = (env: Env) => getSettings(env).frontendBaseUrl;
const RECENT = 60;

app.get("/d/:id", async (c) => {
  const db = dbStub(c.env);
  const id = c.req.param("id");
  const [design, recent] = await Promise.all([db.getDesign(id), db.recentDone(RECENT)]);
  return html(sharePage(baseUrl(c.env), id, design, recent));
});

for (const lang of ["en", "de"] as const) {
  const prefix = lang === "de" ? "/de" : "";
  app.get(`${prefix}/style/:slug`, async (c) =>
    html(stylePage(baseUrl(c.env), c.req.param("slug"), lang, await dbStub(c.env).recentDone(RECENT))),
  );
  app.get(`${prefix}/tattoo/:part`, async (c) =>
    html(bodyPartPage(baseUrl(c.env), c.req.param("part"), lang, await dbStub(c.env).recentDone(RECENT))),
  );
}

app.get("/sitemap.xml", (c) =>
  new Response(sitemapXml(baseUrl(c.env)), {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
  }),
);

// ───────────────────────── static files (the PWA) ─────────────────────────

const NO_CACHE = new Set(["/sw.js", "/registerSW.js", "/manifest.webmanifest"]);

function serveStatic(req: Request, path: string, file: StaticFile): Response {
  const headers = new Headers({ "Content-Type": file.type, ETag: file.etag });
  if (path.startsWith("/assets/")) {
    // Hashed build assets — file names change every build.
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (NO_CACHE.has(path) || file.type.startsWith("text/html")) {
    // Never pin an old service worker / shell, or deploys don't propagate.
    headers.set("Cache-Control", "no-cache");
  } else if (path.startsWith("/fonts/")) {
    // Self-hosted fonts (stable names, shared by the app and the SEO pages).
    headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  } else {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }
  if (req.headers.get("If-None-Match") === file.etag) return new Response(null, { status: 304, headers });
  return new Response(req.method === "HEAD" ? null : file.body.slice(0), { headers });
}

/** The built frontend, bundled into the Worker (see scripts/embed-static.mjs). */
app.on(["GET", "HEAD"], "*", (c) => {
  const path = decodePath(new URL(c.req.url).pathname) ?? "/";
  const exact = STATIC[path] ?? (path.endsWith("/") ? STATIC[`${path}index.html`] : undefined);
  if (exact) return serveStatic(c.req.raw, path, exact);
  // German shell — its own indexable URL with a localized <head>.
  if ((path === "/de" || path.startsWith("/de/")) && STATIC["/de/index.html"]) {
    return serveStatic(c.req.raw, path, STATIC["/de/index.html"]);
  }
  // A missing hashed asset must not come back as HTML (it would get cached as JS/CSS).
  if (path.startsWith("/assets/") || !STATIC["/index.html"]) return c.text("Not Found", 404);
  // Everything else is a client-side route of the English SPA.
  return serveStatic(c.req.raw, path, STATIC["/index.html"]);
});

app.all("*", (c) => c.text("Method Not Allowed", 405));

// ───────────────────────── queue + cron ─────────────────────────

/** Jobs that haven't finished in this time are failed (and refunded) by the sweeper. */
const STALE_JOB_MS = 30 * 60 * 1000;

async function sweep(env: Env): Promise<void> {
  const db = dbStub(env);
  const now = Date.now();
  // Body photos are sensitive (intimate body parts) — keep them no longer than necessary.
  const expired = await db.expiredEphemeral(new Date(now).toISOString());
  await deleteMedia(env, expired.keys);
  const deleted = await db.deleteEphemeral(expired.previewIds, expired.bodyIds);
  const stale = await db.failStaleJobs(new Date(now - STALE_JOB_MS).toISOString());
  await db.pruneRateHits(now - Math.max(getSettings(env).rateLimitWindowS, 3600) * 1000);
  console.log("sweep", { deleted, staleDesigns: stale.designs, stalePreviews: stale.previews });
}

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<Job>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await runJob(env, msg.body);
        msg.ack();
      } catch (err) {
        console.error("job crashed", msg.body, err);
        msg.retry({ delaySeconds: 10 });
      }
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweep(env));
  },
} satisfies ExportedHandler<Env, Job>;

export { sweep };
