# InkPreview — dev commands.
# Local dev needs NO Docker: uv (Python) + npm (frontend).
# Docker compose targets are for the VPS deploy.

.PHONY: help be worker fe test lint migrate seed up down

help:
	@echo "be       - run backend (uvicorn, reload)"
	@echo "worker   - run arq worker (needs redis; local default JOB_MODE=inline needs no worker)"
	@echo "fe       - run frontend (vite dev)"
	@echo "test     - run backend tests"
	@echo "lint     - ruff check backend"
	@echo "migrate  - alembic upgrade head"
	@echo "seed     - seed style catalog"
	@echo "up/down  - docker compose (VPS/prod parity)"

be:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

worker:
	cd backend && uv run arq app.worker.WorkerSettings

fe:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest -q

lint:
	cd backend && uv run ruff check app

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python -m app.styles.seed

up:
	docker compose up -d --build

down:
	docker compose down
