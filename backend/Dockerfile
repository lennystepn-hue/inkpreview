# InkPreview backend — uv-based image (prod).
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# System deps for Pillow runtime are present in the slim image; add curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install deps first (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App code + DB migrations (alembic upgrade head runs at deploy time)
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
