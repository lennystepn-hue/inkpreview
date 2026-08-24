import { Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

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
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/80 p-4 backdrop-blur"
      onClick={close}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-extrabold tracking-tight">{t("upgrade.title")}</h2>
        <p className="mt-1 text-sm text-white/55">{t("upgrade.subtitle")}</p>

        <ul className="mt-4 space-y-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-sm text-white/80">
              <Check className="h-4 w-4 shrink-0 text-acid" /> {b}
            </li>
          ))}
        </ul>

        <p className="mt-5 font-display text-2xl font-extrabold">{t("upgrade.price")}</p>

        <label className="mt-4 flex gap-2 text-left text-xs leading-relaxed text-white/55">
          <input
            type="checkbox"
            checked={waive}
            onChange={(e) => setWaive(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-acid"
          />
          <span>
            {t("upgrade.waiver")}{" "}
            <Link to={lp("/agb")} className="text-acid underline">
              {t("footer.terms")}
            </Link>
          </span>
        </label>

        {error && <p className="mt-3 text-xs text-magenta">{t("upgrade.error")}</p>}

        <button
          onClick={go}
          disabled={!waive || busy}
          className="mt-4 w-full rounded-full bg-acid py-3 font-display text-sm font-bold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("upgrade.cta")}
        </button>
        <button
          onClick={close}
          className="mt-2 w-full py-2 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
