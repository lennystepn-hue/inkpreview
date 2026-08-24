import { Link } from "react-router-dom";

import { useLangPath, useT } from "@/lib/useT";

/** Friendly catch-all for unmatched client routes — with tattoo flavor. */
export function NotFoundScreen() {
  const t = useT();
  const lp = useLangPath();
  return (
    <div className="relative mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center text-center">
      <img
        src="/ink/dagger.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rotate-12 object-contain opacity-[0.07] invert"
      />
      <p className="relative font-tattoo text-8xl text-acid drop-shadow-[0_0_28px_var(--color-acid)]">
        404
      </p>
      <h1 className="relative mt-4 font-display text-xl font-extrabold tracking-tight">
        {t("notfound.title")}
      </h1>
      <p className="relative mt-1.5 text-sm text-white/45">{t("notfound.body")}</p>
      <Link
        to={lp("/")}
        className="relative mt-7 rounded-full bg-acid px-7 py-3.5 font-display text-sm font-bold text-ink-950 shadow-[var(--shadow-glow-acid)]"
      >
        {t("notfound.cta")}
      </Link>
    </div>
  );
}
