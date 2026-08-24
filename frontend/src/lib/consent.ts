/**
 * Cookie/analytics consent. Google Analytics is NOT loaded until the user
 * explicitly accepts (TTDSG §25 / GDPR). On accept we inject gtag.js with
 * privacy-friendly flags; on reject we load nothing. The choice is persisted.
 */

const KEY = "inkpreview.consent"; // "granted" | "denied"
const GA_ID = "G-K1ZXV81EGV";
export const CONSENT_EVENT = "inkpreview:open-consent";

export type Consent = "granted" | "denied";

let analyticsLoaded = false;

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function loadAnalytics(): void {
  if (analyticsLoaded) return;
  analyticsLoaded = true;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  // GA expects the raw `arguments` object pushed onto the dataLayer; the cast
  // lets the variadic calls below type-check.
  const gtag = function () {
    w.dataLayer.push(arguments);
  } as (...a: unknown[]) => void;
  w.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

/** Call on app boot — loads analytics only if the user previously accepted. */
export function initConsentedAnalytics(): void {
  if (getConsent() === "granted") loadAnalytics();
}

export function setConsent(v: Consent): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
  if (v === "granted") loadAnalytics();
}

/** Re-open the consent banner (e.g. from the footer "Cookie settings" link). */
export function openConsent(): void {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
