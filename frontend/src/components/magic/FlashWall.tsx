import { motion, useReducedMotion } from "motion/react";

import { FlashCard } from "@/components/ui/FlashCard";
import { cn } from "@/lib/cn";
import { flashNo, flashTilt } from "@/lib/flash";
import { useFeed } from "@/lib/useFeed";
import { useT } from "@/lib/useT";
import { useLightbox } from "@/store/useLightbox";

/** The shop's own flash (bundled, curated) — the hero never depends on what
 *  the live feed happens to contain. Fixed numbers, so a sheet keeps its number
 *  everywhere (hero, wait screen, OG image). */
export const HOUSE_FLASH = [
  { id: "snake-dagger", no: "№ 641", caption: "Fine line" },
  { id: "heart", no: "№ 214", caption: "Traditional" },
  { id: "moth", no: "№ 900", caption: "Blackwork" },
  { id: "koi", no: "№ 231", caption: "Irezumi" },
  { id: "mandala", no: "№ 298", caption: "Mandala" },
  { id: "celestial", no: "№ 377", caption: "Fine line" },
].map((f) => ({ ...f, src: `/flash/${f.id}.webp` }));

const ease = [0.22, 1, 0.36, 1] as const;

/** Mobile hero: three flash sheets fanned out on the wall. */
export function HeroFan({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const t = useT();
  const cards = [
    { ...HOUSE_FLASH[2], x: "-5.75rem", rot: -8, w: "w-[8.5rem]", z: "z-0", delay: 0.1 },
    { ...HOUSE_FLASH[3], x: "5.75rem", rot: 7, w: "w-[8.5rem]", z: "z-0", delay: 0.16 },
    { ...HOUSE_FLASH[0], x: "0rem", rot: -1.5, w: "w-[10rem]", z: "z-10", delay: 0 },
  ];
  return (
    <div
      className={cn(
        "relative mx-auto flex h-[12.5rem] w-full items-center justify-center",
        className,
      )}
    >
      {cards.map((c) => (
        <motion.div
          key={c.src}
          initial={reduce ? false : { y: 24 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: c.delay, ease }}
          className={cn("absolute", c.z, c.w)}
          style={{ translateX: c.x }}
        >
          <FlashCard
            src={c.src}
            alt={t("explore.alt")}
            no={c.no}
            tilt={c.rot}
            tape={c.z === "z-10" ? "t" : "none"}
            loading="eager"
          />
        </motion.div>
      ))}
    </div>
  );
}

/** Desktop hero: a loose, hand-pinned collage of house flash. */
export function HeroWall({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const t = useT();
  const layout = [
    { i: 0, left: "3%", top: "0%", w: "45%", rot: -4, tape: "l" as const },
    { i: 1, left: "53%", top: "6%", w: "43%", rot: 3.5, tape: "r" as const },
    { i: 4, left: "0%", top: "51%", w: "37%", rot: 2.5, tape: "t" as const },
    { i: 2, left: "35%", top: "47%", w: "38%", rot: -2.5, tape: "lr" as const },
    { i: 3, left: "71%", top: "57%", w: "29%", rot: 5, tape: "t" as const },
  ];
  return (
    <div className={cn("relative aspect-[1/1.02] w-full", className)}>
      {layout.map((l, n) => {
        const f = HOUSE_FLASH[l.i];
        return (
          <motion.div
            key={f.src}
            initial={reduce ? false : { y: 28 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * n, ease }}
            className="absolute"
            style={{ left: l.left, top: l.top, width: l.w }}
          >
            <FlashCard
              src={f.src}
              alt={t("explore.alt")}
              no={f.no}
              caption={f.caption}
              tilt={l.rot}
              tape={l.tape}
              loading="eager"
            />
          </motion.div>
        );
      })}
    </div>
  );
}

/** The newest community designs, pinned in a tidy grid. Visible at rest —
 *  no scroll-triggered reveal. */
export function FreshWall({ limit = 8, className }: { limit?: number; className?: string }) {
  const t = useT();
  const { data } = useFeed();
  const openLightbox = useLightbox((s) => s.open);
  const items = (data ?? []).filter((d) => d.thumb_url || d.clean_png_url).slice(0, limit);
  if (items.length === 0) return null;
  return (
    <div
      className={cn("grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4", className)}
    >
      {items.map((d) => (
        <FlashCard
          key={d.id}
          src={d.thumb_url ?? d.clean_png_url ?? ""}
          alt={t("explore.alt")}
          no={flashNo(d.id)}
          tilt={flashTilt(d.id, 1.6)}
          label={`${t("explore.alt")} ${flashNo(d.id)}`}
          onClick={() => openLightbox({ id: d.id, src: d.clean_png_url ?? d.thumb_url ?? "" })}
        />
      ))}
    </div>
  );
}
