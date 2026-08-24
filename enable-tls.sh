#!/usr/bin/env bash
# Finalize HTTPS for the site once DNS points at this box.
# Idempotent: safe to re-run. Adds a Let's Encrypt cert + http->https redirect to
# the existing nginx vhost (/etc/nginx/sites-enabled/ink-preview).
set -euo pipefail

DOMAIN="ink-preview.com"
EMAIL="lennystepn@gmail.com"
IP="${SERVER_IP:?set SERVER_IP to this box's public IP}"

echo "==> Checking DNS for $DOMAIN ..."
resolved="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
if [ -z "$resolved" ]; then
  echo "ERROR: $DOMAIN does not resolve yet. Point an A record:"
  echo "         $DOMAIN     A   $IP"
  echo "         www.$DOMAIN A   $IP   (or CNAME -> $DOMAIN)"
  echo "       (on Cloudflare: set to DNS-only / grey cloud for HTTP-01), then re-run."
  exit 1
fi
echo "    $DOMAIN -> $resolved"
if [ "$resolved" != "$IP" ]; then
  echo "WARNING: $DOMAIN resolves to $resolved, not $IP."
  echo "         If using Cloudflare proxy (orange cloud), HTTP-01 may fail — use DNS-only,"
  echo "         or switch to a DNS-01 / Cloudflare origin-cert flow."
fi

echo "==> Requesting certificate + wiring HTTPS via certbot --nginx ..."
certbot --nginx \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" \
  --redirect

echo "==> Testing + reloading nginx ..."
nginx -t && systemctl reload nginx

echo "==> Done. https://$DOMAIN should now be live."
curl -s -o /dev/null -w "https://$DOMAIN -> %{http_code}\n" "https://$DOMAIN/" || true
