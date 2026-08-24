import { Link } from "react-router-dom";

import { useLang, useLangPath } from "@/lib/useT";
import { type LegalDocKey, legalDocs } from "./legalDocs";

export function LegalScreen({ doc }: { doc: LegalDocKey }) {
  const lang = useLang();
  const lp = useLangPath();
  const d = legalDocs[doc][lang];

  return (
    <article className="mx-auto max-w-2xl pb-10">
      <Link to={lp("/")} className="font-display text-xs font-semibold text-white/40 hover:text-white/70">
        ← InkPreview
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-xs text-white/35">{d.updated}</p>

      <div className="mt-7 flex flex-col gap-6">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-base font-bold text-white/90">{s.h}</h2>
            {s.p.map((para, j) => (
              <p
                key={j}
                className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-white/55"
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
