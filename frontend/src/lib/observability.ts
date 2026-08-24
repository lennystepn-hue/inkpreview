/** Opt-in error monitoring (Sentry).
 *
 * With no `VITE_SENTRY_DSN` set this is a no-op AND the `@sentry/react` chunk is
 * never fetched (dynamic import), so it costs nothing until you wire a DSN.
 */
export async function initObservability(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // errors only — no perf tracing budget yet
    sendDefaultPii: false, // never ship prompts / body photos
  });
}
