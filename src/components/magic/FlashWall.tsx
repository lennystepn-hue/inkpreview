import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/cn";
import { useFeed } from "@/lib/useFeed";

type Glow = "acid" | "cyan" | "magenta";

const GLOW: Record<Glow, string> = {
  acid: "shadow-[var(--shadow-glow-acid)]",
  cyan: "shadow-[var(--shadow-glow-cyan)]",
  magenta: "shadow-[var(--shadow-glow-magenta)]",
};

const GLOWS: Glow[] = ["acid", "cyan", "magenta"];

// Bundled samples — shown until the live feed has enough real designs.
const BUNDLED = [
  "/flash/snake-dagger.png",
  "/flash/koi.png",
  "/flash/moth.png",
  "/flash/mandala.png",
  "/flash/heart.png",
  "/flash/celestial.png",
];

/** Newest real designs first (the feed), topped up with bundled samples. */
function useFlashSrcs(count: number): string[] {
  const { data } = useFeed();
  const live = (data ?? [])
    .map((d) => d.thumb_url ?? d.clean_png_url)
    .filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const s of [...live, ...BUNDLED]) {
    if (!seen.has(s)) {
      seen.add(s);
      merged.push(s);
    }
  }
  return merged.slice(0, count);
}

function FlashCard({
  src,
  tilt,
  glow,
  delay = 0,
  className,
}: {
  src: string;
  tilt: number;
  glow: Glow;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotate: tilt }}
      animate={
        reduce ? { opacity: 1, rotate: tilt } : { opacity: 1, scale: 1, rotate: tilt, y: [0, -8, 0] }
      }
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: { duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut", delay },
      }}
      className={cn(
        "overflow-hidden rounded-2xl border border-white/12 bg-white",
        GLOW[glow],
        className,
      )}
    >
      <img src={src} alt="AI tattoo flash" loading="lazy" className="h-full w-full object-cover" />
    </motion.div>
  );
}

/** Desktop editorial: a clean curated grid (live feed + bundled) with hover lift. */
export function FlashGallery({ className }: { className?: string }) {
  const srcs = useFlashSrcs(6);
  return (
    <div className={cn("grid grid-cols-2 gap-5 lg:grid-cols-3", className)}>
      {srcs.map((src, i) => (
        <motion.div
          key={src + i}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
          className="group overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-glow-acid)]"
        >
          <img
            src={src}
            alt="AI tattoo flash"
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </motion.div>
      ))}
    </div>
  );
}

/** Mobile: a compact fanned trio above the headline. */
export function FlashStrip({ className }: { className?: string }) {
  const srcs = useFlashSrcs(3);
  if (srcs.length < 3) return null;
  return (
    <div className={cn("relative mx-auto flex h-32 w-full items-center justify-center", className)}>
      <FlashCard
        src={srcs[0]}
        glow={GLOWS[0]}
        tilt={-10}
        delay={0.1}
        className="absolute z-10 h-28 w-28 -translate-x-[4.5rem]"
      />
      <FlashCard
        src={srcs[2]}
        glow={GLOWS[2]}
        tilt={10}
        delay={0.2}
        className="absolute z-10 h-28 w-28 translate-x-[4.5rem]"
      />
      <FlashCard
        src={srcs[1]}
        glow={GLOWS[1]}
        tilt={0}
        delay={0}
        className="absolute z-20 h-32 w-32"
      />
    </div>
  );
}
