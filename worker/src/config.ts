/**
 * Env-driven settings — the Worker counterpart of backend/app/config.py.
 *
 * Defaults are the dev defaults of the Python app (mock engine, insecure dev
 * secret); production values come from wrangler.jsonc vars + secrets.
 */

export interface Settings {
  appEnv: string;
  isProd: boolean;
  imageEngine: "mock" | "openai";
  openaiApiKey: string | null;
  openaiImageModel: string;
  openaiCompositeModel: string;
  openaiImageSize: string;
  openaiImageQuality: string;
  openaiCompositeQuality: string;
  openaiTextModel: string;
  sessionSecret: string;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  stripeWebhookSecret: string | null;
  stripePriceId: string | null;
  stripeAutomaticTax: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string;
  frontendBaseUrl: string;
  /** Production hostname; requests to other prod hosts (www.) redirect here. */
  canonicalHost: string | null;
  anonRateLimit: number;
  rateLimitWindowS: number;
  guestGenerationLimit: number;
  freeMonthlyGenerationLimit: number;
  promoUnlimited: boolean;
  bodyPhotoTtlHours: number;
  previewTtlHours: number;
  maxUploadMb: number;
  freeExportMaxPx: number;
  corsOrigins: string[];
}

export const INSECURE_DEV_SECRET = "dev-insecure-change-me";

type RawEnv = Partial<Record<keyof Env, unknown>>;

function str(env: RawEnv, key: keyof Env, fallback: string): string {
  const v = env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}

function opt(env: RawEnv, key: keyof Env): string | null {
  const v = env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function int(env: RawEnv, key: keyof Env, fallback: number): number {
  const v = Number.parseInt(str(env, key, ""), 10);
  return Number.isFinite(v) ? v : fallback;
}

function bool(env: RawEnv, key: keyof Env, fallback: boolean): boolean {
  const v = str(env, key, "").toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

export function getSettings(env: Env): Settings {
  const e = env as unknown as RawEnv;
  const appEnv = str(e, "APP_ENV", "dev");
  return {
    appEnv,
    isProd: ["prod", "production"].includes(appEnv.toLowerCase()),
    imageEngine: str(e, "IMAGE_ENGINE", "mock") === "openai" ? "openai" : "mock",
    openaiApiKey: opt(e, "OPENAI_API_KEY"),
    openaiImageModel: str(e, "OPENAI_IMAGE_MODEL", "gpt-image-2"),
    openaiCompositeModel: str(e, "OPENAI_COMPOSITE_MODEL", "gpt-image-2"),
    openaiImageSize: str(e, "OPENAI_IMAGE_SIZE", "1024x1024"),
    openaiImageQuality: str(e, "OPENAI_IMAGE_QUALITY", "medium"),
    openaiCompositeQuality: str(e, "OPENAI_COMPOSITE_QUALITY", "medium"),
    openaiTextModel: str(e, "OPENAI_TEXT_MODEL", "gpt-4o-mini"),
    sessionSecret: str(e, "SESSION_SECRET", INSECURE_DEV_SECRET),
    stripeSecretKey: opt(e, "STRIPE_SECRET_KEY"),
    stripePublishableKey: opt(e, "STRIPE_PUBLISHABLE_KEY"),
    stripeWebhookSecret: opt(e, "STRIPE_WEBHOOK_SECRET"),
    stripePriceId: opt(e, "STRIPE_PRICE_ID"),
    stripeAutomaticTax: bool(e, "STRIPE_AUTOMATIC_TAX", false),
    googleClientId: opt(e, "GOOGLE_CLIENT_ID"),
    googleClientSecret: opt(e, "GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: str(e, "GOOGLE_REDIRECT_URI", "https://ink-preview.com/api/auth/google/callback"),
    frontendBaseUrl: str(e, "FRONTEND_BASE_URL", "https://ink-preview.com").replace(/\/+$/, ""),
    canonicalHost: opt(e, "CANONICAL_HOST"),
    anonRateLimit: int(e, "ANON_RATE_LIMIT", 30),
    rateLimitWindowS: int(e, "RATE_LIMIT_WINDOW_S", 3600),
    guestGenerationLimit: int(e, "GUEST_GENERATION_LIMIT", 2),
    freeMonthlyGenerationLimit: int(e, "FREE_MONTHLY_GENERATION_LIMIT", 10),
    promoUnlimited: bool(e, "PROMO_UNLIMITED", false),
    bodyPhotoTtlHours: int(e, "BODY_PHOTO_TTL_HOURS", 24),
    previewTtlHours: int(e, "PREVIEW_TTL_HOURS", 24),
    maxUploadMb: int(e, "MAX_UPLOAD_MB", 12),
    freeExportMaxPx: int(e, "FREE_EXPORT_MAX_PX", 1024),
    corsOrigins: str(e, "CORS_ORIGINS", "http://localhost:5173,http://localhost:8787")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

/**
 * Production misconfiguration that must not serve traffic (the Python app
 * refused to boot on these). Returns the list of problems (empty = fine).
 */
export function insecureProdConfig(s: Settings): string[] {
  if (!s.isProd) return [];
  const problems: string[] = [];
  if (s.sessionSecret === INSECURE_DEV_SECRET || s.sessionSecret.length < 16) {
    problems.push("SESSION_SECRET is unset or insecure");
  }
  return problems;
}
