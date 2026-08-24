import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { type DictKey, type Lang, t as translate } from "./i18n";

const LANG_KEY = "inkpreview.lang";

/** Current language, derived from the URL prefix (`/de` => German). */
export function useLang(): Lang {
  const { pathname } = useLocation();
  return pathname === "/de" || pathname.startsWith("/de/") ? "de" : "en";
}

/** `t("some.key", { var: x })` bound to the current language. */
export function useT() {
  const lang = useLang();
  return useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(key, lang, vars),
    [lang],
  );
}

/** Prefix an app path with the current language (e.g. `/studio` => `/de/studio`). */
export function useLangPath() {
  const lang = useLang();
  return useCallback(
    (path: string) => (lang === "de" ? `/de${path === "/" ? "" : path}` : path),
    [lang],
  );
}

/** Switch language by navigating to the mirrored URL and remembering the choice. */
export function useToggleLang() {
  const lang = useLang();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return useCallback(() => {
    const toDe = lang === "en";
    const stripped = pathname.replace(/^\/de(?=\/|$)/, "") || "/";
    const target = toDe ? `/de${stripped === "/" ? "" : stripped}` : stripped;
    try {
      localStorage.setItem(LANG_KEY, toDe ? "de" : "en");
    } catch {
      /* ignore storage errors (private mode) */
    }
    navigate(target + search);
  }, [lang, navigate, pathname, search]);
}

export const LANG_STORAGE_KEY = LANG_KEY;
