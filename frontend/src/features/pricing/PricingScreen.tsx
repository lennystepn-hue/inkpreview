import { Check } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { googleLoginUrl } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { type DictKey } from "@/lib/i18n";
import { useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useLang, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

const CONTACT = "mailto:contact@lenny.services?subject=InkPreview%20Studio";

type Tier = {
  id: "free" | "pro" | "studio";
  name: DictKey;
  price: DictKey;
  features: DictKey[];
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "pricing.free.name",
    price: "pricing.free.price",
    features: ["pricing.free.f1", "pricing.free.f2", "pricing.free.f3"],
  },
  {
    id: "pro",
    name: "pricing.pro.name",
    price: "pricing.pro.price",
    features: ["pricing.pro.f1", "pricing.pro.f2", "pricing.pro.f3", "pricing.pro.f4"],
  },
  {
    id: "studio",
    name: "pricing.studio.name",
    price: "pricing.studio.price",
    features: ["pricing.studio.f1", "pricing.studio.f2", "pricing.studio.f3", "pricing.studio.f4"],
  },
];

/** The shop's price board: two plans on the wall, the popular one on flash paper. */
export function PricingScreen() {
  const t = useT();
  const lang = useLang();
  const { data: session } = useSession();
  const { data: billing } = useBillingConfig();
  const openUpgrade = useUpgrade((s) => s.openUpgrade);

  const plan = session?.plan ?? "free";
  const isAnon = session?.is_anonymous ?? true;
  const isPro = plan === "pro" || plan === "studio";

  const current = (tone: "wall" | "paper") => (
    <p
      className={cn(
        "t-label flex h-11 items-center justify-center rounded-full",
        tone === "paper"
          ? "text-paper-mute shadow-[inset_0_0_0_1.5px_var(--color-paper-line)]"
          : "text-text-3 shadow-[inset_0_0_0_1px_var(--color-line)]",
      )}
    >
      {t("pricing.cta.current")}
    </p>
  );

  const cta = (tier: Tier) => {
    if (tier.id === "studio") {
      return (
        <a href={CONTACT} className={buttonClass("outline", "md", "w-full")}>
          {t("pricing.cta.studio")}
        </a>
      );
    }
    if (tier.id === "pro") {
      if (isPro) return current("paper");
      if (isAnon)
        return (
          <a href={googleLoginUrl(lang)} className={buttonClass("neon", "md", "w-full")}>
            {t("pricing.cta.signin")}
          </a>
        );
      if (billing?.enabled)
        return (
          <button
            type="button"
            onClick={openUpgrade}
            className={buttonClass("neon", "md", "w-full")}
          >
            {t("pricing.cta.pro")}
          </button>
        );
      return (
        <p className="t-label flex h-11 items-center justify-center text-paper-mute">
          {t("pricing.cta.soon")}
        </p>
      );
    }
    return isPro ? null : current("wall");
  };

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <PageHeader label={t("pricing.label")} title={t("pricing.title")} align="center">
        {t("pricing.subtitle")}
      </PageHeader>

      <ul className="mx-auto grid w-full max-w-md grid-cols-1 gap-6 md:max-w-none md:grid-cols-3 md:items-center md:gap-5 lg:gap-8">
        {TIERS.map((tier) => {
          const pro = tier.id === "pro";
          return (
            <li
              key={tier.id}
              className={cn(
                "relative flex flex-col gap-6 p-6 md:p-7",
                pro
                  ? "paper rounded-[var(--radius-paper)] shadow-[var(--shadow-paper-lift)] md:-rotate-1 md:py-10"
                  : "rounded-[var(--radius-panel)] bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]",
              )}
            >
              {pro && (
                <>
                  <span aria-hidden className="tape tape-l" />
                  <span className="t-label absolute -top-3.5 right-5 flex h-7 items-center gap-1.5 rounded-full bg-neon px-3 text-neon-ink shadow-[0_0_18px_-2px_var(--color-neon)]">
                    {t("pricing.recommended")}
                  </span>
                </>
              )}
              <div className="flex flex-col gap-2">
                <h2 className={cn("t-label", pro ? "text-paper-mute" : "text-text-3")}>
                  {t(tier.name)}
                </h2>
                <p
                  className={cn(
                    "heading text-[2.75rem] md:text-5xl",
                    pro ? "text-paper-ink" : "text-text",
                  )}
                >
                  {t(tier.price)}
                </p>
              </div>
              <ul
                className={cn(
                  "flex flex-col gap-3 border-t-[1.5px] border-dashed pt-5",
                  pro ? "border-paper-line" : "border-line",
                )}
              >
                {tier.features.map((f, fi) => (
                  <li
                    key={f}
                    className={cn(
                      "flex items-start gap-2.5 text-[0.9375rem]",
                      pro ? "text-paper-ink" : fi === 0 ? "text-text" : "text-text-2",
                      fi === 0 && "font-bold",
                    )}
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        pro ? "text-stencil-ink" : "text-jade",
                      )}
                    />
                    {t(f)}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">{cta(tier)}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
