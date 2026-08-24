#!/usr/bin/env bash
# Nightly InkPreview backup: Postgres dump (custom/restorable) + media volume,
# rotated locally. Backups live in /opt/inkpreview/backups, which is a host
# directory (NOT a Docker volume) so it survives `docker compose down -v`.
#
# OFF-BOX (recommended): set OFFSITE_RCLONE_REMOTE=remote:bucket/path and install
# rclone to push each backup off the host (protects against full disk loss).
set -euo pipefail

cd /opt/inkpreview
DIR=/opt/inkpreview/backups
mkdir -p "$DIR"
TS=$(date +%Y%m%d-%H%M%S)
KEEP=14

# 1) Postgres — custom format, restorable with pg_restore (local socket = trust auth)
docker compose exec -T postgres pg_dump -U inkpreview -d inkpreview -Fc > "$DIR/db-$TS.dump"

# 2) Media volume (canonical artist PNGs, mockups, etc.)
docker run --rm -v inkpreview_media-data:/data:ro -v "$DIR":/backup alpine \
  tar czf "/backup/media-$TS.tgz" -C /data . 2>/dev/null

# 3) Rotate — keep the newest $KEEP of each
ls -1t "$DIR"/db-*.dump 2>/dev/null   | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DIR"/media-*.tgz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

# 4) Optional off-box copy
if [ -n "${OFFSITE_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$DIR/db-$TS.dump" "$OFFSITE_RCLONE_REMOTE"
  rclone copy "$DIR/media-$TS.tgz" "$OFFSITE_RCLONE_REMOTE"
  echo "off-box: pushed to $OFFSITE_RCLONE_REMOTE"
fi

echo "backup ok: db-$TS.dump ($(du -h "$DIR/db-$TS.dump" | cut -f1)), media-$TS.tgz ($(du -h "$DIR/media-$TS.tgz" | cut -f1))"
