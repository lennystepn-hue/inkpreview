import { Link } from "react-router-dom";

import { openConsent } from "@/lib/consent";
import { useLangPath, useT } from "@/lib/useT";

export function Footer() {
  const t = useT();
  const lp = useLangPath();
  const year = new Date().getFullYear();
  const link = "transition-colors hover:text-white/80";

  return (
    <footer className="mt-24 pb-2">
      {/* star rule — flash-sheet divider */}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
        <span className="text-xs text-acid/60">✦</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
      </div>

      <p className="mt-6 text-center font-tattoo text-2xl text-white/25 select-none" aria-hidden>
        {t("footer.tagline")}
      </p>

      <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs text-white/40">
        <Link to={lp("/explore")} className={link}>
          {t("nav.explore")}
        </Link>
        <Link to={lp("/pricing")} className={link}>
          {t("nav.pricing")}
        </Link>
        <Link to={lp("/impressum")} className={link}>
          {t("footer.impressum")}
        </Link>
        <Link to={lp("/datenschutz")} className={link}>
          {t("footer.privacy")}
        </Link>
        <Link to={lp("/agb")} className={link}>
          {t("footer.terms")}
        </Link>
        <button onClick={openConsent} className={link}>
          {t("footer.cookies")}
        </button>
      </nav>
      <p className="mt-4 text-center text-[11px] text-white/25">© {year} InkPreview</p>
    </footer>
  );
}
