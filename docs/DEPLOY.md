# Deploying InkPreview to a VPS

Dockerized stack: **Postgres + Redis + backend + Arq worker + frontend**, behind a
TLS reverse proxy. Media is stored on a shared volume and served by the backend
(same-origin), so image display **and** downloads work without object storage.

## 0. Prerequisites on the VPS

- Docker + Docker Compose plugin (`docker compose version`).
- A domain pointed at the server (A/AAAA record), e.g. `inkpreview.example`.
- Ports 80/443 open.

## 1. Get the code + configure

```bash
git clone <your-repo> inkpreview && cd inkpreview
cp .env.example .env
```

Edit `.env` and set at least:

| var | value |
|---|---|
| `SESSION_SECRET` | long random string (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | a strong password |
| `OPENAI_API_KEY` | your key (kept only on the server) |
| `CORS_ORIGINS` | `https://inkpreview.example` |

Defaults already set `IMAGE_ENGINE=openai`, `JOB_MODE=arq`, `OPENAI_IMAGE_MODEL=gpt-image-2`.
`docker-compose.yml` overrides DB/Redis/storage to the in-stack services and
filesystem media (`MEDIA_BASE_URL=/media`) — leave those as-is.

> ⚠️ The OpenAI image models may require **organization verification** on your
> OpenAI account. If generation fails with a verification error, verify the org
> in the OpenAI dashboard.

## 2. Build + run

```bash
docker compose up -d --build
docker compose ps          # postgres, redis, backend, worker, frontend healthy
docker compose logs -f backend
```

The backend creates its tables on first boot (`create_all`). The frontend is a
static nginx image (SPA). Neither is published directly — the reverse proxy
fronts them.

## 3. TLS reverse proxy (Caddy — simplest)

Caddy gets you automatic HTTPS. Install Caddy on the host (or run it as another
container on the same Docker network) and use:

```caddyfile
inkpreview.example {
    encode zstd gzip

    # API + media → backend (same-origin keeps downloads working)
    @backend path /api/* /media/*
    reverse_proxy @backend backend:8000

    # everything else → the SPA
    reverse_proxy frontend:80
}
```

If Caddy runs on the host (not in the compose network), publish the container
ports instead — add `ports: ["127.0.0.1:8000:8000"]` to `backend` and
`["127.0.0.1:8080:80"]` to `frontend`, then `reverse_proxy 127.0.0.1:8000` /
`127.0.0.1:8080`.

(Traefik/nginx work too — route `/api/*` and `/media/*` to backend:8000, the
rest to frontend:80.)

## 4. Verify

- `https://inkpreview.example/api/health` → `{"status":"ok"}`
- Open the site, generate a design (watch `docker compose logs -f worker`), try it
  on a photo, export.

## Operations

- **Update:** `git pull && docker compose up -d --build`
- **Logs:** `docker compose logs -f backend worker`
- **Backups:** the Postgres volume (`postgres-data`) holds designs/users; the
  `media-data` volume holds generated images. Snapshot both. Body photos &
  previews auto-expire (ephemeral sweeper).
- **Scaling the worker:** `docker compose up -d --scale worker=3`

## Migrations

v0.1 uses `Base.metadata.create_all` on startup (fine for a fresh deploy). When
you start evolving the schema in production, introduce **Alembic** (`uv run
alembic init`) and gate `create_all` behind dev-only.

## Object storage (optional scale-up)

Filesystem media on a volume is the default and works great for a single host.
To move media to S3/MinIO (multi-host, CDN), set on `backend` + `worker`:

```
STORAGE_BACKEND=s3
S3_ENDPOINT=...   S3_ACCESS_KEY=...   S3_SECRET_KEY=...   S3_BUCKET=inkpreview
```

Note: `S3Storage` returns **presigned URLs**, so the frontend download helper
(which currently fetches media same-origin) needs adjusting to fetch the
presigned URL directly. Track that before flipping to S3.

## Privacy / GDPR notes

- Body photos & previews are ephemeral (TTL `BODY_PHOTO_TTL_HOURS` /
  `PREVIEW_TTL_HOURS`, default 24h) with an in-app sweeper; EXIF is stripped on
  upload. Host in the EU for DSGVO alignment.
- Full self-serve export/delete UX + content moderation are planned follow-ups.
