import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run fully local inside workerd: mock image engine, inline jobs, a fixed
// session secret, no jurisdiction (not supported locally), no external services.
const base = {
  APP_ENV: "test",
  IMAGE_ENGINE: "mock",
  SESSION_SECRET: "test-secret-not-for-prod",
  JOB_MODE: "inline",
  DB_JURISDICTION: "",
  // Pin prod URLs so a local .dev.vars (read by the pool too) can't leak in.
  FRONTEND_BASE_URL: "https://ink-preview.com",
  GOOGLE_REDIRECT_URI: "https://ink-preview.com/api/auth/google/callback",
  // Generous quota so behavior tests aren't throttled; quota tests get their own project.
  GUEST_GENERATION_LIMIT: "1000",
  FREE_MONTHLY_GENERATION_LIMIT: "100000",
};

function project(name: string, include: string[], bindings: Record<string, string> = {}) {
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { ...base, ...bindings } },
      }),
    ],
    test: { name, include, testTimeout: 60000 },
  };
}

export default defineConfig({
  test: {
    projects: [
      project("default", ["test/*.test.ts"]),
      project("quota", ["test/quota/*.test.ts"], { GUEST_GENERATION_LIMIT: "2" }),
      project("promo", ["test/promo/*.test.ts"], { PROMO_UNLIMITED: "true", GUEST_GENERATION_LIMIT: "1" }),
      project("configured", ["test/configured/*.test.ts"], {
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_PRICE_ID: "price_x",
        STRIPE_PUBLISHABLE_KEY: "pk_test_x",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }),
    ],
  },
});
