import { ChevronRight, Crown, Download, LogOut, Share2, Tag, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Dagger } from "@/components/brand/Dagger";
import { GoogleG } from "@/components/layout/AccountMenu";
import { StudioBrand } from "@/components/StudioBrand";
import { Button, buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { trackEvent } from "@/lib/analytics";
import { deleteAccount, exportAccountData } from "@/lib/api";
import { googleLoginUrl } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { referralLink } from "@/lib/referral";
import { clearToken } from "@/lib/session";
import { useBillingActions, useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useUsage } from "@/lib/useUsage";
import { useLang, useLangPath, useT } from "@/lib/useT";
import { useUpgrade } from "@/store/useUpgrade";

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-line)] md:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small allowances (guest 2, free 10) read best as a stamp card. */
function StampCard({ used, limit }: { used: number; limit: number }) {
  return (
    <ol className="mt-4 flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: limit }).map((_, i) => (
        <li
          key={i}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full",
            i < used
              ? "bg-paper-ink text-paper"
              : "shadow-[inset_0_0_0_1.5px_var(--color-paper-line)] [background:repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.03)_4px_5px)]",
          )}
        >
          {i < used && <Dagger className="h-5 w-auto" />}
        </li>
      ))}
    </ol>
  );
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
    return <div className="skeleton-paper mx-auto h-56 max-w-xl" />;
  }

  const loggedIn = !session.is_anonymous && Boolean(session.email || session.name);
  const isStudio = session.plan === "studio";
  const isPro = session.plan === "pro" || isStudio;
  const planLabel = isStudio
    ? t("account.plan.studio")
    : session.plan === "pro"
      ? t("account.plan.pro")
      : t("account.plan.free");
  const displayName = loggedIn ? session.name || session.email : t("account.guest");

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

  const row =
    "flex h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[0.9375rem] text-text-2 transition-colors hover:bg-raised hover:text-text";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <PageHeader title={t("account.title")} />

      {/* The client card */}
      <section className="paper relative overflow-hidden rounded-[var(--radius-paper)] p-5 shadow-[var(--shadow-paper)] md:p-6">
        <div className="flex items-start gap-4">
          {loggedIn && session.avatar_url ? (
            <img
              src={session.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-full object-cover shadow-[0_0_0_2px_var(--color-paper-ink)]"
            />
          ) : (
            <span className="gothic grid h-14 w-14 shrink-0 place-items-center rounded-full bg-paper-ink text-[1.75rem] text-paper">
              {(session.name || session.email || "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="t-label text-paper-mute">{t("account.card.label")}</p>
            <p className="typewriter mt-1 truncate text-[1.125rem] font-bold text-paper-ink">
              {displayName}
            </p>
            {loggedIn && session.email && session.name && (
              <p className="typewriter truncate text-[0.8125rem] text-paper-mute">
                {session.email}
              </p>
            )}
          </div>
          {/* rubber stamp */}
          <span className="t-label shrink-0 rotate-[-9deg] rounded-[4px] px-2.5 py-1.5 text-[0.8125rem] text-stencil-ink shadow-[inset_0_0_0_2px_var(--color-stencil-ink)]">
            {planLabel}
          </span>
        </div>

        {usage && (
          <div className="mt-6 border-t-[1.5px] border-dashed border-paper-line pt-5">
            <p className="t-label text-paper-mute">{t("account.quota.title")}</p>
            {usage.limit === null ? (
              <>
                <p className="heading mt-2 text-[2rem] text-paper-ink">
                  {t("account.quota.unlimited")}
                </p>
                {usage.promo && (
                  <p className="mt-1 text-[0.8125rem] text-paper-mute">{t("quota.promoNote")}</p>
                )}
              </>
            ) : (
              <>
                <p className="typewriter mt-2 text-[1.0625rem] font-bold text-paper-ink tabular-nums">
                  {t("account.quota.used", { used: usage.used, limit: usage.limit })}
                </p>
                {usage.limit <= 12 ? (
                  <StampCard used={Math.min(usage.used, usage.limit)} limit={usage.limit} />
                ) : (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
                    <div
                      className="h-full rounded-full bg-paper-ink"
                      style={{
                        width: `${usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0}%`,
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Sign-in for anonymous users */}
      {!loggedIn && (
        <Panel>
          <h2 className="font-sans cond text-[1.25rem] font-extrabold tracking-[0.02em] text-text uppercase">
            {t("account.signIn.title")}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-text-2">{t("account.signIn.body")}</p>
          <a
            href={googleLoginUrl(lang)}
            onClick={() => trackEvent("sign_in_click")}
            className={buttonClass("paper", "lg", "mt-5 w-full")}
          >
            <GoogleG className="h-4 w-4" /> {t("account.signIn.cta")}
          </a>
        </Panel>
      )}

      {/* Upgrade / manage subscription */}
      {billing?.enabled && loggedIn && (
        <Panel>
          {isPro ? (
            <Button variant="outline" className="w-full" onClick={manage} disabled={busy}>
              {t("billing.manage")}
            </Button>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-sans cond text-[1.25rem] font-extrabold tracking-[0.02em] text-text uppercase">
                <Crown aria-hidden className="h-5 w-5 text-gold" /> {t("account.upgrade.title")}
              </h2>
              <p className="mt-2 text-[0.9375rem] text-text-2">{t("account.upgrade.body")}</p>
              <Button size="lg" className="mt-5 w-full" onClick={openUpgrade}>
                {t("billing.upgrade")}
              </Button>
            </>
          )}
        </Panel>
      )}

      {isStudio && (
        <Panel>
          <StudioBrand initial={session.brand_name ?? ""} />
        </Panel>
      )}

      {loggedIn && (
        <Panel>
          <h2 className="font-sans cond text-[1.25rem] font-extrabold tracking-[0.02em] text-text uppercase">
            {t("account.referral.title")}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-text-2">{t("account.referral.body")}</p>
          <Button variant="outline" className="mt-5 w-full" onClick={copyInvite}>
            <Share2 aria-hidden className="h-4 w-4" />
            {invited ? t("account.referral.copied") : t("account.invite")}
          </Button>
        </Panel>
      )}

      <Panel className="p-2! md:p-2!">
        <Link to={lp("/pricing")} className={row}>
          <Tag aria-hidden className="h-4 w-4 text-text-3" />
          <span className="flex-1">{t("nav.pricing")}</span>
          <ChevronRight aria-hidden className="h-4 w-4 text-text-3" />
        </Link>
        {loggedIn && (
          <>
            <p className="t-label mt-2 border-t border-line px-3 pt-4 pb-1 text-text-3">
              {t("account.gdpr.title")}
            </p>
            <button
              type="button"
              onClick={() => exportAccountData().catch(() => {})}
              className={row}
            >
              <Download aria-hidden className="h-4 w-4 text-text-3" />
              <span className="flex-1">{t("account.export")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearToken();
                window.location.assign("/");
              }}
              className={row}
            >
              <LogOut aria-hidden className="h-4 w-4 text-text-3" />
              <span className="flex-1">{t("auth.signOut")}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(t("account.delete.confirm"))) return;
                await deleteAccount();
                clearToken();
                window.location.assign("/");
              }}
              className={cn(row, "text-neon-hi hover:text-neon-hi")}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              <span className="flex-1">{t("account.delete")}</span>
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}
