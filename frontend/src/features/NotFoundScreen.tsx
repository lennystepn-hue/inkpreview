import { Link } from "react-router-dom";

import { Dagger } from "@/components/brand/Dagger";
import { buttonClass } from "@/components/ui/Button";
import { NeonWord } from "@/components/ui/Neon";
import { useLangPath, useT } from "@/lib/useT";

/** Catch-all for unmatched client routes: an empty spot on the flash wall. */
export function NotFoundScreen() {
  const t = useT();
  const lp = useLangPath();
  return (
    <div className="mx-auto flex min-h-[56dvh] max-w-md flex-col items-center justify-center gap-7 text-center">
      <div className="relative grid aspect-[1/1.1] w-44 place-items-center rounded-[var(--radius-paper)] border-2 border-dashed border-line-strong">
        <span aria-hidden className="tape tape-t" />
        <Dagger className="h-24 w-auto rotate-12 text-line-strong" />
      </div>
      <NeonWord className="text-[5.5rem]">404</NeonWord>
      <div className="flex flex-col gap-2">
        <h1 className="heading text-[2.25rem] text-text">{t("notfound.title")}</h1>
        <p className="text-[0.9375rem] text-text-2">{t("notfound.body")}</p>
      </div>
      <Link to={lp("/")} className={buttonClass("neon", "lg")}>
        {t("notfound.cta")}
      </Link>
    </div>
  );
}
