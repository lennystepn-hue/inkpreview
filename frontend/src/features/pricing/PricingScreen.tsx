import { Check } from "lucide-react";

import { googleLoginUrl } from "@/lib/auth";
import { useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { type DictKey } from "@/lib/i18n";
import { useLang, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

const CONTACT = "mailto:contact@lenny.services?subject=InkPreview%20Studio";

type Tier = {
  name: DictKey;
  price: DictKey;
  features: DictKey[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "pricing.free.name",
    price: "pricing.free.price",
    features: ["pricing.free.f1", "pricing.free.f2", "pricing.free.f3"],
  },
  {
    name: "pricing.pro.name",
    price: "pricing.pro.price",
    features: ["pricing.pro.f1", "pricing.pro.f2", "pricing.pro.f3", "pricing.pro.f4"],
    highlight: true,
  },
  {
    name: "pricing.studio.name",
    price: "pricing.studio.price",
    features: ["pricing.studio.f1", "pricing.studio.f2", "pricing.studio.f3", "pricing.studio.f4"],
  },
];

export function PricingScreen() {
  const t = useT();
  const lang = useLang();
  const { data: session } = useSession();
  const { data: billing } = useBillingConfig();
  const openUpgrade = useUpgrade((s) => s.openUpgrade);

  const plan = session?.plan ?? "free";
  const isAnon = session?.is_anonymous ?? true;
  const isPro = plan === "pro" || plan === "studio";

  const primary =
    "block w-full rounded-full bg-acid py-2.5 text-center font-display text-xs font-bold text-ink-950 transition-opacity hover:opacity-90";
  const outline =
    "block w-full rounded-full border border-white/15 py-2.5 text-center font-display text-xs font-bold text-white/85 transition-colors hover:text-white";
  const muted = "block w-full py-2.5 text-center text-[11px] font-semibold text-white/40";

  const cta = (tier: Tier) => {
    if (tier.name === "pricing.studio.name") {
      return (
        <a href={CONTACT} className={outline}>
          {t("pricing.cta.studio")}
        </a>
      );
    }
    if (tier.name === "pricing.pro.name") {
      if (isPro) return <span className={muted}>{t("pricing.cta.current")}</span>;
      if (isAnon)
        return (
          <a href={googleLoginUrl(lang)} className={primary}>
            {t("pricing.cta.signin")}
          </a>
        );
      if (billing?.enabled)
        return (
          <button onClick={openUpgrade} className={primary}>
            {t("pricing.cta.pro")}
          </button>
        );
      return <span className={muted}>{t("pricing.cta.soon")}</span>;
    }
    // Free
    if (!isPro) return <span className={muted}>{t("pricing.cta.current")}</span>;
    return <span />;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-4xl">
          {t("pricing.title")}
        </h1>
        <p className="mt-2 text-sm text-white/50">{t("pricing.subtitle")}</p>
      </header>

      <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3 md:items-start">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={
              tier.highlight
                ? "relative -rotate-[0.6deg] rounded-blob border border-acid/50 bg-acid/[0.04] p-6 shadow-[var(--shadow-glow-acid)] transition-transform hover:rotate-0 md:scale-[1.03]"
                : tier.name === "pricing.studio.name"
                  ? "relative rounded-blob border border-white/10 border-t-cyan/50 bg-white/[0.02] p-6"
                  : "rounded-blob border border-white/10 bg-white/[0.02] p-6"
            }
          >
            {tier.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rotate-[2deg] rounded-full bg-acid px-3.5 py-1 font-display text-[10px] font-bold text-ink-950 shadow-[var(--shadow-glow-acid)]">
                ✦ {t("pricing.recommended")}
              </span>
            )}
            <h2 className="font-display text-lg font-extrabold">{t(tier.name)}</h2>
            <p className="mt-1 font-display text-2xl font-extrabold text-acid md:text-3xl">
              {t(tier.price)}
            </p>
            <ul className="mt-4 mb-6 space-y-2.5">
              {tier.features.map((f, fi) => (
                <li
                  key={f}
                  className={
                    fi === 0
                      ? "flex items-start gap-2 text-sm font-semibold text-white"
                      : "flex items-start gap-2 text-sm text-white/65"
                  }
                >
                  <Check
                    className={`mt-0.5 h-4 w-4 shrink-0 ${fi === 0 ? "text-acid" : "text-acid/50"}`}
                  />
                  {t(f)}
                </li>
              ))}
            </ul>
            {cta(tier)}
          </div>
        ))}
      </div>
    </div>
  );
}
