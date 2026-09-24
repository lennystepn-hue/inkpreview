// Secrets (not in wrangler.jsonc — set with `wrangler secret put`, or in
// .dev.vars locally). All optional so a missing one degrades a feature instead
// of crashing the Worker.
interface Env {
  SESSION_SECRET?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
}

// Optional vars with code defaults.
interface Env {
  /** "queue" (default) or "inline" — run image jobs inside the request (tests). */
  JOB_MODE?: string;
  /** Durable Object jurisdiction for the database ("eu" in production, empty locally). */
  DB_JURISDICTION?: string;
}
