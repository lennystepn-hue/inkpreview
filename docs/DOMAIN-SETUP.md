# ink-preview.com — domain + TLS (LIVE on Cloudflare Workers)

**Status: live.** `https://ink-preview.com` is served end-to-end by the Cloudflare
Worker `inkpreview` (see [DEPLOY.md](DEPLOY.md)). The old Hetzner origin is gone.

## How the domain is wired

- The zone `ink-preview.com` is on Cloudflare (Free plan). Visitor TLS is terminated at
  the edge (Universal SSL).
- Two **Worker routes** send all traffic to the Worker (declared in
  `worker/wrangler.jsonc`, applied on every `wrangler deploy`):
  - `ink-preview.com/*`
  - `www.ink-preview.com/*`
- The Worker itself answers every request — there is no origin server behind it:
  - `http://…` → `301` to `https://…`
  - `www.ink-preview.com` → `301` to `ink-preview.com` (matches the SEO canonical)
- The existing proxied (orange-cloud) DNS records for `ink-preview.com` and `www` must
  stay: a Worker route only fires for proxied hostnames. They still point at the old
  Hetzner IP (188.40.80.251), but no request ever reaches it.

## Optional cleanup (dashboard)

- **DNS**: replace the `A 188.40.80.251` records with the "originless" placeholder
  `AAAA 100::` (proxied) for `ink-preview.com` and `www`, so no dead IP is left in DNS.
  Keep them proxied.
- **SSL/TLS → Edge Certificates**: enable **Always Use HTTPS** and **HSTS** (the
  Worker already redirects; edge-level is marginally faster).
- The old Let's Encrypt/certbot setup and `enable-tls.sh` are obsolete.

## Post-launch SEO (optional)

- Add the property in **Google Search Console** + **Bing Webmaster Tools** and submit
  `https://ink-preview.com/sitemap.xml` (generated dynamically by the Worker).
- Validate: Google Rich Results Test (FAQ + BreadcrumbList), Facebook Sharing
  Debugger / X Card Validator (OG image).
