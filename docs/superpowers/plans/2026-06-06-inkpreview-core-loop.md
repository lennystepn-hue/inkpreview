# InkPreview Core Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the InkPreview core magic loop locally end-to-end — generate a clean tattoo design (OpenAI, behind a mockable engine), place it on a body photo via AI (tap + size), and export the canonical hi-res design + body mockup — in a mobile-first "Acid Ink" PWA, fully Dockerized for later VPS deploy.

**Architecture:** FastAPI + Postgres (SQLAlchemy 2 async + Alembic) + Redis-backed Arq worker for async image jobs; S3/MinIO storage; an `ImageEngine` protocol with `OpenAIImageEngine` + `MockImageEngine` so the entire pipeline is built/tested without a key or spend. React + Vite + TS + Tailwind v4 frontend (Framer Motion + React Three Fiber, PWA, mobile-first). The clean design is canonical; the body preview is a derived AI layer.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2 (async, asyncpg), Alembic, Pydantic v2, Arq, aioboto3/MinIO, Pillow, openai SDK, pytest+pytest-asyncio+httpx · React 18, Vite, TypeScript, Tailwind v4, motion, @react-three/fiber+drei, zustand, TanStack Query, react-router, vite-plugin-pwa, lucide-react, Vitest+Testing Library · Docker Compose.

---

## File structure (decomposition lock)

```
ink-preview/
├─ docker-compose.yml              # postgres, redis, minio, backend, worker, frontend
├─ .env.example                    # env contract (NO secrets)
├─ Makefile                        # dev/test/up/down/migrate/seed commands
├─ backend/
│  ├─ pyproject.toml
│  ├─ Dockerfile
│  ├─ alembic.ini  + migrations/
│  └─ app/
│     ├─ main.py                   # FastAPI app factory, router include, CORS, lifespan
│     ├─ config.py                 # pydantic-settings Settings (env-driven)
│     ├─ db.py                     # async engine, session factory, get_session dep
│     ├─ models.py                 # SQLAlchemy ORM: users, designs, body_photos, previews, exports, events
│     ├─ schemas.py                # Pydantic request/response models
│     ├─ session_auth.py           # anonymous signed-token issue/verify dependency
│     ├─ storage.py                # S3/MinIO client: put/get/presign/delete
│     ├─ queue.py                  # Arq pool + enqueue helpers
│     ├─ worker.py                 # Arq WorkerSettings + job functions (generate, composite)
│     ├─ imaging/
│     │  ├─ engine.py              # ImageEngine Protocol + dataclasses (CleanDesign, PlacedPreview, Placement)
│     │  ├─ openai_engine.py       # OpenAIImageEngine (generate + multi-image edit)
│     │  ├─ mock_engine.py         # MockImageEngine (deterministic stand-in art)
│     │  ├─ factory.py             # get_engine() from config
│     │  ├─ watermark.py           # Pillow watermark + resize + thumb
│     │  └─ prompts.py             # prompt assembly from StyleRecipe + user input
│     ├─ styles/
│     │  ├─ catalog.py             # StyleRecipe dataclass + loader
│     │  └─ recipes.json           # ~40 hand-authored style recipes (seeded to DB)
│     ├─ routers/
│     │  ├─ session.py             # POST /api/session
│     │  ├─ styles.py              # GET /api/styles
│     │  ├─ prompt.py              # POST /api/prompt/enhance
│     │  ├─ designs.py             # POST/GET /api/designs, variants
│     │  ├─ body_photos.py         # POST /api/body-photos
│     │  ├─ previews.py            # POST/GET /api/previews
│     │  ├─ exports.py             # POST/GET /api/exports
│     │  └─ health.py              # GET /api/health
│     ├─ services/
│     │  ├─ cleanup.py             # ephemeral sweeper (expired body_photos/previews)
│     │  └─ ratelimit.py           # redis token-bucket for anon endpoints
│     └─ tests/                    # pytest mirror of app/
└─ frontend/
   ├─ package.json  vite.config.ts  tsconfig.json
   ├─ Dockerfile
   ├─ index.html
   ├─ public/  (icons, manifest, og-image)
   └─ src/
      ├─ main.tsx  App.tsx  router.tsx
      ├─ styles/theme.css          # Acid Ink @theme tokens (Tailwind v4)
      ├─ lib/api.ts                # typed fetch client + TanStack Query hooks
      ├─ lib/session.ts            # anon token bootstrap/store
      ├─ store/                    # zustand: design draft, placement
      ├─ components/ui/            # Button, Sheet, Chip, GrainOverlay, GlowText, ...
      ├─ components/magic/         # ConjuringRitual, InkDrop3D, EnhanceButton
      ├─ features/generate/        # PromptBar, StylePicker, VariantGrid
      ├─ features/place/           # PhotoUpload, TapToPlace, SizePicker, PreviewStage
      ├─ features/export/          # ExportSheet, ShareButton, Watermark note
      └─ features/gallery/         # DesignGallery
```

**Principle:** files split by responsibility, each small and focused. Routers thin; logic in `services/` + `imaging/`.

---

## Phase P0 — Scaffold & contracts

### Task 0.1: Repo hygiene + backend project
**Files:** Create `backend/pyproject.toml`, `backend/app/__init__.py`, `.gitattributes`, `Makefile`.
- [ ] Add `.gitattributes` with `* text=auto eol=lf` (kill CRLF churn on Windows).
- [ ] `pyproject.toml`: deps as listed in Tech Stack; tool config for ruff + pytest (`asyncio_mode = "auto"`).
- [ ] `Makefile` targets: `up`, `down`, `be`, `worker`, `fe`, `test`, `migrate`, `seed`, `lint`.
- [ ] Commit: `chore: backend project scaffold`.

### Task 0.2: Config (TDD)
**Files:** Create `backend/app/config.py`, `backend/app/tests/test_config.py`.
- [ ] **Test fails:** `test_settings_reads_env` — set env, assert `Settings()` exposes `database_url`, `redis_url`, `s3_endpoint`, `image_engine` (default `"mock"`), `openai_api_key` (optional), `openai_image_model`, `session_secret`, `anon_rate_limit`.
- [ ] Run: `pytest backend/app/tests/test_config.py -v` → FAIL.
- [ ] Implement `Settings(BaseSettings)` with `pydantic-settings`, env prefix none, `.env` support.
- [ ] Run → PASS. Commit: `feat: env-driven settings`.

### Task 0.3: ImageEngine contract + MockImageEngine (TDD)
**Files:** Create `backend/app/imaging/engine.py`, `mock_engine.py`, `factory.py`, `tests/test_mock_engine.py`.
- [ ] Define contract in `engine.py`:
```python
from dataclasses import dataclass
from typing import Protocol

@dataclass(frozen=True)
class GenSpec:
    prompt: str
    style_slugs: list[str]
    color: bool = True
    line_weight: str = "medium"   # thin|medium|bold
    complexity: str = "medium"    # simple|medium|detailed
    n: int = 1

@dataclass(frozen=True)
class CleanDesign:
    png_bytes: bytes              # transparent-background PNG
    width: int
    height: int

@dataclass(frozen=True)
class Placement:
    x_pct: float                  # 0..1 tap point on the body photo
    y_pct: float
    size_hint: str                # S|M|L|SLEEVE

@dataclass(frozen=True)
class PlacedPreview:
    png_bytes: bytes
    width: int
    height: int

class ImageEngine(Protocol):
    async def generate_design(self, spec: GenSpec) -> list[CleanDesign]: ...
    async def composite_on_body(
        self, body_png: bytes, design_png: bytes, placement: Placement
    ) -> PlacedPreview: ...
    async def enhance_prompt(self, prompt: str, style_slugs: list[str]) -> str: ...
```
- [ ] **Test fails:** `MockImageEngine.generate_design` returns `n` valid transparent PNGs (assert PNG magic bytes + RGBA via Pillow); `composite_on_body` pastes the design onto the body at placement (assert output dims == body dims); `enhance_prompt` returns a longer, deterministic string.
- [ ] Implement `MockImageEngine` with Pillow (draw a styled placeholder: text of prompt + style on transparent canvas; composite = alpha-paste scaled by size_hint at placement).
- [ ] `factory.get_engine(settings)` returns mock or openai by `settings.image_engine`.
- [ ] Run → PASS. Commit: `feat: ImageEngine contract + mock engine`.

### Task 0.4: DB models + Alembic + async session (TDD)
**Files:** Create `backend/app/db.py`, `models.py`, `alembic.ini`, `migrations/env.py`, `tests/test_models.py`.
- [ ] Models per spec §8 (users, designs, body_photos, previews, exports, events) with `status` enum on designs/previews (`queued|processing|done|failed`).
- [ ] **Test fails:** create a user + design (against a test Postgres via testcontainers OR a `DATABASE_URL_TEST`), assert round-trip + `parent_design_id` self-FK + jsonb fields.
- [ ] Configure async engine/session; Alembic autogenerate initial migration.
- [ ] Run → PASS. Commit: `feat: data model + initial migration`.

### Task 0.5: Storage (S3/MinIO) + anon session + health (TDD)
**Files:** Create `storage.py`, `session_auth.py`, `routers/health.py`, `routers/session.py`, `main.py`, tests.
- [ ] `storage.py`: `put_object`, `get_object`, `presign_get`, `delete_object` (aioboto3, bucket auto-create on startup, `designs/` persistent prefix, `ephemeral/` prefix).
- [ ] `session_auth.py`: issue signed token (itsdangerous) → anon `users` row; FastAPI dependency `current_user` that creates-on-first-call.
- [ ] **Test fails:** `GET /api/health` → 200 `{status:"ok"}`; `POST /api/session` → token; reusing token resolves same user.
- [ ] `main.py` app factory + CORS + lifespan (init storage bucket, arq pool).
- [ ] Run → PASS. Commit: `feat: storage, anon session, health`.

### Task 0.6: docker-compose + .env.example
**Files:** Create `docker-compose.yml`, `.env.example`, `backend/Dockerfile`.
- [ ] Services: `postgres:16`, `redis:7`, `minio` (+ console), `backend` (uvicorn), `worker` (arq), with volumes + healthchecks.
- [ ] `.env.example` documents every var from `config.py` (placeholders only).
- [ ] Verify: `make up` brings up infra; `GET /api/health` responds. Commit: `feat: docker-compose dev stack`.

## Phase P1 — Acid Ink design system & mobile shell

### Task 1.1: Frontend project + Tailwind v4 + tokens
**Files:** Create frontend Vite app, `src/styles/theme.css`, `tailwind` wiring, fonts via @fontsource.
- [ ] Scaffold Vite React-TS; install Tailwind v4, motion, @react-three/fiber, drei, zustand, @tanstack/react-query, react-router-dom, lucide-react, vite-plugin-pwa.
- [ ] `theme.css` `@theme`: color tokens (`--color-ink-950..800`, `--color-acid` lime, `--color-cyan`, `--color-magenta`), font tokens (display = Clash/Unbounded-class OSS, sans = Inter/Geist), radius, glow shadows.
- [ ] Verify dev server renders a tokens demo page. Commit: `feat: frontend scaffold + Acid Ink tokens`.

### Task 1.2: Core UI primitives + mobile shell
**Files:** `components/ui/*`, `App.tsx`, `router.tsx`, `components/magic/GrainOverlay`, `InkDrop3D`.
- [ ] Build: `Button` (magnetic), `Sheet` (bottom-sheet, mobile-first), `Chip` (sticker), `GlowText`, `GrainOverlay` (film grain), `InkDrop3D` (perf-budgeted R3F hero, reduced-motion aware).
- [ ] Mobile-first app shell: full-bleed dark canvas, bottom tab/CTA in thumb zone, route stubs for Generate/Place/Gallery.
- [ ] **Verify with Preview tool on a 390×844 mobile viewport** + desktop; screenshot. Commit: `feat: Acid Ink UI primitives + mobile shell`.

### Task 1.3: PWA + API client + anon bootstrap
**Files:** `vite-plugin-pwa` manifest, `public/` icons, `lib/api.ts`, `lib/session.ts`.
- [ ] PWA manifest (installable, dark theme color, name "InkPreview"), offline shell.
- [ ] `lib/api.ts` typed client + TanStack Query setup; `lib/session.ts` bootstraps anon token on load, attaches to requests.
- [ ] Verify install prompt + session token persists. Commit: `feat: PWA + API client + anon session`.

## Phase P2 — Generation

### Task 2.1: Style catalog + recipes (data)
**Files:** `styles/catalog.py`, `styles/recipes.json`, `routers/styles.py`, seed command, tests.
- [ ] `StyleRecipe` dataclass (spec §5). Author ~40 recipes in `recipes.json` (hand-tuned cues + base qualifiers). *(Parallelizable via Workflow — one agent per style cluster.)*
- [ ] **Test:** `GET /api/styles` returns catalog; each recipe has non-empty positive/negative/base cues.
- [ ] Seed recipes to DB on startup if empty. Commit: `feat: style catalog + recipes`.

### Task 2.2: Prompt assembly (TDD)
**Files:** `imaging/prompts.py`, `tests/test_prompts.py`.
- [ ] **Test fails:** `build_generation_prompt(GenSpec, recipes)` includes user prompt + selected styles' positive cues + base qualifiers (transparent bg, isolated, stencil-ready) + color/bw + negatives; `build_composite_prompt(Placement)` describes realistic on-skin placement (tone, light, curvature) without altering the motif.
- [ ] Implement; Run → PASS. Commit: `feat: prompt assembly`.

### Task 2.3: Design generation endpoint + worker (TDD)
**Files:** `routers/designs.py`, `worker.py`, `queue.py`, `schemas.py`, `services/ratelimit.py`, tests.
- [ ] **Test fails (engine=mock):** `POST /api/designs` → 202 `{id,status:"queued"}`; worker job runs engine.generate_design, stores PNG+thumb to `designs/`, sets status `done`, `clean_png_url`; `GET /api/designs/{id}` → `done` with url; anon rate-limit returns 429 past budget.
- [ ] Implement endpoint (enqueue), worker job, ratelimit token-bucket.
- [ ] Run → PASS. Commit: `feat: design generation pipeline`.

### Task 2.4: Variants + enhance + gallery (TDD)
**Files:** `routers/designs.py`, `routers/prompt.py`, tests.
- [ ] **Test fails:** `POST /api/designs/{id}/variants` creates children with `parent_design_id`; `POST /api/prompt/enhance` returns enhanced string (mock engine); `GET /api/designs` lists current user's designs newest-first.
- [ ] Implement; Run → PASS. Commit: `feat: variants, enhance, gallery`.

### Task 2.5: Generate UI + conjuring ritual
**Files:** `features/generate/*`, `components/magic/ConjuringRitual`, `components/magic/EnhanceButton`, `features/gallery/*`.
- [ ] PromptBar (with ✨ Enhance + "I'm feeling magic"), StylePicker (sticker chips, multi-select), submit → poll → ConjuringRitual (ink/particles bound to status) → VariantGrid; Gallery view.
- [ ] **Verify full generate flow against the running mock backend via Preview tool (mobile)**; screenshot the ritual + result. Commit: `feat: generate flow + conjuring ritual UI`.

## Phase P3 — Body upload + AI placement

### Task 3.1: Ephemeral body upload (TDD)
**Files:** `routers/body_photos.py`, `services/cleanup.py`, tests.
- [ ] **Test fails:** `POST /api/body-photos` (multipart, image only, size cap) stores to `ephemeral/` with `expires_at` (now + TTL), returns ref; `cleanup.sweep()` deletes expired storage objects + rows.
- [ ] Implement upload validation (content-type, max bytes, strip EXIF) + sweeper (arq cron). Commit: `feat: ephemeral body upload + sweeper`.

### Task 3.2: AI placement endpoint + worker (TDD)
**Files:** `routers/previews.py`, `worker.py`, tests.
- [ ] **Test fails (engine=mock):** `POST /api/previews {design_id, body_photo_id, x_pct, y_pct, size_hint}` → queued; worker runs `composite_on_body`, stores preview to `ephemeral/`, status `done`, `output_url`, `expires_at`; rejects mismatched ownership; rate-limited.
- [ ] Implement; Run → PASS. Commit: `feat: AI placement pipeline`.

### Task 3.3: Place UI (photo → tap → size → preview)
**Files:** `features/place/*` (PhotoUpload w/ camera capture, TapToPlace marker, SizePicker S/M/L/Sleeve, PreviewStage with re-roll).
- [ ] Mobile camera capture (`capture="environment"`), tap sets marker (x/y %), size chips, submit → poll → preview with parallax tilt; re-roll button.
- [ ] **Verify against mock backend via Preview tool (mobile)**; screenshot. Commit: `feat: body placement UI`.

## Phase P4 — Export

### Task 4.1: Export endpoint + watermark/gating (TDD)
**Files:** `routers/exports.py`, `imaging/watermark.py`, tests.
- [ ] **Test fails:** `POST /api/exports {design_id, preview_id?}` → for free tier: watermarked + downscaled clean PNG + watermarked mockup; record `exports` row with `watermarked=true`; (paid path stub: `watermarked=false`, full-res). `GET /api/exports/{id}` → presigned download urls.
- [ ] Implement Pillow watermark/resize; credit-gate stub (`current_user.credits`). Commit: `feat: export + watermark/gating`.

### Task 4.2: Export + share UI
**Files:** `features/export/*` (ExportSheet, ShareButton using Web Share API, disclaimer "Vorschau ≠ finales Tattoo").
- [ ] Two download cards (clean design / body mockup), native share, watermark/upgrade note.
- [ ] **Verify via Preview tool (mobile)**; screenshot. Commit: `feat: export + share UI`.

## Phase P5 — Wire real OpenAI

### Task 5.1: OpenAIImageEngine (TDD with mocked SDK)
**Files:** `imaging/openai_engine.py`, `tests/test_openai_engine.py`.
- [ ] Confirm model id + capabilities against the live API (transparent bg, multi-image edit, org verification). Record finding in spec open questions.
- [ ] **Test fails (SDK mocked):** `generate_design` calls images API with assembled prompt, `background="transparent"`, `output_format="png"`, requested size/n → returns CleanDesigns from decoded b64; `composite_on_body` calls images.edit with `[body_png, design_png]` + composite prompt → PlacedPreview; `enhance_prompt` calls chat/responses API.
- [ ] Implement against the `openai` SDK using config model id. Run → PASS (mocked). Commit: `feat: OpenAI image engine`.

### Task 5.2: Live smoke + flip engine
**Files:** `.env` (local, git-ignored), config flip `image_engine=openai`.
- [ ] Retrieve `OPENAI_API_KEY` from vault → write local `.env` (never echo/commit).
- [ ] Run one real generate + one real composite end-to-end; eyeball quality; tune prompts in `prompts.py` as needed.
- [ ] Commit prompt tuning only (no secrets): `feat: tune prompts from live results`.

## Phase P6 — Hardening & docs

### Task 6.1: Frontend tests + a11y/reduced-motion pass
- [ ] Vitest component tests for generate/place/export happy paths; `prefers-reduced-motion` respected; basic a11y (labels, focus, contrast on acid colors).
- [ ] Commit: `test: frontend flows + a11y pass`.

### Task 6.2: README + deploy guide
**Files:** `README.md`, `docs/DEPLOY.md`.
- [ ] README: what it is, local run (`make up`), env contract, architecture diagram, the canonical-design rule.
- [ ] `DEPLOY.md`: VPS steps (Docker, reverse proxy/TLS, env, MinIO/object storage, backups) — executed when SSH provided.
- [ ] Commit: `docs: readme + deploy guide`.

### Task 6.3: Full-stack verification
- [ ] `make up` + run full loop in a real browser via Preview tool on mobile + desktop viewports; capture screenshots of each act.
- [ ] Run `optimize`/`polish`/`delight` passes on the UI; final screenshot set.
- [ ] Commit: `chore: full-loop verification + polish`.

---

## Self-review

**Spec coverage:** §4 flow → P2/P3/P4; §5 styles → 2.1/2.2; §6 magic → 1.2(3D)/2.5(ritual,enhance)/2.4(enhance ep); §7 architecture → P0; §8 data model → 0.4; §9 API → all routers tasks; §10 aesthetic → P1; §11 privacy → 3.1 (ephemeral+sweeper) + 4.2 (disclaimer); §12 testing → TDD throughout + 6.1; §13 build order → phases P0–P6; §14 risks → 5.1 (model confirm), 2.3/3.2 (rate-limit), 1.2 (perf-budget 3D). No gaps.

**Placeholder scan:** Frontend visual tasks intentionally describe components + a live Preview-tool verification rather than full CSS (visual polish is iterative against a real viewport, per approved spec §10) — this is a deliberate methodology choice, not a TBD. All backend logic tasks carry concrete contracts/tests.

**Type consistency:** `ImageEngine`/`GenSpec`/`CleanDesign`/`Placement`/`PlacedPreview` defined in 0.3 are referenced consistently in 2.2/2.3/3.2/4.1/5.1. Status enum `queued|processing|done|failed` consistent across models + endpoints.
