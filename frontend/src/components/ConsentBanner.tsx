import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { buttonClass } from "@/components/ui/Button";
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

  // Both choices get the same weight (no nudging toward "accept").
  const choice = buttonClass("outline", "sm", "flex-1 sm:flex-none sm:min-w-28");

  return (
    <div
      role="region"
      aria-label={t("consent.title")}
      className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-5"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--shadow-panel),inset_0_0_0_1px_var(--color-line)] sm:flex-row sm:items-center sm:gap-6 md:p-5">
        <div className="flex-1">
          <p className="t-label text-text-3">{t("consent.title")}</p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-text-2">
            {t("consent.text")}{" "}
            <Link
              to={lp("/datenschutz")}
              className="text-text underline decoration-line-strong underline-offset-4 hover:decoration-text"
            >
              {t("consent.learn")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <button type="button" onClick={() => choose("denied")} className={choice}>
            {t("consent.reject")}
          </button>
          <button type="button" onClick={() => choose("granted")} className={choice}>
            {t("consent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
