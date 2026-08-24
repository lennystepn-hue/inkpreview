import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { type Design, listDesigns } from "@/lib/api";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";

export function GalleryScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const setDraft = useDraft((s) => s.setDesign);
  const { data: designs = [], isLoading } = useQuery<Design[]>({
    queryKey: ["designs"],
    queryFn: listDesigns,
  });

  const done = designs.filter((d) => d.status === "done" && (d.thumb_url || d.clean_png_url));

  const pick = (d: Design) => {
    setDraft(d);
    navigate(lp("/studio"));
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("gallery.title")}</h1>
      <p className="mt-1 text-sm text-white/45">{t("gallery.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : done.length === 0 ? (
        <p className="mt-10 text-center text-sm text-white/30">{t("gallery.empty")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {done.map((d) => (
            <button
              key={d.id}
              onClick={() => pick(d)}
              className="group aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white transition-colors hover:border-acid/60"
            >
              <img
                src={d.thumb_url ?? d.clean_png_url ?? ""}
                alt={d.prompt}
                className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
