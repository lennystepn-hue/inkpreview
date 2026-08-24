import { Link } from "react-router-dom";

import { Eyebrow } from "@/components/ui/Ornament";
import { cn } from "@/lib/cn";
import { useFeed } from "@/lib/useFeed";
import { useLangPath, useT } from "@/lib/useT";
import { useLightbox } from "@/store/useLightbox";

// Flash thrown on the studio table — alternating sticker tilt by index.
const TILT = ["-rotate-1", "rotate-0", "rotate-1", "rotate-0"];

/** Public, crawlable gallery of the latest community designs. */
export function ExploreScreen() {
  const t = useT();
  const lp = useLangPath();
  const { data: feedRaw = [], isLoading } = useFeed();
  const feed = feedRaw.filter((d) => d.clean_png_url || d.thumb_url);
  const openLightbox = useLightbox((s) => s.open);

  return (
    <div className="mx-auto max-w-md md:max-w-3xl">
      <Eyebrow className="mb-3 max-w-[15rem] md:max-w-xs">{t("explore.eyebrow")}</Eyebrow>
      <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-4xl">
        {t("explore.title")}
      </h1>
      <p className="mt-1 text-sm text-white/45">{t("explore.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="mt-14 text-center">
          <img
            src="/ink/eye.png"
            alt=""
            aria-hidden
            className="mx-auto h-20 w-20 object-contain opacity-25 invert"
          />
          <p className="mt-4 text-base text-white/60">{t("explore.empty")}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {feed.map((d, i) => (
            <button
              key={d.id}
              onClick={() => openLightbox({ id: d.id, src: d.clean_png_url ?? d.thumb_url ?? "" })}
              className={cn(
                "group aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white transition-all duration-200 hover:rotate-0 hover:border-acid/60 hover:shadow-[var(--shadow-glow-acid)] active:scale-[0.96]",
                TILT[i % TILT.length],
              )}
            >
              <img
                src={d.thumb_url ?? d.clean_png_url ?? ""}
                alt={t("explore.alt")}
                loading="lazy"
                className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          to={lp("/")}
          className="inline-block rounded-full bg-acid px-7 py-3.5 font-display text-sm font-bold text-ink-950 shadow-[var(--shadow-glow-acid)] transition-transform hover:-translate-y-0.5"
        >
          {t("explore.cta")}
        </Link>
      </div>
    </div>
  );
}
