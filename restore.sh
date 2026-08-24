#!/usr/bin/env bash
# Restore an InkPreview backup produced by backup.sh.
#   restore.sh db-YYYYMMDD-HHMMSS.dump [media-YYYYMMDD-HHMMSS.tgz]
# Files are read from /opt/inkpreview/backups. DESTRUCTIVE: --clean drops/recreates.
set -euo pipefail

cd /opt/inkpreview
DIR=/opt/inkpreview/backups
DUMP="${1:?usage: restore.sh <db-*.dump> [media-*.tgz]}"
MEDIA="${2:-}"

echo "Restoring DB from $DUMP ..."
docker compose exec -T postgres pg_restore -U inkpreview -d inkpreview --clean --if-exists --no-owner \
  < "$DIR/$DUMP"

if [ -n "$MEDIA" ]; then
  echo "Restoring media from $MEDIA ..."
  docker run --rm -v inkpreview_media-data:/data -v "$DIR":/backup alpine \
    sh -c "tar xzf /backup/$MEDIA -C /data"
fi

echo "restore done — consider restarting: docker compose restart backend worker"
