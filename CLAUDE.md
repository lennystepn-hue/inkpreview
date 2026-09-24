# InkPreview — notes for Claude sessions

- **Production = the Cloudflare Worker in `worker/`** (API, jobs, SEO pages, and the
  frontend bundled in). `backend/` (FastAPI) is the retired Hetzner implementation —
  reference only, never deployed. The root-level `src/`, `index.html`, `package.json`,
  `vite.config.ts` … are a stale copy of the frontend; the real one is `frontend/`.
- Deploy: `cd worker && npm ci && npm run deploy` (builds `frontend/`, embeds it via
  `scripts/embed-static.mjs`, then `wrangler deploy`). Works from cloud sessions with the
  injected Cloudflare token. Deploys and domain/route changes need the user's explicit go.
- Don't switch the frontend to Workers Static Assets: the asset-upload endpoint needs a
  separate upload JWT, which the cloud environment's credential proxy overwrites (401).
- The Cloudflare token here has no D1 or DNS permissions — data lives in a SQLite
  Durable Object (`worker/src/db/database.ts`, schema migrations in `schema.ts`,
  append-only). Never change `DB_JURISDICTION` (`eu`) on the live Worker.
- Tests: `cd worker && npm test` (vitest in workerd; mock engine, `JOB_MODE=inline`).
  Frontend: `cd frontend && npx tsc -b --noEmit && npx vitest run`.
- Local dev: `worker/.dev.vars` (copy `.dev.vars.example`) + `npm run dev`; frontend
  `npm run dev` proxies to :8787.
- Secrets (OPENAI_API_KEY, GOOGLE_*, STRIPE_*, SESSION_SECRET) live only in Cloudflare;
  never write them into files.
- Frontend design ("Night Parlour"): read `.impeccable.md` first. Tokens live in
  `frontend/src/styles/theme.css` (Tailwind v4 `@theme`; the default palette is cleared, so only
  the named tokens exist). Fonts are self-hosted in `frontend/public/fonts` and are also used by
  the Worker's SEO pages (`worker/src/seo.ts`) — don't add Google Fonts requests (GDPR).
