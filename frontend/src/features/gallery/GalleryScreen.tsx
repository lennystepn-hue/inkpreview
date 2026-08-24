import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Eyebrow } from "@/components/ui/Ornament";
import { type Design, type Mockup, deleteMockup, listDesigns, listMockups } from "@/lib/api";
import { cn } from "@/lib/cn";
import { groupFamilies } from "@/lib/lineage";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { useLightbox } from "@/store/useLightbox";
import { CompareModal } from "./CompareModal";

const TILT = ["rotate-1", "rotate-0", "-rotate-1", "rotate-0"];

export function GalleryScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const qc = useQueryClient();
  const setDraft = useDraft((s) => s.setDesign);
  const { data: designs = [], isLoading } = useQuery<Design[]>({
    queryKey: ["designs"],
    queryFn: listDesigns,
  });
  const { data: mockups = [] } = useQuery<Mockup[]>({
    queryKey: ["mockups"],
    queryFn: listMockups,
  });
  const removeMockup = useMutation({
    mutationFn: deleteMockup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mockups"] }),
  });

  const done = designs.filter((d) => d.status === "done" && (d.thumb_url || d.clean_png_url));
  const families = groupFamilies(done);
  const [compare, setCompare] = useState<Design[] | null>(null);
  const openLightbox = useLightbox((s) => s.open);

  const pick = (d: Design) => {
    setDraft(d);
    navigate(lp("/studio"));
  };

  const enlarge = (d: Design) =>
    openLightbox({ id: d.id, src: d.clean_png_url ?? d.thumb_url ?? "", prompt: d.prompt, design: d });

  return (
    <div className="mx-auto max-w-md">
      <Eyebrow className="mb-3 max-w-[15rem]">{t("gallery.eyebrow")}</Eyebrow>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("gallery.title")}</h1>
      <p className="mt-1 text-sm text-white/45">{t("gallery.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : done.length === 0 ? (
        <div className="mt-14 text-center">
          <img
            src="/ink/moth.png"
            alt=""
            aria-hidden
            className="mx-auto h-20 w-20 object-contain opacity-25 invert"
          />
          <p className="mt-4 text-base text-white/60">{t("gallery.empty")}</p>
          <button
            onClick={() => navigate(lp("/"))}
            className="mt-5 inline-block rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-ink-950 shadow-[var(--shadow-glow-acid)]"
          >
            {t("explore.cta")}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {families.map((fam, i) => {
            const latest = fam[fam.length - 1];
            return (
              <div key={latest.id} className={cn("relative transition-transform", TILT[i % TILT.length])}>
                <button
                  onClick={() => enlarge(latest)}
                  className="group block aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-white transition-all hover:border-acid/60 hover:shadow-[var(--shadow-glow-acid)] active:scale-[0.96]"
                >
                  <img
                    src={latest.thumb_url ?? latest.clean_png_url ?? ""}
                    alt={latest.prompt}
                    className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                  />
                </button>
                {fam.length > 1 && (
                  <button
                    onClick={() => setCompare(fam)}
                    aria-label={t("compare.title", { n: fam.length })}
                    className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-ink-950/80 px-2.5 py-1.5 font-display text-[11px] font-bold text-acid backdrop-blur"
                  >
                    <Layers className="h-3 w-3" /> {fam.length}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mockups.length > 0 && (
        <section className="mt-12">
          <Eyebrow className="mb-4 max-w-[15rem]">{t("gallery.mockups.title")}</Eyebrow>
          <div className="grid grid-cols-2 gap-4">
            {mockups.map((m) => (
              <div
                key={m.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-magenta/25 bg-ink-850"
              >
                <img src={m.output_url} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-full bg-ink-950/80 px-2 py-0.5 font-display text-[9px] font-bold tracking-[0.15em] text-magenta uppercase backdrop-blur">
                  {t("gallery.mockups.badge")}
                </span>
                <button
                  onClick={() => removeMockup.mutate(m.id)}
                  aria-label={t("common.remove")}
                  className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink-950/70 text-white/70 backdrop-blur transition-colors hover:text-magenta"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {compare && (
        <CompareModal
          versions={compare}
          onPick={(d) => {
            setCompare(null);
            pick(d);
          }}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}
