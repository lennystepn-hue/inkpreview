# 🖋️ InkPreview

**AI Tattoo Studio** — describe a tattoo, watch the AI conjure the design, see it on *your* skin, and send the clean artist-ready file to your studio.

> **The one rule:** the **clean design is canonical**. It's generated once and is exactly what the tattoo artist receives — it is *never* round-tripped through the body composite. The on-skin preview is a separate, AI-derived visualization layer.

Mobile-first PWA · "Night Parlour" design (a tattoo shop after dark: flash paper, one neon sign, stencil violet) · 43-style catalog · powered by OpenAI **GPT Image 2.5** (flare for designs, sunburst for the on-skin edit).

---

## The loop

1. **Conjure** — prompt + style(s) → `gpt-image-2.5-flare` generates a clean black-on-white design (the canonical artist file). `✨ Enhance` and `🎲 I'm feeling magic` help. Re-roll variants.
2. **On Skin** — upload a body photo, tap where + pick a size (S/M/L/Sleeve) → `gpt-image-2.5-sunburst` composites the design realistically onto the skin.
3. **Send** — export the hi-res clean design + the body mockup, share to the studio.

## Architecture

Runs entirely on **Cloudflare** — one Worker (`worker/`) at `ink-preview.com`:

```
React + Vite + TS (PWA, mobile-first) — bundled into the Worker
        │ same origin
Cloudflare Worker (TypeScript, Hono) ── /api/* ── Queue ──► job consumer ──► OpenAI (GPT Image 2.5)
        │                                                      │
  Database Durable Object (SQLite, EU)          R2 "inkpreview-media" (EU) ── /media/*
```

- **Worker:** TypeScript port of the former FastAPI backend — same API, same responses.
  Image jobs run through a **Queue**; an hourly **cron** deletes expired body photos.
- **Data:** one SQLite-backed **Durable Object** (EU jurisdiction). **Media:** R2 (EU).
- **ImageEngine** is swappable: `MockImageEngine` (deterministic, keyless — dev + tests) and
  `OpenAIImageEngine` (gpt-image-2.5-flare generate + gpt-image-2.5-sunburst multi-image edit composite + gpt-4o-mini prompt-enhance). Models are config (`worker/wrangler.jsonc` vars).
- **Image processing** (thumbnails, placement guide, watermark, stencil, EXIF strip) is pure
  TypeScript — no native deps.
- **Frontend:** React + Tailwind v4 + Framer Motion + TanStack Query + zustand. Installable PWA,
  anonymous session. Design system: tokens in `frontend/src/styles/theme.css`, design context in
  [`.impeccable.md`](.impeccable.md); fonts are self-hosted in `frontend/public/fonts` (no Google Fonts).
- **Privacy:** body photos & previews are **ephemeral** (24h TTL + sweeper, EXIF stripped on upload),
  all data stored in the EU.

`backend/` (Python/FastAPI) is the previous implementation, kept as reference; it is no longer deployed.

## Local development

Requires Node 22+. Everything runs locally (Durable Object, R2 and Queue are simulated).

```bash
# Worker: API + jobs + SEO pages on http://localhost:8787 (mock image engine)
cd worker
cp .dev.vars.example .dev.vars
npm ci
npm run dev

# Frontend with hot reload (in another terminal) — proxies /api + /media to :8787
cd frontend
npm ci
npm run dev          # http://localhost:5173
```

The **mock engine** produces real placeholder PNGs, so the whole loop works with **no API key
and no spend**. For real generation set `IMAGE_ENGINE=openai` and `OPENAI_API_KEY` in
`worker/.dev.vars`.

## Tests

```bash
cd worker && npm test                 # 112 tests inside the Workers runtime (API, jobs, images, quota, billing, SEO)
cd frontend && npx tsc -b --noEmit    # typecheck
```

## Styles

A data-driven catalog of **43 hand/AI-authored prompt recipes** (`worker/src/styles/recipes.json`) — Fine-Line, Blackwork, American Traditional, Japanese/Irezumi, Realism, Dotwork, Geometric, Watercolor, Lettering, Cyber-Sigilism, and more. Each recipe is a tuned prompt (positive/negative cues + qualifiers) so a style actually *looks* like that style. The public API exposes only display fields — the prompt cues stay server-side.

## Deploy

```bash
cd worker && npm ci && npm run deploy
```

See **[docs/DEPLOY.md](docs/DEPLOY.md)** (secrets, costs, operations) and
[docs/DOMAIN-SETUP.md](docs/DOMAIN-SETUP.md).

## Status (v0.1 — core loop)

✅ Generate · ✅ try-on (AI placement) · ✅ export · ✅ real GPT Image 2.5 · ✅ PWA · ✅ ephemeral privacy.

Deferred to later sessions: Stripe credits/payments · full content moderation · GDPR self-serve export/delete · B2B studio white-label · live-camera AR.

Design + plan: [`docs/superpowers/specs`](docs/superpowers/specs) · [`docs/superpowers/plans`](docs/superpowers/plans).
