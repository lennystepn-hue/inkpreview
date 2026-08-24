# InkPreview — Core Magic Loop — Design Spec

**Date:** 2026-06-06
**Status:** Approved direction, pending final spec review
**Scope:** v0.1 "Core Magic Loop" (the buildable slice). Payments, full moderation, GDPR-export tooling, and B2B studio white-label are explicitly deferred to later sessions (tracked in vibecell).

---

## 1. One sentence

The user describes a tattoo motif and picks style(s) → OpenAI generates a clean transparent-PNG design → the user uploads a photo of their body, taps where + picks a size → OpenAI places the design realistically on the skin → the user exports two files (the canonical hi-res clean design + the body mockup) to send to a tattoo artist.

## 2. The one non-negotiable rule

**The clean design is canonical; the body preview is derived.**

- The clean design PNG (what the artist receives) is generated **once** and stays pixel-exact. It is **never** round-tripped through the body composite.
- The body preview is a separate, AI-generated visualization layer on top.
- Letting the AI "paint" the tattoo onto skin slightly reinterprets the motif — fine for preview, fatal for the artist file. The artist always gets the clean generate.

## 3. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Build scope | Core magic loop, deployable. Generate → upload photo → **AI placement** → export. |
| Placement model | **AI-driven** (OpenAI image-edit), NOT a manual warp/rotate/scale canvas. |
| Placement input | **Tap a spot on the photo + coarse size hint (S / M / L / Sleeve).** No rotation, no dragging. |
| Image engine | **OpenAI Images API** (generate transparent PNG + multi-image edit composite), behind a swappable `ImageEngine` interface. Model id is config-driven; confirm `gpt-image-2` vs `gpt-image-1` at wiring. |
| Auth | **Anonymous session now** (signed token), schema is user-ready; email magic-link is a fast follow with no migration. |
| Aesthetic | **"Acid Ink"** — GenZ-wild, dark base + **acid-rave palette** (acid-lime + electric-cyan + hot-magenta on near-black), oversized kinetic type, sticker/cutout UI, grain + chrome, heavy tasteful motion. |
| Platform | **Mobile-FIRST** (thumb-zone, full-bleed canvas, bottom-sheets, camera capture, native share sheet, PWA-installable). Desktop is the scaled-up variant. |
| Hosting | Build solid **locally**, fully Dockerized; deploy to the user's VPS in a follow-up (SSH provided then). |
| Presets/assets | OK to pull clean OSS assets (Fontsource/Google Fonts, Lucide/Phosphor icons, OSS textures). **Per-style prompt recipes are hand-authored** (quality + IP). |

## 4. User flow (3 acts)

### Act I — Conjure (generate the design)
- Inputs: free-text prompt, one or more **styles** from the catalog, modifiers (color vs black-&-grey, line weight, complexity).
- `✨ Enhance` button expands a terse prompt into a rich, style-aware prompt via an LLM call.
- `I'm feeling magic` produces a curated random prompt+style.
- Submit → async job → **conjuring ritual** animation tied to job progress → reveal.
- Output: clean **transparent-background PNG** (the canonical design). User can request **variants** (re-generate keeping prompt/style; tracked via `parent_design_id`).

### Act II — On Skin (AI placement)
- Upload a body-part photo (mobile: camera capture or library). Stored **ephemerally** with `expires_at`.
- User **taps the placement point** on the photo and picks a **size hint** (S / M / L / Sleeve).
- Submit → async job → OpenAI image-edit composites the canonical design onto the skin (skin tone, lighting, body curvature) at the tapped location/size.
- Output: a **preview** image. User can re-roll. The canonical design is untouched.

### Act III — Send (export)
- Export produces: (a) the **clean hi-res design** (artist-ready, optionally with a stencil/outline variant later) and (b) the **body mockup**.
- Free tier → watermarked, lower-res preview. Clean/un-watermarked export is the future paywall (Stripe is a later session; **watermark + gating logic is built now** so the seam exists).
- Share via native share sheet / copyable link.

## 5. Styles — data-driven catalog

Styles are a **catalog** (DB-seeded from a versioned JSON/Python source), not a hardcoded dropdown. Each entry is a tuned **prompt recipe**:

```
StyleRecipe = {
  slug, name, description, category, example_thumb,
  positive_cues: str,          # style descriptors
  negative_cues: str,          # what to avoid
  base_qualifiers: str,        # "clean linework, isolated on transparent background,
                               #  stencil-ready, centered, no skin, no background, no watermark"
  default_modifiers: {...},    # color/bw, line weight, complexity defaults
  tags: [...]
}
```

The final generation prompt = `template(user_prompt, selected_styles, modifiers)`. Hand-authored recipes are where the "impeccable" look lives.

**Starter catalog (~40, extensible):** Fine-Line, Blackwork, American Traditional, Neo-Traditional, Japanese/Irezumi, Realism, Black & Grey, Portrait, Geometric, Dotwork, Mandala, Ornamental, Tribal, Polynesian, Maori, Watercolor, Trash Polka, Sketch, New School, Lettering/Script, Chicano, Minimalist, Micro, Surrealism, Biomechanical, Cyber-Sigilism, Illustrative, Engraving/Woodcut, Floral/Botanical, Celestial, Anime, Single-Needle, Ignorant Style, Sailor Jerry, 3D-Realism, Glitch, Abstract, Linework, Stick-and-Poke.

## 6. The "magic" — concrete features

1. **Conjuring ritual** — full-bleed dark stage; ink/particles coalesce into the motif, bound to job progress; reveal lands like a summoning.
2. **3D depth (React Three Fiber)** — restrained, perf-budgeted 3D accent (floating ink-drop hero / parallax-tilted mockup card). Progressive-enhanced; never blocks mobile.
3. **✨ Enhance Prompt** — LLM turns novice input into a pro, style-aware prompt.
4. **I'm feeling magic** — curated random prompt+style for inspiration.
5. **Micro-interactions** — ink-ripple on tap, kinetic type, magnetic buttons, haptics on mobile where available. Polished via `polish`/`delight` skills.

## 7. Architecture

```
[ React + Vite + TS + Tailwind (PWA, mobile-first) ]
        | REST (+ optional SSE for live reveal)
[ FastAPI ]  --enqueue-->  [ Redis ]  --consume-->  [ Arq worker ]
        |                                                  |
   [ Postgres ]                                   [ ImageEngine ]
        |                                          /            \
   [ S3 / MinIO ]                       OpenAIImageEngine   MockImageEngine
```

- **Backend:** FastAPI + Postgres + Redis. Image jobs run async in an **Arq** worker (redis-backed, async-native) — HTTP never blocks on 10–30s generations. Status via polling; optional SSE for the live reveal.
- **Image engine:** `ImageEngine` protocol with `generate_design(prompt, styles, modifiers) -> CleanDesign` and `composite_on_body(body_photo, design, placement) -> Preview`. Two impls: `OpenAIImageEngine` (real), `MockImageEngine` (deterministic stand-in art for tests + keyless dev). Concrete engine + model id selected by config → the entire pipeline is built and tested against the mock; the real key drops in with zero re-architecting.
- **Storage:** S3-compatible. Local dev uses **MinIO** in docker-compose (dev == prod). **Designs persistent; body photos & previews ephemeral** (`expires_at` + sweeper).
- **Frontend:** React + Vite + TypeScript + Tailwind; Framer Motion (motion) + React Three Fiber (3D). "Acid Ink" design system. PWA (installable, offline shell).
- **Auth:** anonymous signed-session token issued on first visit → maps to a `users` row (`is_anonymous=true`). Magic-link later attaches an email to the same row.

## 8. Data model (core subset)

- `users` — id, email (nullable), is_anonymous, credits, plan, locale, created_at
- `designs` — id, user_id, prompt, enhanced_prompt, styles (jsonb), modifiers (jsonb), status (queued|processing|done|failed), clean_png_url, thumb_url, width, height, parent_design_id (variants), created_at
- `body_photos` — id, user_id, storage_ref, content_hash, expires_at, created_at  *(ephemeral)*
- `previews` — id, design_id, body_photo_id, x_pct, y_pct, size_hint, status, output_url, expires_at, created_at  *(ephemeral)*
- `exports` — id, design_id, preview_id (nullable), hires_url, mockup_url, watermarked (bool), created_at
- `events` — id, user_id, action, payload (jsonb), created_at  *(audit / future GDPR)*

(Job state can live on `designs`/`previews` via `status`; no separate jobs table needed for v0.1.)

## 9. API (REST)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/session` | Bootstrap/refresh anonymous session → signed token |
| GET | `/api/styles` | Style catalog |
| POST | `/api/prompt/enhance` | LLM prompt enhancement (`✨`) |
| POST | `/api/designs` | Create generation job → `{id, status}` |
| GET | `/api/designs/{id}` | Poll status + result |
| POST | `/api/designs/{id}/variants` | Generate N variants |
| GET | `/api/designs` | Gallery (current user) |
| POST | `/api/body-photos` | Upload ephemeral body photo (multipart) |
| POST | `/api/previews` | Create AI-placement job (`design_id, body_photo_id, x_pct, y_pct, size_hint`) |
| GET | `/api/previews/{id}` | Poll status + result |
| POST | `/api/exports` | Produce hi-res clean + mockup (watermark per tier) |
| GET | `/api/exports/{id}` | Download links |
| GET | `/api/health` | Liveness |

Rate-limit anonymous generation/composite endpoints; gate behind a (stubbed) credit check so the payment seam exists.

## 10. Aesthetic system — "Acid Ink"

- **Base:** near-black layered charcoals (`#0a0a0b`–`#15151a`), film-grain + ink-bleed vignette.
- **Accents (acid-rave):** acid-lime, electric-cyan, hot-magenta — used as glows/gradients/strokes, not flat fills. Chrome/iridescent touches sparingly.
- **Type:** oversized kinetic display face (Clash Display / Unbounded-class, OSS) for headlines; clean grotesque (Inter/Geist) for UI; optional tattoo-script accent.
- **Surfaces:** dark glass cards, hairline borders, sticker/cutout chips with slight rotation.
- **Motion:** ink-reveals, staggered fades, magnetic/haptic buttons, kinetic type. Respect `prefers-reduced-motion`.
- **Mobile-first ergonomics:** controls in thumb zone, bottom-sheets for prompt/style/placement, full-bleed canvas, large tap targets, camera capture, native share.
- Finalized live in-app via `frontend-design` / `typeset` / `colorize` / `delight` / `polish`; verified with the Preview tool on a mobile viewport.

## 11. Privacy (from day one)

- Body photos & previews are **ephemeral**: `expires_at` + a sweeper job that deletes storage objects and rows.
- EU-hostable; `events` audit trail.
- Visible disclaimer: **"Vorschau ≠ finales Tattoo"** — the artist adapts the final design.
- Full DSGVO export/delete UX and content moderation are later sessions; the ephemeral foundation ships now.

## 12. Testing strategy

- **TDD on the seams:** `ImageEngine` (with `MockImageEngine`), API endpoints (pytest + httpx), job lifecycle (queued→processing→done/failed), watermark/gating, ephemeral sweeper.
- **Frontend:** component tests for the key flows; a smoke pass driven via the Preview tool on a mobile viewport.
- The mock engine makes the whole pipeline testable with **no API key and no spend**.

## 13. Build order (this session)

1. **Scaffold** — git, docker-compose (Postgres + Redis + MinIO), FastAPI app + config, React+Vite+TS+Tailwind, anonymous session, `ImageEngine` skeleton + `MockImageEngine`, health check, CI-friendly test setup.
2. **Acid Ink design system** — tokens (color/type/motion), base components, mobile-first shell + PWA. Established early so everything is built in-language.
3. **Generation** — style catalog + recipes, `POST /designs` + worker + polling, `✨` enhance, variants, gallery, conjuring ritual.
4. **Body upload + AI placement** — ephemeral upload, tap+size UI, `POST /previews` + worker, re-roll.
5. **Export** — hi-res clean + mockup, watermark/gating logic, share.
6. **Wire real OpenAI** — confirm model id/verification, swap engine via config, request + vault the API key.
7. **Dockerize + docs** — full compose, README, env contract, deploy guide (deploy executed when SSH provided).

## 14. Risks / honest unknowns

- **OpenAI model id + org verification** — confirm `gpt-image-2` vs `gpt-image-1`, transparent-bg support, and multi-image-edit support against the live account at wiring time.
- **Placement realism** — the multi-image-edit composite quality is the biggest unknown; mitigated by a tight prompt + re-roll. Documented fallback: client-side canvas warp for an instant free preview if quality/cost/latency disappoint.
- **Cost/latency per composite** — every preview is an API call → rate-limit anon + (stubbed) credit gate.
- **Mobile 3D perf** — R3F must be progressive-enhanced and perf-budgeted; honor reduced-motion.

## 15. Explicitly out of scope (later sessions)

Stripe payments & real credit purchase · full content moderation (hate symbols, IP, NSFW upload) · DSGVO self-serve export/delete UX · B2B studio white-label · live-camera AR (v0.2+) · stencil/outline export variant (nice-to-have, may sneak into export).
