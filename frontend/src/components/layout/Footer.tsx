import { Link } from "react-router-dom";

import { Dagger } from "@/components/brand/Dagger";
import { openConsent } from "@/lib/consent";
import { useLangPath, useT } from "@/lib/useT";

export function Footer() {
  const t = useT();
  const lp = useLangPath();
  const year = new Date().getFullYear();
  const link = "transition-colors hover:text-text";

  return (
    <footer className="mt-28 flex flex-col items-center gap-6 pb-4 text-center">
      {/* flash-sheet divider: rule · dagger · rule */}
      <div className="flex w-full max-w-md items-center gap-4 text-line-strong" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <Dagger className="h-7 w-auto rotate-180" />
        <span className="h-px flex-1 bg-line" />
      </div>

      <p className="gothic text-[2rem] text-text-3 select-none" aria-hidden>
        {t("footer.tagline")}
      </p>

      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-sans cond text-[0.8125rem] font-bold tracking-[0.06em] text-text-3 uppercase">
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
        <button type="button" onClick={openConsent} className={`${link} uppercase`}>
          {t("footer.cookies")}
        </button>
      </nav>
      <p className="t-label text-text-3">© {year} InkPreview</p>
    </footer>
  );
}
