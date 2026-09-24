import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { useLang, useLangPath, useT } from "@/lib/useT";
import { type LegalDocKey, legalDocs } from "./legalDocs";

export function LegalScreen({ doc }: { doc: LegalDocKey }) {
  const lang = useLang();
  const lp = useLangPath();
  const t = useT();
  const d = legalDocs[doc][lang];

  return (
    <article className="mx-auto flex max-w-[44rem] flex-col gap-8 pb-6">
      <Link
        to={lp("/")}
        className="t-label inline-flex items-center gap-2 self-start text-text-3 transition-colors hover:text-text"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> {t("legal.back")}
      </Link>
      <header className="flex flex-col gap-3 border-b border-line pb-8">
        <h1 className="heading text-[2.5rem] text-text md:text-[3.5rem]">{d.title}</h1>
        <p className="t-label text-text-3">{d.updated}</p>
      </header>

      <div className="flex flex-col gap-9">
        {d.sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-2.5">
            <h2 className="font-sans cond text-[1.25rem] font-extrabold tracking-[0.02em] text-text uppercase">
              {s.h}
            </h2>
            {s.p.map((para, j) => (
              <p
                key={j}
                className="text-[0.96875rem] leading-relaxed whitespace-pre-line text-text-2"
              >
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
