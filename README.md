# 🖋️ InkPreview

**AI Tattoo Studio** — describe a tattoo, watch the AI conjure the design, see it on *your* skin, and send the clean artist-ready file to your studio.

> **The one rule:** the **clean design is canonical**. It's generated once and is exactly what the tattoo artist receives — it is *never* round-tripped through the body composite. The on-skin preview is a separate, AI-derived visualization layer.

Mobile-first PWA · GenZ "Acid Ink" aesthetic · 43-style catalog · powered by OpenAI **gpt-image-2**.

---

## The loop

1. **Conjure** — prompt + style(s) → `gpt-image-2` generates a clean black-on-white design (the canonical artist file). `✨ Enhance` and `🎲 I'm feeling magic` help. Re-roll variants.
2. **On Skin** — upload a body photo, tap where + pick a size (S/M/L/Sleeve) → `gpt-image-2` composites the design realistically onto the skin.
3. **Send** — export the hi-res clean design + the body mockup, share to the studio.

## Architecture

```
React + Vite + TS (PWA, mobile-first)  ──REST──►  FastAPI
        Acid Ink design system                       │ enqueue
                                              Redis ──► Arq worker
                                                          │
   Postgres ◄── data    S3/MinIO or FS ◄── media     ImageEngine
                                                     /          \
                                          OpenAIImageEngine   MockImageEngine
```

- **Backend:** FastAPI · SQLAlchemy 2 (async) · Redis/Arq jobs · Pillow · `openai`.
- **ImageEngine** is swappable: `MockImageEngine` (deterministic, keyless — used for dev + tests) and `OpenAIImageEngine` (gpt-image-2 generate + multi-image edit composite + gpt-4o-mini prompt-enhance).
- **Pluggable backends** by env: DB `sqlite ↔ postgres`, jobs `inline ↔ background ↔ arq`, storage `fs ↔ s3`. Local dev runs with **zero infrastructure**.
- **Frontend:** React + Tailwind v4 + Framer Motion + React Three Fiber (3D ink-drop) + TanStack Query + zustand. Installable PWA, anonymous session.
- **Privacy:** body photos & previews are **ephemeral** (TTL + sweeper, EXIF stripped on upload).

## Local development (no Docker needed)

Requires [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
# Backend (SQLite + in-process jobs + filesystem storage + MOCK engine by default)
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api + /media to :8000)
```

That's it — the **mock engine** produces real placeholder PNGs so the whole loop works with **no API key and no spend**.

### Turn on the real AI
Create `backend/.env` (git-ignored):

```env
IMAGE_ENGINE=openai
OPENAI_API_KEY=sk-...
JOB_MODE=background          # real calls take ~20-35s; don't block HTTP
```

Designs are generated on a clean white background (the standard flash/stencil convention) and the composite inks just the motif. See [`.env.example`](.env.example) for the full contract.

> If port 8000 is busy, run the backend on another port and set `VITE_BACKEND_URL` for the dev proxy (see `.claude/launch.json`).

## Tests

```bash
cd backend && uv run pytest -q        # 53 backend tests
cd frontend && npx tsc -b --noEmit    # typecheck
```

## Styles

A data-driven catalog of **43 hand/AI-authored prompt recipes** (`backend/app/styles/recipes.json`) — Fine-Line, Blackwork, American Traditional, Japanese/Irezumi, Realism, Dotwork, Geometric, Watercolor, Lettering, Cyber-Sigilism, and more. Each recipe is a tuned prompt (positive/negative cues + qualifiers) so a style actually *looks* like that style. The public API exposes only display fields — the prompt cues stay server-side.

## Deploy

See **[docs/DEPLOY.md](docs/DEPLOY.md)** — Dockerized (`docker compose up -d --build`) behind a TLS reverse proxy.

## Status (v0.1 — core loop)

✅ Generate · ✅ try-on (AI placement) · ✅ export · ✅ real gpt-image-2 · ✅ PWA · ✅ ephemeral privacy.

Deferred to later sessions: Stripe credits/payments · full content moderation · GDPR self-serve export/delete · B2B studio white-label · live-camera AR.

Design + plan: [`docs/superpowers/specs`](docs/superpowers/specs) · [`docs/superpowers/plans`](docs/superpowers/plans).
