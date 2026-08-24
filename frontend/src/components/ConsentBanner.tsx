import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { CONSENT_EVENT, type Consent, getConsent, setConsent } from "@/lib/consent";
import { useLangPath, useT } from "@/lib/useT";

export function ConsentBanner() {
  const t = useT();
  const lp = useLangPath();
  const [open, setOpen] = useState(() => getConsent() === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (v: Consent) => {
    setConsent(v);
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 md:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-ink-850/95 p-4 shadow-xl backdrop-blur-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-white/65">
          {t("consent.text")}{" "}
          <Link to={lp("/datenschutz")} className="text-acid underline-offset-2 hover:underline">
            {t("consent.learn")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("denied")}
            className="flex-1 rounded-full border border-white/15 px-4 py-2 font-display text-xs font-semibold text-white/70 transition-colors hover:text-white sm:flex-none"
          >
            {t("consent.reject")}
          </button>
          <button
            onClick={() => choose("granted")}
            className="flex-1 rounded-full bg-acid px-4 py-2 font-display text-xs font-extrabold text-ink-950 transition-opacity hover:opacity-90 sm:flex-none"
          >
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
