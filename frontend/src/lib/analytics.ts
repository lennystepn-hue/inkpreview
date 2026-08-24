type GtagWindow = Window & { gtag?: (...a: unknown[]) => void };

/** Fire a GA4 event — only if analytics is loaded (i.e. consent granted). No-op
 *  otherwise, so call sites never need to check consent. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const g = (window as GtagWindow).gtag;
  if (g) g("event", name, params ?? {});
}
