import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, PenTool, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { buttonClass } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Design, type Mockup, deleteMockup, listDesigns, listMockups } from "@/lib/api";
import { flashNo, flashTilt, styleName } from "@/lib/flash";
import { groupFamilies } from "@/lib/lineage";
import { useStyles } from "@/lib/useStyles";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { useLightbox } from "@/store/useLightbox";
import { CompareModal } from "./CompareModal";

export function GalleryScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const qc = useQueryClient();
  const setDraft = useDraft((s) => s.setDesign);
  const { data: styles = [] } = useStyles();
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
    openLightbox({
      id: d.id,
      src: d.clean_png_url ?? d.thumb_url ?? "",
      prompt: d.prompt,
      design: d,
    });

  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <PageHeader label={t("gallery.eyebrow")} title={t("gallery.title")}>
        {t("gallery.subtitle")}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-paper aspect-[1/1.1]" />
          ))}
        </div>
      ) : done.length === 0 ? (
        <div className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="grid aspect-[1/1.1] w-40 place-items-center rounded-[var(--radius-paper)] border-2 border-dashed border-line-strong">
            <PenTool aria-hidden className="h-8 w-8 text-text-3" />
          </div>
          <p className="max-w-[28ch] text-lg text-text-2">{t("gallery.empty")}</p>
          <Link to={lp("/")} className={buttonClass("neon", "lg")}>
            {t("explore.cta")}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-10">
          {families.map((fam) => {
            const latest = fam[fam.length - 1];
            return (
              <li key={latest.id} className="relative">
                <FlashCard
                  src={latest.thumb_url ?? latest.clean_png_url ?? ""}
                  alt={latest.prompt}
                  label={latest.prompt}
                  no={flashNo(latest.id)}
                  caption={styleName(latest.styles, styles)}
                  tilt={flashTilt(latest.id, 1.6)}
                  onClick={() => enlarge(latest)}
                />
                {fam.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCompare(fam)}
                    aria-label={t("compare.title", { n: fam.length })}
                    className="t-label absolute -top-2.5 -right-2 z-10 flex h-8 items-center gap-1.5 rounded-full bg-paper-ink px-3 text-paper shadow-[0_4px_10px_rgb(0_0_0/0.45)] transition-transform hover:scale-105"
                  >
                    <Layers aria-hidden className="h-3.5 w-3.5" /> {fam.length}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mockups.length > 0 && (
        <section className="mt-6 flex flex-col gap-6" aria-labelledby="mockups-title">
          <div className="flex flex-col gap-3">
            <Label dot="stencil">{t("gallery.mockups.badge")}</Label>
            <h2 id="mockups-title" className="heading text-[2rem] text-text md:text-4xl">
              {t("gallery.mockups.title")}
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-8">
            {mockups.map((m) => (
              <li key={m.id} className="relative">
                {/* a print of the healed-look photo, like the ones pinned in every shop */}
                <figure className="rounded-[4px] bg-paper p-2 pb-8 shadow-[var(--shadow-paper)]">
                  <img
                    src={m.output_url}
                    alt={t("gallery.mockups.badge")}
                    className="aspect-square w-full rounded-[2px] object-cover"
                  />
                  <figcaption className="t-label absolute bottom-2.5 left-3.5 text-[0.5625rem] text-paper-mute">
                    {flashNo(m.id)} · {t("gallery.mockups.badge")}
                  </figcaption>
                </figure>
                <button
                  type="button"
                  onClick={() => removeMockup.mutate(m.id)}
                  aria-label={t("common.remove")}
                  className="absolute -top-2.5 -right-2 grid h-8 w-8 place-items-center rounded-full bg-surface text-text-2 shadow-[0_4px_10px_rgb(0_0_0/0.45),inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:text-neon-hi"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
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
