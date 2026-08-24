import type { Lang } from "./i18n";
import { getRef } from "./referral";
import { getToken, setToken } from "./session";

/**
 * On boot: Google redirects back to the SPA with the new session token (or an
 * error) in the URL fragment. Pull it out, store it, and clean the URL.
 */
export function consumeAuthRedirect(): "ok" | "error" | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const token = params.get("auth_token");
  const err = params.get("auth_error");
  if (!token && !err) return null;

  if (token) setToken(token);
  // strip the fragment without a reload
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return token ? "ok" : "error";
}

/** Full-page Google login, carrying the current anon token (to upgrade) + language. */
export function googleLoginUrl(lang: Lang): string {
  const p = new URLSearchParams({ lang });
  const t = getToken();
  if (t) p.set("token", t);
  const ref = getRef();
  if (ref) p.set("ref", ref);
  return `/api/auth/google/login?${p.toString()}`;
}
