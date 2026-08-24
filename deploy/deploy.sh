#!/usr/bin/env bash
# Deploy InkPreview to the prod box.
#
# IMPORTANT: builds the tarball from the REPO ROOT via an absolute `-C`, so the
# current working directory never matters (a `tar … .` that accidentally ran from
# backend/ once shipped backend/.env as ./.env and clobbered the server's .env).
# ALL .env files are excluded — the prod /opt/inkpreview/.env is managed on the
# server and must never be shipped.
#
# Usage: deploy/deploy.sh [services...]   (default: frontend backend worker)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${INKPREVIEW_HOST:?set INKPREVIEW_HOST, e.g. root@your.server.ip}"
TGZ="/tmp/inkpreview-deploy.tgz"
SERVICES="${*:-frontend backend worker}"

# Run DB migrations only when the backend or worker image is in scope.
case " $SERVICES " in
  *" backend "*|*" worker "*) RUN_MIGRATE=1 ;;
  *) RUN_MIGRATE=0 ;;
esac

tar -C "$ROOT" -czf "$TGZ" \
  --exclude='./.git' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/dist' \
  --exclude='./frontend/.vite' \
  --exclude='./backend/.venv' \
  --exclude='**/__pycache__' \
  --exclude='**/.env' \
  --exclude='*.db' \
  --exclude='./media' \
  .

scp "$TGZ" "$HOST:/opt/inkpreview/inkpreview.tgz"
ssh "$HOST" "cd /opt/inkpreview && \
  mkdir -p backups && \
  (docker compose exec -T postgres pg_dump -U inkpreview -d inkpreview -Fc > backups/predeploy-\$(date +%Y%m%d-%H%M%S).dump 2>/dev/null && \
   ls -1t backups/predeploy-*.dump | tail -n +6 | xargs -r rm -f) || true && \
  tar xzf inkpreview.tgz && rm inkpreview.tgz && \
  bash deploy/remote-apply.sh '$SERVICES' '$RUN_MIGRATE'"

echo "Deployed: $SERVICES"
