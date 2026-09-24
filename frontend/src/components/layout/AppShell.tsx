import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { ConsentBanner } from "@/components/ConsentBanner";
import { DesignLightbox } from "@/components/DesignLightbox";
import { StencilDefs } from "@/components/StencilDefs";
import { UpgradeModal } from "@/components/UpgradeModal";
import { cn } from "@/lib/cn";
import { LANG_STORAGE_KEY, useLang, useLangPath, useT, useToggleLang } from "@/lib/useT";
import { AccountMenu } from "./AccountMenu";
import { BottomNav, NAV_ITEMS } from "./BottomNav";
import { Footer } from "./Footer";

function LangToggle() {
  const t = useT();
  const lang = useLang();
  const toggle = useToggleLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("nav.langLabel")}
      title={t("nav.langLabel")}
      className="t-label grid h-8 min-w-10 place-items-center rounded-full px-2.5 text-text-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:text-text hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
    >
      {lang === "de" ? "EN" : "DE"}
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
  const reduce = useReducedMotion();

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
    <div className="relative min-h-[100dvh] text-text">
      <StencilDefs />
      <a
        href="#main"
        className="t-label fixed top-2 left-2 z-[90] -translate-y-16 rounded-full bg-paper px-4 py-2.5 text-paper-ink transition-transform focus:translate-y-0"
      >
        {t("nav.skip")}
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 md:h-16 md:px-8">
          <Link
            to={lp("/")}
            aria-label="InkPreview"
            className="rounded-md text-[0.9375rem] md:text-base"
          >
            <Wordmark />
          </Link>

          {/* desktop top nav */}
          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            {NAV_ITEMS.map(({ to, key, end }) => (
              <NavLink
                key={to}
                to={lp(to)}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "relative py-2 font-sans cond text-[0.875rem] font-bold tracking-[0.08em] uppercase transition-colors",
                    isActive ? "text-text" : "text-text-3 hover:text-text",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {t(key)}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-[13px] h-[3px] rounded-full bg-neon shadow-[0_0_12px_2px_color-mix(in_srgb,var(--color-neon)_70%,transparent)]"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <LangToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="relative mx-auto w-full max-w-6xl px-5 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pt-10 md:pb-16"
      >
        <motion.div
          key={pathname}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
          <Footer />
        </motion.div>
      </main>

      <BottomNav />
      <ConsentBanner />
      <UpgradeModal />
      <DesignLightbox />
    </div>
  );
}
