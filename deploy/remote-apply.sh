#!/usr/bin/env bash
# Runs ON the prod box (cwd = /opt/inkpreview). Build-then-promote + DB migrations.
#   remote-apply.sh "<services>" "<run_migrate: 0|1>"
#
# Build-then-promote: images are BUILT first; only if every build succeeds do we
# swap the running containers. A failed build aborts (set -e) with the old
# containers untouched — no downtime, no half-deployed state.
set -euo pipefail

SERVICES="${1:?services required}"
RUN_MIGRATE="${2:-0}"
DC="docker compose -f docker-compose.yml -f docker-compose.deploy.yml"

# 1) BUILD the new images.
echo "==> Building: $SERVICES"
$DC build $SERVICES

# 2) MIGRATE before promoting new code (only when backend/worker is in scope).
#    Self-bootstrapping against the live DB:
#      - alembic_version present          -> upgrade head (normal forward path)
#      - no alembic_version but 'users'   -> adopt the pre-Alembic schema (built
#        by the old create_all path) via `stamp head`; marks baseline applied,
#        NO DDL, so existing data is never touched.
#      - empty DB                         -> upgrade head builds the whole schema.
if [ "$RUN_MIGRATE" = "1" ]; then
  HAS_ALEMBIC=$($DC exec -T postgres psql -U inkpreview -d inkpreview -tAc \
    "SELECT to_regclass('public.alembic_version') IS NOT NULL" | tr -d '[:space:]')
  HAS_USERS=$($DC exec -T postgres psql -U inkpreview -d inkpreview -tAc \
    "SELECT to_regclass('public.users') IS NOT NULL" | tr -d '[:space:]')
  if [ "$HAS_ALEMBIC" != "t" ] && [ "$HAS_USERS" = "t" ]; then
    echo "==> Pre-Alembic schema detected -> stamping baseline (no DDL)"
    $DC run --rm backend alembic stamp head
  else
    echo "==> alembic upgrade head"
    $DC run --rm backend alembic upgrade head
  fi
fi

# 3) PROMOTE: swap to the freshly-built images (no rebuild here).
echo "==> Promoting: $SERVICES"
$DC up -d --no-build $SERVICES
