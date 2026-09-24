import { buttonClass } from "@/components/ui/Button";
import { googleLoginUrl } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useUsage } from "@/lib/useUsage";
import { useLang, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

/** Quiet live counter of remaining free generations. Hidden for Pro/unlimited.
 *  During the launch promo it becomes the "preview unlimited" note instead. */
export function QuotaMeter({ className }: { className?: string }) {
  const t = useT();
  const { data } = useUsage();
  if (!data) return null;
  if (data.promo) {
    return (
      <p className={cn("t-label flex items-center justify-center gap-2 text-gold", className)}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
        {t("quota.promo")}
      </p>
    );
  }
  if (data.limit === null) return null;
  const left = data.remaining ?? 0;
  const tone = left === 0 ? "text-neon-hi" : left === 1 ? "text-gold" : "text-text-3";
  return (
    <p className={cn("t-label", tone, className)}>
      {t(data.period === "lifetime" ? "quota.guest" : "quota.month", { left, limit: data.limit })}
    </p>
  );
}

/** Conversion card shown when the user is out of quota: guest → sign in, free → Pro. */
export function Paywall() {
  const t = useT();
  const lang = useLang();
  const { data: usage } = useUsage();
  const { data: session } = useSession();
  const { data: billing } = useBillingConfig();
  const openUpgrade = useUpgrade((s) => s.openUpgrade);

  // Only when a metered user has nothing left.
  if (!usage || usage.limit === null || (usage.remaining ?? 1) > 0) return null;
  const isGuest = Boolean(session?.is_anonymous);
  const btn = buttonClass("neon", "md", "mt-4 w-full");

  return (
    <div className="rounded-[var(--radius-panel)] bg-surface p-5 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
      <p className="t-label text-gold">
        {t(isGuest ? "paywall.guest.title" : "paywall.free.title")}
      </p>
      <p className="mt-2 text-[0.9375rem] text-text-2">
        {t(isGuest ? "paywall.guest.body" : "paywall.free.body")}
      </p>
      {isGuest ? (
        <a href={googleLoginUrl(lang)} className={btn}>
          {t("paywall.guest.cta")}
        </a>
      ) : billing?.enabled ? (
        <button type="button" onClick={openUpgrade} className={btn}>
          {t("billing.upgrade")}
        </button>
      ) : (
        <p className="t-label mt-3 text-text-3">{t("paywall.free.resets")}</p>
      )}
    </div>
  );
}
