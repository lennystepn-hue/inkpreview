# Deploying InkPreview (Cloudflare)

Production runs entirely on Cloudflare, as **one Worker** (`worker/`):

```
                       ink-preview.com/*  (Worker route)
                                 │
                     Worker "inkpreview" (TypeScript)
   ┌──────────────┬──────────────┼───────────────┬─────────────────────┐
 PWA (bundled   /api/* JSON API  /media/* ← R2   SEO pages: /d/*, /style/*, /tattoo/*,
 frontend/dist)  (Hono)          "inkpreview-     /de/style/*, /de/tattoo/*, /sitemap.xml
                   │              media" (EU)
                   ├── Database Durable Object (SQLite, EU jurisdiction) — all tables
                   ├── Queue "inkpreview-jobs" → consumer: OpenAI generate / composite
                   └── Cron (hourly): delete expired body photos + previews, fail stuck jobs
```

It replaces the old Hetzner stack (nginx + Caddy + FastAPI + Postgres + Redis/Arq + media volume).
The Python backend in `backend/` is kept as the reference implementation only — it is
not deployed anymore.

## Costs

- **Workers Paid** ($5/month, already active on the account) covers the Worker,
  Durable Objects, Queues and Cron within its included usage. InkPreview on its own
  stays inside the included quotas at the current scale.
- **R2**: free up to 10 GB storage; egress is free.
- **OpenAI**: billed per generation/composite on your OpenAI account (unchanged).
- No containers, no external database, no other paid services.

## Secrets

Set once per Worker (not in git). Either in the dashboard
(Workers & Pages → `inkpreview` → Settings → Variables and Secrets) or locally:

```bash
cd worker
npx wrangler secret put OPENAI_API_KEY        # required for real generation
npx wrangler secret put GOOGLE_CLIENT_ID      # "Sign in with Google" (optional)
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put STRIPE_SECRET_KEY     # billing (optional, all four)
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_ID
```

`SESSION_SECRET` is already set (random). Changing it logs every user out (their
anonymous session tokens become invalid). Without `OPENAI_API_KEY`, generations fail
with "OpenAI is not configured" and the quota is refunded; `/api/ready` reports
`openai: error`.

The Google OAuth redirect URI (`https://ink-preview.com/api/auth/google/callback`) and
the Stripe webhook URL (`https://ink-preview.com/api/billing/webhook`) are unchanged.

Non-secret settings (models, quotas, TTLs, …) are `vars` in `worker/wrangler.jsonc`.

## Deploy

```bash
cd worker
npm ci
npm run deploy      # builds frontend/ → bundles it into the Worker → wrangler deploy
```

`npm run deploy` works from a Claude Code cloud session too (the environment's
Cloudflare token is injected). The frontend is bundled into the Worker
(`scripts/embed-static.mjs`) rather than uploaded as Workers Static Assets, so one
`wrangler deploy` ships code + frontend atomically and `npx wrangler rollback` rolls
both back together.

## One-time setup (already done)

```bash
npx wrangler r2 bucket create inkpreview-media --jurisdiction eu
npx wrangler r2 bucket lifecycle add inkpreview-media ephemeral-backstop ephemeral/ \
  --expire-days 2 --jurisdiction eu      # safety net for body photos (sweeper deletes after 24h)
npx wrangler queues create inkpreview-jobs
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

The Durable Object and its SQLite schema are created by the first deploy
(`migrations` in `wrangler.jsonc`, schema migrations in `worker/src/db/schema.ts`).

> Never change `DB_JURISDICTION` on a live deployment — a different jurisdiction is a
> different (empty) database.

## Verify

- `https://ink-preview.com/api/health` → `{"status":"ok",…}`
- `https://ink-preview.com/api/ready` → `{"status":"ready","checks":{"db":"ok","storage":"ok","openai":"ok"}}`
- Generate a design, try it on a photo, export.

## Operations

- **Logs:** `npx wrangler tail inkpreview` (live) or the dashboard (Workers Logs are enabled).
- **Data:** the Database Durable Object has 30-day point-in-time recovery; the dashboard's
  Durable Objects data studio can browse the tables. Media lives in R2 (`inkpreview-media`, EU).
- **Rollback:** `npx wrangler rollback` (code + frontend together).
- **Privacy:** body photos + previews are deleted by the hourly cron after 24h
  (`BODY_PHOTO_TTL_HOURS` / `PREVIEW_TTL_HOURS`); the R2 lifecycle rule removes any
  leftovers under `ephemeral/` after 2 days. EXIF is stripped on upload. Data is stored in
  the EU (Durable Object jurisdiction + R2 jurisdiction).

## Importing the old Hetzner data (optional)

The schema and the media key layout are the same as before (`designs/<id>.png`,
`mockups/<id>.png`, …), and session tokens use the same format. A backup
(`db-*.dump` + `media-*.tgz` from `/opt/inkpreview/backups`) can be imported:
media → R2 under the same keys, rows → the Database object. With the old
`SESSION_SECRET`, existing users would even stay logged in. This needs a small
one-off import script — ask for it if you have the backup.

## Local development

```bash
cd worker && cp .dev.vars.example .dev.vars && npm ci
npm run dev                      # Worker on http://localhost:8787 (mock image engine, local D.O./R2/Queue)
cd ../frontend && npm ci && npm run dev   # Vite on :5173, proxies /api + /media to :8787
```

Tests: `cd worker && npm test` (runs inside workerd; mock engine, no network).
