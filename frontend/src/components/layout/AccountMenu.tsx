import { Link } from "react-router-dom";

import { trackEvent } from "@/lib/analytics";
import { googleLoginUrl } from "@/lib/auth";
import { useSession } from "@/lib/useSession";
import { useLang, useLangPath, useT } from "@/lib/useT";

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
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

/** Header account affordance — the ONLY entry point to the account page.
 *  Anon → Google sign-in; logged-in → avatar that links to /account. */
export function AccountMenu() {
  const { data, isLoading } = useSession();
  const t = useT();
  const lang = useLang();
  const lp = useLangPath();

  if (isLoading || !data) return <span className="text-[11px] text-white/30">…</span>;

  const loggedIn = !data.is_anonymous && Boolean(data.email || data.name);

  if (!loggedIn) {
    return (
      <a
        href={googleLoginUrl(lang)}
        onClick={() => trackEvent("sign_in_click")}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-display text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <GoogleG />
        {t("auth.signIn")}
      </a>
    );
  }

  const initial = (data.name || data.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Link to={lp("/account")} aria-label={t("nav.account")} className="flex items-center">
      {data.avatar_url ? (
        <img
          src={data.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-7 rounded-full border border-white/15 object-cover"
        />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-acid/20 font-display text-xs font-bold text-acid">
          {initial}
        </span>
      )}
    </Link>
  );
}
