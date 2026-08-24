import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { GrainOverlay } from "@/components/magic/GrainOverlay";
import { cn } from "@/lib/cn";
import { LANG_STORAGE_KEY, useLang, useLangPath, useT, useToggleLang } from "@/lib/useT";
import { AccountMenu } from "./AccountMenu";
import { BottomNav, NAV_ITEMS } from "./BottomNav";

function LangToggle() {
  const t = useT();
  const toggle = useToggleLang();
  return (
    <button
      onClick={toggle}
      className="rounded-full border border-white/10 px-2.5 py-1 font-display text-[11px] font-semibold text-white/55 transition-colors hover:text-white"
      aria-label="Switch language"
    >
      {t("nav.langLabel")}
    </button>
  );
}

export function AppShell() {
  const lang = useLang();
  const lp = useLangPath();
  const t = useT();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const detected = useRef(false);

  // keep <html lang> in sync for a11y + SEO
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // First-visit geo auto-detect: send German-region visitors to /de (once),
  // unless they already chose a language. Only from the home route.
  useEffect(() => {
    if (detected.current) return;
    detected.current = true;
    if (lang === "de" || pathname !== "/") return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (stored) return;
    const ctrl = new AbortController();
    fetch("/api/geo", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.lang === "de") navigate(`/de${search}`, { replace: true });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [lang, pathname, search, navigate]);

  return (
    <div className="relative min-h-[100dvh] bg-ink-950 text-white">
      <GrainOverlay />

      {/* ambient acid-rave glows */}
      <div className="pointer-events-none fixed -top-32 -left-24 h-80 w-80 rounded-full bg-acid/15 blur-[110px]" />
      <div className="pointer-events-none fixed top-1/3 -right-28 h-80 w-80 rounded-full bg-magenta/15 blur-[110px]" />
      <div className="pointer-events-none fixed bottom-10 left-1/4 h-64 w-64 rounded-full bg-cyan/10 blur-[110px]" />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3.5 md:max-w-6xl md:px-8 md:py-4">
          <Link
            to={lp("/")}
            className="font-display text-sm font-extrabold tracking-tight md:text-base"
          >
            INK<span className="text-acid">PREVIEW</span>
          </Link>

          {/* desktop top nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ to, key, end }) => (
              <NavLink
                key={to}
                to={lp(to)}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-4 py-1.5 font-display text-sm font-semibold tracking-tight transition-colors",
                    isActive ? "bg-acid/10 text-acid" : "text-white/55 hover:text-white",
                  )
                }
              >
                {t(key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LangToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-md px-5 pt-2 pb-28 md:max-w-6xl md:px-8 md:pt-6 md:pb-16">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
