import { PenTool } from "lucide-react";
import { Link } from "react-router-dom";

import { Dagger } from "@/components/brand/Dagger";
import { buttonClass } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { flashNo, flashTilt } from "@/lib/flash";
import { useFeed } from "@/lib/useFeed";
import { useLangPath, useT } from "@/lib/useT";
import { useLightbox } from "@/store/useLightbox";

const TAPES = ["t", "none", "l", "none", "r", "none"] as const;

/** Public, crawlable wall of the latest community flash. */
export function ExploreScreen() {
  const t = useT();
  const lp = useLangPath();
  const { data: feedRaw = [], isLoading } = useFeed();
  const feed = feedRaw.filter((d) => d.clean_png_url || d.thumb_url);
  const openLightbox = useLightbox((s) => s.open);

  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <PageHeader label={t("explore.eyebrow")} title={t("explore.title")}>
        {t("explore.subtitle")}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[1/1.1] animate-pulse rounded-[var(--radius-paper)] bg-raised"
            />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <Dagger className="h-16 w-auto text-line-strong" />
          <p className="text-lg text-text-2">{t("explore.empty")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-10">
          {feed.map((d, i) => (
            <li key={d.id}>
              <FlashCard
                src={d.thumb_url ?? d.clean_png_url ?? ""}
                alt={t("explore.alt")}
                no={flashNo(d.id)}
                tilt={flashTilt(d.id, 1.8)}
                tape={TAPES[i % TAPES.length]}
                label={`${t("explore.alt")} ${flashNo(d.id)}`}
                onClick={() =>
                  openLightbox({ id: d.id, src: d.clean_png_url ?? d.thumb_url ?? "" })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-center">
        <Link to={lp("/")} className={buttonClass("neon", "lg")}>
          <PenTool aria-hidden className="h-5 w-5" />
          {t("explore.cta")}
        </Link>
      </div>
    </div>
  );
}
