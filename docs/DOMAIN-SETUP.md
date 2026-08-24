# ink-preview.com — domain + TLS (LIVE)

**Status: live.** `https://ink-preview.com` serves the app end-to-end with valid TLS.

## Architecture

- The domain is on **Cloudflare (proxied / orange cloud)**. Cloudflare terminates
  visitor TLS at the edge (Universal SSL) and connects to the origin
  (the origin server's public IP) over HTTPS.
- Origin: host **nginx** vhost `/etc/nginx/sites-enabled/ink-preview`:
  - `:80` — Let's Encrypt ACME-renewal location + redirect to https.
  - `:443` — Let's Encrypt cert (`/etc/letsencrypt/live/ink-preview.com/`, issued via
    webroot HTTP-01 through the Cloudflare proxy, auto-renewing) → proxies to the
    InkPreview **Caddy overlay** at `127.0.0.1:18080` (SPA + `/api` + `/media`,
    same-origin). `client_max_body_size 25m`, 300s timeouts.
  - Cloudflare-aware `http → https` redirect (via `X-Forwarded-Proto`) and
    `www → apex` redirect (matches the SEO canonical).

## Verified

- `https://ink-preview.com/` → 200 (origin-direct and via Cloudflare).
- `http://` → 301 → https; `https://www.` → 301 → apex.
- `/api/feed`, `/robots.txt`, `/sitemap.xml`, `/og.png` → 200 over https.
- SEO over https: canonical, OG image, 4 JSON-LD blocks present.
- Cert valid until 2026-09-05, certbot auto-renew scheduled.

## Recommended Cloudflare hardening (dashboard, optional)

- **SSL/TLS → Overview**: set encryption mode to **Full (strict)** (the origin now
  has a valid public cert, so strict works and is the most secure).
- **SSL/TLS → Edge Certificates**: enable **Always Use HTTPS** and **HSTS** (the
  origin already redirects, but edge-level is cleaner).

## Post-launch SEO (optional)

- Add the property in **Google Search Console** + **Bing Webmaster Tools** and submit
  `https://ink-preview.com/sitemap.xml`.
- Validate: Google Rich Results Test (FAQ + SoftwareApplication), Facebook Sharing
  Debugger / X Card Validator (OG image).
- Consider prerendering/SSR of `/` and `/gallery` for non-JS crawlers.

> Note: `/opt/inkpreview/enable-tls.sh` (a `certbot --nginx` helper) is now obsolete —
> TLS was issued via webroot because the domain is Cloudflare-proxied.
