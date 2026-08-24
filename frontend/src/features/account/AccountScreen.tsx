import { Crown, Download, LogOut, Share2, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { StudioBrand } from "@/components/StudioBrand";
import { trackEvent } from "@/lib/analytics";
import { deleteAccount, exportAccountData } from "@/lib/api";
import { googleLoginUrl } from "@/lib/auth";
import { referralLink } from "@/lib/referral";
import { clearToken } from "@/lib/session";
import { useBillingActions, useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useUsage } from "@/lib/useUsage";
import { useLang, useLangPath, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-blob border border-white/10 bg-white/[0.03] p-5">{children}</section>;
}

export function AccountScreen() {
  const t = useT();
  const lang = useLang();
  const lp = useLangPath();
  const { data: session, isLoading } = useSession();
  const { data: usage } = useUsage();
  const { data: billing } = useBillingConfig();
  const { manage, busy } = useBillingActions();
  const openUpgrade = useUpgrade((s) => s.openUpgrade);
  const [invited, setInvited] = useState(false);

  if (isLoading || !session) {
    return <div className="mx-auto h-40 max-w-md animate-pulse rounded-blob bg-white/5" />;
  }

  const loggedIn = !session.is_anonymous && Boolean(session.email || session.name);
  const isStudio = session.plan === "studio";
  const isPro = session.plan === "pro" || isStudio;
  const planLabel = isStudio
    ? t("account.plan.studio")
    : session.plan === "pro"
      ? t("account.plan.pro")
      : t("account.plan.free");

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(referralLink(session.user_id));
      setInvited(true);
      setTimeout(() => setInvited(false), 1500);
      trackEvent("invite_copied");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("account.title")}</h1>
      </header>

      {/* Identity / plan */}
      <Card>
        <div className="flex items-center gap-3">
          {loggedIn && session.avatar_url ? (
            <img
              src={session.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full border border-white/15 object-cover"
            />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-acid/20 font-display text-lg font-bold text-acid">
              {(session.name || session.email || "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">
              {loggedIn ? session.name || session.email : t("account.guest")}
            </p>
            <span className="mt-0.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-acid">
              {planLabel}
            </span>
          </div>
        </div>
      </Card>

      {/* Sign-in CTA for anonymous users */}
      {!loggedIn && (
        <Card>
          <h2 className="font-display text-base font-bold">{t("account.signIn.title")}</h2>
          <p className="mt-1 text-sm text-white/55">{t("account.signIn.body")}</p>
          <a
            href={googleLoginUrl(lang)}
            onClick={() => trackEvent("sign_in_click")}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-acid py-3 font-display text-sm font-bold text-ink-950"
          >
            <GoogleG /> {t("account.signIn.cta")}
          </a>
        </Card>
      )}

      {/* Quota */}
      {usage && (
        <Card>
          <p className="text-xs tracking-wide text-white/35 uppercase">{t("account.quota.title")}</p>
          {usage.limit === null ? (
            <>
              <p className="mt-1 font-display text-lg font-bold text-acid">
                {t("account.quota.unlimited")}
              </p>
              {usage.promo && <p className="mt-1 text-xs text-white/45">{t("quota.promoNote")}</p>}
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-lg font-bold">
                {t("account.quota.used", { used: usage.used, limit: usage.limit })}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-acid"
                  style={{
                    width: `${usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0}%`,
                  }}
                />
              </div>
            </>
          )}
        </Card>
      )}

      {/* Upgrade / manage subscription */}
      {billing?.enabled && (
        <Card>
          {isPro ? (
            <button
              onClick={manage}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm font-semibold text-white/80 disabled:opacity-50"
            >
              {t("billing.manage")}
            </button>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Crown className="h-4 w-4 text-acid" /> {t("account.upgrade.title")}
              </h2>
              <p className="mt-1 text-sm text-white/55">{t("account.upgrade.body")}</p>
              <button
                onClick={openUpgrade}
                className="mt-4 w-full rounded-full bg-acid py-3 font-display text-sm font-bold text-ink-950"
              >
                {t("billing.upgrade")}
              </button>
            </>
          )}
        </Card>
      )}

      {/* Plans / pricing — always reachable from here */}
      <Link
        to={lp("/pricing")}
        className="flex items-center justify-between rounded-blob border border-white/10 bg-white/[0.03] px-5 py-4 transition-colors hover:border-acid/40"
      >
        <span className="flex items-center gap-2 font-display text-sm font-bold">
          <Tag className="h-4 w-4 text-acid" /> {t("nav.pricing")}
        </span>
        <span className="text-white/30">›</span>
      </Link>

      {/* Studio brand */}
      {isStudio && (
        <Card>
          <StudioBrand initial={session.brand_name ?? ""} />
        </Card>
      )}

      {/* Referral */}
      {loggedIn && (
        <Card>
          <h2 className="font-display text-base font-bold">{t("account.referral.title")}</h2>
          <p className="mt-1 text-sm text-white/55">{t("account.referral.body")}</p>
          <button
            onClick={copyInvite}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-acid/40 bg-acid/5 py-2.5 font-display text-sm font-semibold text-acid"
          >
            <Share2 className="h-4 w-4" />
            {invited ? t("account.referral.copied") : t("account.invite")}
          </button>
        </Card>
      )}

      {/* GDPR + sign out */}
      {loggedIn && (
        <Card>
          <p className="text-xs tracking-wide text-white/35 uppercase">{t("account.gdpr.title")}</p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => exportAccountData().catch(() => {})}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-xs font-semibold text-white/70 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> {t("account.export")}
            </button>
            <button
              onClick={() => {
                clearToken();
                window.location.assign("/");
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-xs font-semibold text-white/70 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("auth.signOut")}
            </button>
            <button
              onClick={async () => {
                if (!window.confirm(t("account.delete.confirm"))) return;
                await deleteAccount();
                clearToken();
                window.location.assign("/");
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-magenta/30 py-2.5 text-xs font-semibold text-magenta/80 hover:text-magenta"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("account.delete")}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
