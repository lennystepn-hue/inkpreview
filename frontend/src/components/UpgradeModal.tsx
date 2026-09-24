import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { trackEvent } from "@/lib/analytics";
import { startCheckout } from "@/lib/api";
import { useLangPath, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

/** Global Pro upgrade modal. Collects the immediate-performance / withdrawal
 *  waiver consent (required) before redirecting to Stripe Checkout. */
export function UpgradeModal() {
  const t = useT();
  const lp = useLangPath();
  const open = useUpgrade((s) => s.open);
  const close = useUpgrade((s) => s.closeUpgrade);
  const [waive, setWaive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const go = async () => {
    if (!waive || busy) return;
    setBusy(true);
    setError(false);
    trackEvent("upgrade_start");
    try {
      const { url } = await startCheckout(true);
      window.location.href = url;
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const benefits = [t("upgrade.b1"), t("upgrade.b2"), t("upgrade.b3")];

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="relative w-full max-w-sm rounded-[var(--radius-panel)] bg-surface p-6 shadow-[var(--shadow-panel),inset_0_0_0_1px_var(--color-line)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label={t("common.cancel")}
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full text-text-3 hover:bg-raised hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>

        <Label dot="gold">{t("pricing.recommended")}</Label>
        <h2 id="upgrade-title" className="heading mt-3 text-[2.25rem] text-text">
          {t("upgrade.title")}
        </h2>
        <p className="mt-2 text-[0.9375rem] text-text-2">{t("upgrade.subtitle")}</p>

        <ul className="mt-5 flex flex-col gap-2.5">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[0.9375rem] text-text">
              <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-jade" /> {b}
            </li>
          ))}
        </ul>

        <p className="heading mt-6 text-[2rem] text-text">{t("upgrade.price")}</p>

        <label className="mt-5 flex cursor-pointer gap-3 text-left text-[0.8125rem] leading-relaxed text-text-2">
          <input
            type="checkbox"
            checked={waive}
            onChange={(e) => setWaive(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-neon)]"
          />
          <span>
            {t("upgrade.waiver")}{" "}
            <Link to={lp("/agb")} className="text-text underline underline-offset-4">
              {t("footer.terms")}
            </Link>
          </span>
        </label>

        {error && <p className="mt-3 text-[0.8125rem] text-neon-hi">{t("upgrade.error")}</p>}

        <Button size="lg" className="mt-5 w-full" onClick={go} disabled={!waive || busy}>
          {t("upgrade.cta")}
        </Button>
      </div>
    </div>
  );
}
