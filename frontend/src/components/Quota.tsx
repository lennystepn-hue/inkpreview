import { googleLoginUrl } from "@/lib/auth";
import { useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useUsage } from "@/lib/useUsage";
import { useLang, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

/** Subtle live counter of remaining free generations. Hidden for Pro/unlimited.
 *  During the launch promo it becomes the "preview unlimited" pill instead. */
export function QuotaMeter() {
  const t = useT();
  const { data } = useUsage();
  if (!data) return null;
  if (data.promo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-acid/40 bg-acid/10 px-3 py-1 font-display text-[11px] font-bold text-acid">
        ✦ {t("quota.promo")}
      </span>
    );
  }
  if (data.limit === null) return null;
  const left = data.remaining ?? 0;
  const tone = left === 0 ? "text-magenta" : left === 1 ? "text-cyan" : "text-white/45";
  return (
    <span className={`font-display text-[11px] font-semibold ${tone}`}>
      {t(data.period === "lifetime" ? "quota.guest" : "quota.month", { left, limit: data.limit })}
    </span>
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
  const btn =
    "mt-3 block w-full rounded-full bg-acid py-2.5 text-center font-display text-sm font-bold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-50";

  return (
    <div className="rounded-blob border border-magenta/30 bg-magenta/5 p-4 text-center">
      <p className="font-display text-base font-bold">
        {t(isGuest ? "paywall.guest.title" : "paywall.free.title")}
      </p>
      <p className="mt-1 text-sm text-white/55">
        {t(isGuest ? "paywall.guest.body" : "paywall.free.body")}
      </p>
      {isGuest ? (
        <a href={googleLoginUrl(lang)} className={btn}>
          {t("paywall.guest.cta")}
        </a>
      ) : billing?.enabled ? (
        <button onClick={openUpgrade} className={btn}>
          {t("billing.upgrade")}
        </button>
      ) : (
        <p className="mt-2 text-xs text-white/40">{t("paywall.free.resets")}</p>
      )}
    </div>
  );
}
